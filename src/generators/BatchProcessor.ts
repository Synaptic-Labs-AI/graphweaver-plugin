// src/generators/BatchProcessor.ts

import { App, TFile } from 'obsidian';
import { CoreService } from '../services/core/CoreService';
import { EventEmitter } from 'events';
import { FileProcessorService } from '../services/file/FileProcessorService';
import { OperationExecutor } from '../services/ai/OperationExecutor';
import { GeneratorFactory } from '../services/ai/GeneratorFactory';
import {
    ProcessingStatus,
    ProcessingState,
    ProcessingEvent,
    ProcessingStats,
    FileProcessingResult,
    ProcessingOptions,
    DEFAULT_PROCESSING_OPTIONS,
} from '../types/ProcessingTypes';
import { OperationType } from '../types/OperationTypes'; // Added import

/**
 * Input interface for batch processing
 */
interface BatchInput {
    files: TFile[];
    generateFrontMatter: boolean;
    generateWikilinks: boolean;
    options?: Partial<ProcessingOptions>;
}

/**
 * Enhanced BatchProcessor that leverages existing services
 */
export class BatchProcessor extends CoreService {
    private readonly eventEmitter: EventEmitter;
    private options: ProcessingOptions;
    private currentStatus: ProcessingStatus;
    private processingTimeout: NodeJS.Timeout | null = null;

    constructor(
        private app: App,
        private fileProcessor: FileProcessorService,
        private operationManager: OperationExecutor, // Updated type
        private generatorFactory: GeneratorFactory
    ) {
        super('batch-processor', 'Batch Processor');
        this.eventEmitter = new EventEmitter();
        this.options = DEFAULT_PROCESSING_OPTIONS;
        this.currentStatus = this.getDefaultStatus();
    }

    /**
     * Initialize the service
     */
    protected async initializeInternal(): Promise<void> {
        try {
            if (!this.fileProcessor || !this.operationManager || !this.generatorFactory) {
                throw new Error('Required services not initialized');
            }

            // Reset status
            this.currentStatus = this.getDefaultStatus();
            
            // Initialize required generators
            await this.generatorFactory.initialize();
            
        } catch (error) {
            this.handleError('Initialization failed', error);
        }
    }

    /**
     * Clean up resources
     */
    protected async destroyInternal(): Promise<void> {
        this.eventEmitter.removeAllListeners();
        if (this.processingTimeout) {
            clearTimeout(this.processingTimeout);
        }
    }

    /**
     * Process files in batch
     */
    public async generate(input: BatchInput): Promise<{
        fileResults: FileProcessingResult[];
        stats: ProcessingStats;
    }> {
        if (!this.validateInput(input)) {
            throw new Error('Invalid batch input');
        }

        const startTime = Date.now();
        this.options = { ...this.options, ...input.options };

        try {
            await this.startProcessing(input.files);
            const results = await this.processFiles(input);
            return {
                fileResults: results,
                stats: await this.finalizeProcessing(results, startTime)
            };
        } catch (error) {
            this.handleError('Batch processing failed', error);
            throw error;
        }
    }

    /**
     * Process individual file with operation tracking
     */
    private async processFile(file: TFile, input: BatchInput): Promise<FileProcessingResult> {
        return this.operationManager.execute(
            OperationType.FrontMatter, // Corrected method
            async () => {
                const result = await this.fileProcessor.processSingleFile(file);
                this.emitEvent('fileComplete', { result });
                return result;
            },
            { filePath: file.path }
        );
    }

    /**
     * Process files in chunks
     */
    private async processFiles(input: BatchInput): Promise<FileProcessingResult[]> {
        const chunks = this.createChunks(input.files);
        const allResults: FileProcessingResult[] = [];

        for (const chunk of chunks) {
            const files = chunk.map(path => 
                this.app.vault.getAbstractFileByPath(path)
            ).filter((file): file is TFile => file instanceof TFile);

            const chunkResults = await Promise.all(
                files.map(file => this.processFile(file, input))
            );

            allResults.push(...chunkResults);
            await this.delay(this.options.delayBetweenChunks);
        }

        return allResults;
    }

    /**
     * Create file chunks for processing
     */
    private createChunks(files: TFile[]): string[][] {
        const chunks: string[][] = [];
        for (let i = 0; i < files.length; i += this.options.chunkSize) {
            chunks.push(
                files
                    .slice(i, i + this.options.chunkSize)
                    .map(f => f.path)
            );
        }
        return chunks;
    }

    /**
     * Start batch processing
     */
    private async startProcessing(files: TFile[]): Promise<void> {
        this.currentStatus = {
            state: ProcessingState.RUNNING,
            filesQueued: files.length,
            filesProcessed: 0,
            filesRemaining: files.length,
            startTime: Date.now(),
            errors: []
        };

        this.emitEvent('start', { totalFiles: files.length });
    }

    /**
     * Finalize processing and calculate stats
     */
    private async finalizeProcessing(
        results: FileProcessingResult[], 
        startTime: number
    ): Promise<ProcessingStats> {
        const successfulFiles = results.filter(r => r.success);
        const stats: ProcessingStats = {
            totalFiles: results.length,
            processedFiles: successfulFiles.length,
            errorFiles: results.length - successfulFiles.length,
            skippedFiles: 0,
            startTime,
            endTime: Date.now(),
            averageProcessingTime: this.calculateAverageTime(successfulFiles)
        };

        this.emitEvent('complete', stats);
        return stats;
    }

    /**
     * Calculate average processing time
     */
    private calculateAverageTime(results: FileProcessingResult[]): number {
        if (results.length === 0) return 0;
        return results.reduce((sum, r) => sum + r.processingTime, 0) / results.length;
    }

    /**
     * Get default status
     */
    private getDefaultStatus(): ProcessingStatus {
        return {
            state: ProcessingState.IDLE,
            filesQueued: 0,
            filesProcessed: 0,
            filesRemaining: 0,
            startTime: 0,
            errors: []
        };
    }

    /**
     * Validate batch input
     */
    private validateInput(input: BatchInput): boolean {
        return Array.isArray(input.files) && 
               input.files.length > 0 && 
               typeof input.generateFrontMatter === 'boolean' &&
               typeof input.generateWikilinks === 'boolean';
    }

    /**
     * Utility delay method
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Event emitter methods
     */
    public on(event: keyof ProcessingEvent, callback: (data: any) => void): void {
        this.eventEmitter.on(event, callback);
    }

    private emitEvent(event: keyof ProcessingEvent, data: any): void {
        this.eventEmitter.emit(event, data);
    }
}
