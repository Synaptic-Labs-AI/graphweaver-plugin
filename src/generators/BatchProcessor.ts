// src/generators/BatchProcessor.ts
import { App, TFile } from 'obsidian';
import { CoreService } from '@services/core/CoreService';
import { EventEmitter } from 'events';
import { BatchHandler } from '@services/file/BatchHandler';
import {
    ProcessingStatus,
    ProcessingState,
    ProcessingStateEnum,
    IProcessingStatusBar,
    ProcessingStats,
    FileProcessingResult,
    ProcessingOptions,
    FileChunk,
    ProcessingError
} from '../types/processing.types';
import { DEFAULT_PROCESSING_OPTIONS } from '@type/constants';

// 🦇 Types for better organization and type safety
interface BatchInput {
    files: string[];
    generateFrontMatter: boolean;
    generateWikilinks: boolean;
    options?: Partial<ProcessingOptions>;
}

/**
 * 🦇 BatchProcessor - Handles batch processing of files with status tracking and event emission
 */
export class BatchProcessor extends EventEmitter {
    // 🎸 Private state management
    private readonly state: {
        status: ProcessingStatus;
        options: ProcessingOptions;
        isProcessing: boolean;
        isPaused: boolean;
        results: FileProcessingResult[];
        startTime: number;
        batchHandler: BatchHandler | null;
    };

    constructor(
        private readonly app: App,
        private readonly coreService: CoreService,
        private readonly statusBar: IProcessingStatusBar
    ) {
        super();
        
        // Initialize state with default values
        const defaultState = this.createInitialProcessingState();
        this.state = {
            status: {
                state: defaultState,
                filesQueued: 0,
                filesProcessed: 0,
                filesRemaining: 0,
                currentFile: undefined, // Changed from null to undefined
                startTime: 0,
                errors: []
            },
            options: { ...DEFAULT_PROCESSING_OPTIONS },
            isProcessing: false,
            isPaused: false,
            results: [],
            startTime: 0,
            batchHandler: null
        };
    }

    // 🎸 Public API Methods
    public async process(input: BatchInput): Promise<ProcessingStats> {
        this.validateInput(input);
        this.initializeProcessing(input);

        try {
            const tfiles = this.getValidFiles(input.files);
            await this.initializeBatchHandler(tfiles, input);
            await this.processBatches(this.state.batchHandler!.createBatches(tfiles));
            return this.generateStats();
        } catch (error) {
            this.handleError(this.normalizeError(error));
            throw error;
        } finally {
            this.cleanup();
        }
    }

    public pause(): void {
        this.state.isPaused = true;
        this.updateStatusAndEmit(ProcessingStateEnum.PAUSED);
    }

    public resume(): void {
        this.state.isPaused = false;
        this.updateStatusAndEmit(ProcessingStateEnum.RUNNING);
    }

    // 🎸 Private Processing Methods
    private async processBatches(batches: TFile[][]): Promise<void> {
        for (const [index, batch] of batches.entries()) {
            await this.processSingleBatch(batch, index, batches.length);
        }
    }

    private async processSingleBatch(batch: TFile[], index: number, total: number): Promise<void> {
        if (this.state.isPaused) {
            await this.waitForResume();
        }

        const batchInfo = { 
            files: batch.map(f => f.path), 
            index, 
            size: batch.length 
        };

        this.emit('chunkStart', batchInfo);
        await this.state.batchHandler!.processBatches([batch]);
        this.emit('chunkComplete', batchInfo);
    }

    private async processFile(file: TFile, input: BatchInput): Promise<void> {
        this.emit('fileStart', { file: file.path });
        
        try {
            const result = await this.executeFileProcessing(file, input);
            this.updateFileProgress(file.path, result);
            this.emit('fileComplete', { result });
        } catch (error) {
            this.handleFileError(file.path, this.normalizeError(error));
        }
    }

    // 🎸 State Management Methods
    private updateStatusAndEmit(newState: ProcessingStateEnum): void {
        this.updateStatus({ 
            state: this.createProcessingState(newState) 
        });
    }

    // 🎸 Create initial processing state without dependencies
    private createInitialProcessingState(): ProcessingState {
        return {
            isProcessing: false,
            currentFile: null,
            queue: [],
            progress: 0,
            state: ProcessingStateEnum.IDLE,
            filesQueued: 0,
            filesProcessed: 0,
            filesRemaining: 0,
            errors: [],
            error: null,
            startTime: null,
            estimatedTimeRemaining: null
        };
    }

    private createProcessingState(state: ProcessingStateEnum): ProcessingState {
        if (!this.state) {
            return this.createInitialProcessingState();
        }

        const { status, isProcessing, startTime } = this.state;
        
        return {
            isProcessing,
            currentFile: status.currentFile || null, // Ensures null when undefined
            queue: [],
            progress: this.calculateProgress(),
            state,
            filesQueued: status.filesQueued,
            filesProcessed: status.filesProcessed,
            filesRemaining: status.filesRemaining,
            errors: status.errors,
            error: null,
            startTime: startTime || null,
            estimatedTimeRemaining: this.calculateETA()
        };
    }

    private updateStatus(update: Partial<ProcessingStatus>): void {
        this.state.status = { ...this.state.status, ...update };
        this.emit('stateChanged', {
            state: this.state.status.state,
            currentFile: this.state.status.currentFile,
            progress: this.calculateProgress(),
            status: this.state.status
        });
    }

    // 🎸 Utility Methods
    private calculateProgress(): number {
        const { filesProcessed, filesQueued } = this.state.status;
        return filesQueued === 0 ? 0 : (filesProcessed / filesQueued) * 100;
    }

    private calculateETA(): number | null {
        const { filesProcessed, filesRemaining } = this.state.status;
        
        if (filesProcessed === 0) return null;
        
        const elapsed = Date.now() - this.state.startTime;
        const averageTimePerFile = elapsed / filesProcessed;
        return averageTimePerFile * filesRemaining;
    }

    private calculateAverageProcessingTime(): number {
        const { results } = this.state;
        if (results.length === 0) return 0;
        
        const totalTime = results.reduce((sum, r) => sum + r.processingTime, 0);
        return totalTime / results.length;
    }

    // 🎸 Initialization Methods
    private initializeStatus(): ProcessingStatus {
        const defaultState = this.createProcessingState(ProcessingStateEnum.IDLE);
        return {
            state: defaultState,
            filesQueued: 0,
            filesProcessed: 0,
            filesRemaining: 0,
            currentFile: undefined,  // Changed from null to undefined
            startTime: 0,
            errors: []
        };
    }

    private initializeProcessing(input: BatchInput): void {
        Object.assign(this.state, {
            isProcessing: true,
            startTime: Date.now(),
            results: [],
            options: { ...this.state.options, ...input.options }
        });

        this.updateStatus({
            state: this.createProcessingState(ProcessingStateEnum.RUNNING),
            filesQueued: input.files.length,
            filesProcessed: 0,
            filesRemaining: input.files.length,
            startTime: this.state.startTime,
            errors: []
        });

        this.emit('start', { status: this.state.status });
    }

    private async initializeBatchHandler(files: TFile[], input: BatchInput): Promise<void> {
        this.state.batchHandler = new BatchHandler(
            async (file: TFile) => this.processFile(file, input),
            this.state.options,
            this.state.options.maxRetries,
            this.state.options.delayBetweenChunks
        );
    }

    // 🎸 Helper Methods
    private async executeFileProcessing(file: TFile, input: BatchInput): Promise<FileProcessingResult> {
        const startTime = Date.now();
        await this.state.batchHandler!.processBatches([[file]]);
        
        return {
            success: true,
            path: file.path,
            frontMatterGenerated: input.generateFrontMatter,
            wikilinksGenerated: input.generateWikilinks,
            processingTime: Date.now() - startTime
        };
    }

    private updateFileProgress(filePath: string, result: FileProcessingResult): void {
        this.state.results.push(result);
        this.state.status.filesProcessed++;
        this.state.status.filesRemaining--;
        
        this.statusBar.updateFromState({
            currentFile: filePath,
            progress: this.calculateProgress(),
            status: this.state.status
        });
    }

    private getValidFiles(filePaths: string[]): TFile[] {
        return filePaths
            .map(path => this.app.vault.getAbstractFileByPath(path))
            .filter((file): file is TFile => file instanceof TFile);
    }

    private validateInput(input: BatchInput): void {
        if (!Array.isArray(input.files) || 
            input.files.length === 0 || 
            typeof input.generateFrontMatter !== 'boolean' ||
            typeof input.generateWikilinks !== 'boolean') {
            throw new Error('Invalid batch input');
        }
    }

    // 🎸 Error Handling Methods
    private normalizeError(error: unknown): Error {
        return error instanceof Error ? error : new Error(String(error));
    }

    private handleError(error: Error): void {
        this.updateStatus({ 
            state: this.createProcessingState(ProcessingStateEnum.ERROR) 
        });
        
        this.emit('error', {
            filePath: this.state.status.currentFile || '',
            error: error.message,
            timestamp: Date.now(),
            retryCount: 0
        });
    }

    private handleFileError(filePath: string, error: Error): void {
        const newError: ProcessingError = {
            filePath,
            error: error.message,
            timestamp: Date.now(),
            retryCount: 0
        };

        this.state.status.errors.push(newError);
        this.emit('error', newError);
    }

    // 🎸 Cleanup and Management Methods
    private cleanup(): void {
        this.state.isProcessing = false;
        this.updateStatus({ 
            state: this.createProcessingState(ProcessingStateEnum.IDLE) 
        });
    }

    private async waitForResume(): Promise<void> {
        return new Promise(resolve => {
            const resumeHandler = () => {
                this.off('resume', resumeHandler);
                resolve();
            };
            this.on('resume', resumeHandler);
        });
    }

    private generateStats(): ProcessingStats {
        const endTime = Date.now();
        return {
            totalFiles: this.state.status.filesQueued,
            processedFiles: this.state.status.filesProcessed,
            skippedFiles: 0,
            errorFiles: this.state.status.errors.length,
            startTime: this.state.startTime,
            endTime,
            averageProcessingTime: this.calculateAverageProcessingTime(),
            timestamp: endTime
        };
    }
}