import { App, TFile, Notice } from 'obsidian';
import { EventEmitter } from 'events';
import { BaseGenerator, BaseGeneratorInput, BaseGeneratorOutput } from './BaseGenerator';
import { AIAdapter } from '../adapters/AIAdapter';
import { SettingsService } from '../services/SettingsService';
import { DatabaseService } from '../services/DatabaseService';
import { FrontMatterGenerator } from './FrontMatterGenerator';
import { WikilinkGenerator } from './WikilinkGenerator';
import {
    ProcessingStatus,
    ProcessingState,
    ProcessingEvent,
    ProcessingStats,
    FileProcessingResult,
    ProcessingOptions,
    FileChunk,
    ProcessingError,
    DEFAULT_PROCESSING_OPTIONS
} from '../models/ProcessingTypes';

/**
 * Input/Output interfaces for batch processing
 */
interface BatchProcessorInput extends BaseGeneratorInput {
    files: TFile[];
    generateFrontMatter: boolean;
    generateWikilinks: boolean;
    options?: Partial<ProcessingOptions>;
}

export interface BatchProcessorOutput extends BaseGeneratorOutput {
    fileResults: FileProcessingResult[];
    stats: ProcessingStats;
}

/**
 * Enhanced processor for batch operations on multiple files
 */
export class BatchProcessor extends BaseGenerator<BatchProcessorInput, BatchProcessorOutput> {
    private readonly NOTIFICATION_INTERVAL = 2000;
    private lastNotificationTime = 0;
    private processStartTime: number = 0;
    public eventEmitter: EventEmitter;
    private currentStatus: ProcessingStatus;
    private options: ProcessingOptions;
    private processingTimeout: NodeJS.Timeout | null = null;

    constructor(
        aiAdapter: AIAdapter,
        settingsService: SettingsService,
        private frontMatterGenerator: FrontMatterGenerator,
        private wikilinkGenerator: WikilinkGenerator,
        private databaseService: DatabaseService,
        private app: App
    ) {
        super(aiAdapter, settingsService);
        this.eventEmitter = new EventEmitter();
        this.options = DEFAULT_PROCESSING_OPTIONS;
        this.currentStatus = this.getDefaultStatus();
    }

    /**
     * Main generation method
     */
    public async generate(input: BatchProcessorInput): Promise<BatchProcessorOutput> {
        if (!this.validateInput(input)) {
            throw new Error('Invalid input for batch processing');
        }

        this.processStartTime = Date.now();
        this.options = { ...this.options, ...input.options };
        
        try {
            await this.startProcessing(input.files);
            const results = await this.processFiles(input);
            const stats = await this.finalizeProcessing(results);

            return {
                fileResults: results,
                stats
            };
        } catch (error) {
            await this.handleError(error as Error);
            throw error;
        } finally {
            await this.cleanup();
        }
    }

    /**
     * Start processing and initialize status
     */
    private async startProcessing(files: TFile[]): Promise<void> {
        this.currentStatus = {
            state: 'running',
            filesQueued: files.length,
            filesProcessed: 0,
            filesRemaining: files.length,
            startTime: this.processStartTime,
            errors: []
        };

        this.emitEvent('start', { status: this.currentStatus });
    }

    /**
     * Process all files in chunks
     */
    private async processFiles(input: BatchProcessorInput): Promise<FileProcessingResult[]> {
        const chunks = this.createChunks(input.files);
        const results: FileProcessingResult[] = [];

        for (const chunk of chunks) {
            if (this.currentStatus.state === 'paused') {
                await this.waitForResume();
            }

            this.emitEvent('chunkStart', chunk);
            const chunkResults = await this.processChunk(chunk, input);
            results.push(...chunkResults);
            this.emitEvent('chunkComplete', chunk);

            if (chunks.indexOf(chunk) < chunks.length - 1) {
                await this.delay(this.options.delayBetweenChunks);
            }
        }

        return results;
    }

    /**
     * Process a single chunk of files
     */
    private async processChunk(chunk: FileChunk, input: BatchProcessorInput): Promise<FileProcessingResult[]> {
        const files = chunk.files
            .map(path => this.app.vault.getAbstractFileByPath(path))
            .filter((file): file is TFile => file instanceof TFile);

        const results = await Promise.all(
            files.map(file => this.processFile(file, input))
        );

        this.updateProgress(results.filter(r => r.success).length);
        return results;
    }

    /**
     * Process a single file
     */
    private async processFile(file: TFile, input: BatchProcessorInput): Promise<FileProcessingResult> {
        const startTime = Date.now();
        this.emitEvent('fileStart', { file: file.path });

        try {
            let content = await this.app.vault.read(file);
            const processed = await this.generateContent(content, input);
            await this.app.vault.modify(file, processed.content);

            const result: FileProcessingResult = {
                path: file.path,
                success: true,
                processingTime: Date.now() - startTime,
                ...processed.flags
            };

            this.emitEvent('fileComplete', { result });
            return result;
        } catch (error) {
            const errorResult = this.createErrorResult(file, error as Error);
            this.handleProcessingError(errorResult.error);
            return errorResult.result;
        }
    }

    /**
     * Generate content for a file
     */
    private async generateContent(content: string, input: BatchProcessorInput): Promise<{
        content: string;
        flags: {
            frontMatterGenerated: boolean;
            wikilinksGenerated: boolean;
        };
    }> {
        let frontMatterGenerated = false;
        let wikilinksGenerated = false;
        let processedContent = content;

        if (input.generateFrontMatter) {
            const result = await this.frontMatterGenerator.generate({ content: processedContent });
            frontMatterGenerated = result.content !== processedContent;
            processedContent = result.content;
        }

        if (input.generateWikilinks) {
            const pages = this.app.vault.getMarkdownFiles().map(file => file.basename);
            const result = await this.wikilinkGenerator.generate({ 
                content: processedContent, 
                existingPages: pages 
            });
            wikilinksGenerated = result.content !== processedContent;
            processedContent = result.content;
        }

        return {
            content: processedContent,
            flags: { frontMatterGenerated, wikilinksGenerated }
        };
    }

    /**
     * Finalize processing and calculate stats
     */
    private async finalizeProcessing(results: FileProcessingResult[]): Promise<ProcessingStats> {
        const endTime = Date.now();
        const successfulFiles = results.filter(r => r.success);
        
        const stats: ProcessingStats = {
            totalFiles: results.length,
            processedFiles: successfulFiles.length,
            errorFiles: results.length - successfulFiles.length,
            skippedFiles: 0,
            startTime: this.processStartTime,
            endTime,
            averageProcessingTime: this.calculateAverageTime(successfulFiles)
        };

        await this.databaseService.addProcessingStats(stats);
        this.emitEvent('complete', stats);
        
        return stats;
    }

    /**
     * Update processing progress
     */
    private updateProgress(processedCount: number): void {
        this.currentStatus.filesProcessed += processedCount;
        this.currentStatus.filesRemaining -= processedCount;
        
        const elapsed = Date.now() - (this.currentStatus.startTime || 0);
        const filesPerMs = this.currentStatus.filesProcessed / elapsed;
        this.currentStatus.estimatedTimeRemaining = 
            this.currentStatus.filesRemaining / filesPerMs;

        this.emitEvent('progress', this.currentStatus);
        this.maybeShowNotification();
    }

    private maybeShowNotification(): void {
        const now = Date.now();
        if (now - this.lastNotificationTime > this.NOTIFICATION_INTERVAL) {
            const { filesProcessed, filesQueued } = this.currentStatus;
            new Notice(
                `Processing files: ${filesProcessed}/${filesQueued} ` +
                `(${Math.round(filesProcessed/filesQueued*100)}%)`
            );
            this.lastNotificationTime = now;
        }
    }

    // Helper methods
    private getDefaultStatus(): ProcessingStatus {
        return {
            state: 'idle',
            filesQueued: 0,
            filesProcessed: 0,
            filesRemaining: 0,
            errors: []
        };
    }

    private createChunks(files: TFile[]): FileChunk[] {
        const chunks: FileChunk[] = [];
        for (let i = 0; i < files.length; i += this.options.chunkSize) {
            chunks.push({
                files: files.slice(i, i + this.options.chunkSize).map(f => f.path),
                index: Math.floor(i / this.options.chunkSize),
                size: Math.min(this.options.chunkSize, files.length - i)
            });
        }
        return chunks;
    }

    private createErrorResult(file: TFile, error: Error): {
        error: ProcessingError;
        result: FileProcessingResult;
    } {
        const errorInfo: ProcessingError = {
            filePath: file.path,
            error: error.message,
            timestamp: Date.now(),
            retryCount: 0
        };

        const result: FileProcessingResult = {
            path: file.path,
            success: false,
            error: error.message,
            processingTime: 0,
            frontMatterGenerated: false,
            wikilinksGenerated: false
        };

        return { error: errorInfo, result };
    }

    private calculateAverageTime(results: FileProcessingResult[]): number {
        if (results.length === 0) return 0;
        const totalTime = results.reduce((sum, r) => sum + r.processingTime, 0);
        return totalTime / results.length;
    }

    private handleProcessingError(error: ProcessingError): void {
        this.currentStatus.errors.push(error);
        this.emitEvent('error', error);
    }

    private async waitForResume(): Promise<void> {
        return new Promise(resolve => {
            const check = () => {
                if (this.currentStatus.state === 'running') {
                    resolve();
                } else {
                    this.processingTimeout = setTimeout(check, 100);
                }
            };
            check();
        });
    }

    private async delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async cleanup(): Promise<void> {
        if (this.processingTimeout) {
            clearTimeout(this.processingTimeout);
        }
        this.currentStatus.state = 'idle';
    }

    // Public methods for external control
    public on(event: keyof ProcessingEvent, callback: (data: any) => void): void {
        this.eventEmitter.on(event, callback);
    }

    public pause(): void {
        if (this.currentStatus.state === 'running') {
            this.currentStatus.state = 'paused';
            this.emitEvent('pause', null);
        }
    }

    public resume(): void {
        if (this.currentStatus.state === 'paused') {
            this.currentStatus.state = 'running';
            this.emitEvent('resume', null);
        }
    }

    private emitEvent(type: keyof ProcessingEvent, data: any): void {
        this.eventEmitter.emit(type, data);
    }

    protected validateInput(input: BatchProcessorInput): boolean {
        return Array.isArray(input.files) && 
               input.files.length > 0 && 
               typeof input.generateFrontMatter === 'boolean' &&
               typeof input.generateWikilinks === 'boolean';
    }

    // Required BaseGenerator methods
    protected preparePrompt(_input: BatchProcessorInput): string {
        return '';
    }

    protected formatOutput(_aiResponse: any, _originalInput: BatchProcessorInput): BatchProcessorOutput {
        return {
            fileResults: [],
            stats: {
                totalFiles: 0,
                processedFiles: 0,
                skippedFiles: 0,
                errorFiles: 0,
                startTime: 0,
                averageProcessingTime: 0
            }
        };
    }
}