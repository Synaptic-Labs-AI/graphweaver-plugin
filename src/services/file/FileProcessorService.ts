// src/services/file/FileProcessorService.ts
import { TFile, Notice, App } from 'obsidian';
import { CoreService } from '@services/core/CoreService';
import { LifecycleState } from '@type/base.types';
import { ServiceError } from '@services/core/ServiceError';
import { AIService } from '@services/ai/AIService';
import { SettingsService } from '@services/SettingsService';
import { DatabaseService } from '@services/DatabaseService';
import { FileScannerService } from './FileScannerService';
import { GeneratorFactory } from '@services/ai/GeneratorFactory';
import { 
    ProcessingState, 
    ProcessingStateEnum,
    ProcessingOptions,
    ProcessingStats,
    FileProcessingResult,
    FileChunk,
    IProcessingStatusBar
} from '@type/processing.types';
import type { Writable } from 'svelte/store';
import { get } from 'svelte/store';

export class FileProcessorService extends CoreService {
    private static instance: FileProcessorService | null = null;
    private isInitializing = false;
    private initializationError: Error | null = null;
    private processingQueue: string[] = [];
    private activeChunks: Map<number, FileChunk> = new Map();
    private statusBar?: IProcessingStatusBar;
    private processingStats: ProcessingStats = {
        totalFiles: 0,
        processedFiles: 0,
        skippedFiles: 0,
        errorFiles: 0,
        startTime: 0,
        averageProcessingTime: 0
    };

    // Default processing options
    private options: ProcessingOptions = {
        chunkSize: 10,
        delayBetweenChunks: 1000,
        maxRetries: 3,
        generateFrontMatter: true,
        generateWikilinks: true,
        maxConcurrentProcessing: 3
    };

    constructor(
        private readonly app: App,
        private readonly aiService: AIService,
        private readonly settingsService: SettingsService,
        private readonly databaseService: DatabaseService,
        private readonly fileScanner: FileScannerService,
        private readonly generatorFactory: GeneratorFactory,
        private readonly store: Writable<ProcessingState>
    ) {
        super('file-processor', 'File Processor Service');
        
        // Ensure singleton pattern
        if (FileProcessorService.instance) {
            console.log('🦇 FileProcessorService: Returning existing instance');
            return FileProcessorService.instance;
        }

        this.state = LifecycleState.Uninitialized;
        FileProcessorService.instance = this;
        console.log('🦇 FileProcessorService: Created new instance with state:', this.state);
    }

    public override isReady(): boolean {
        const dependencyStates = {
            aiService: this.aiService?.isReady(),
            settingsService: this.settingsService?.isReady(),
            fileScanner: this.fileScanner?.isReady(),
            generatorFactory: this.generatorFactory?.isReady(),
            databaseService: this.databaseService?.isReady()
        };

        const allDependenciesReady = Object.values(dependencyStates).every(state => state === true);
        const storeInitialized = get(this.store) !== undefined;

        console.log('🦇 FileProcessorService.isReady check:', {
            serviceState: this.state,
            isInitializing: this.isInitializing,
            hasError: this.initializationError !== null,
            dependencyStates,
            allDependenciesReady,
            storeInitialized
        });

        return (
            this.state === LifecycleState.Ready &&
            !this.isInitializing &&
            this.initializationError === null &&
            allDependenciesReady &&
            storeInitialized
        );
    }

    protected async initializeInternal(): Promise<void> {
        if (this.isInitializing) {
            console.log('🦇 FileProcessorService: Already initializing, waiting...');
            while (this.isInitializing) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return;
        }

        try {
            console.log('🦇 FileProcessorService: Starting initialization...');
            this.isInitializing = true;
            this.state = LifecycleState.Initializing;

            // Add dependency validation first
            const dependencies = [
                { service: this.aiService, name: 'AIService' },
                { service: this.settingsService, name: 'SettingsService' },
                { service: this.fileScanner, name: 'FileScannerService' },
                { service: this.generatorFactory, name: 'GeneratorFactory' },
                { service: this.databaseService, name: 'DatabaseService' }
            ];

            // Validate all dependencies exist
            for (const { service, name } of dependencies) {
                console.log(`🦇 FileProcessorService: Checking dependency ${name}...`);
                if (!service) {
                    throw new Error(`Required dependency ${name} not provided`);
                }
            }

            // Wait for all dependencies to be ready
            console.log('🦇 FileProcessorService: Waiting for dependencies...');
            await this.waitForDependencies();

            // Initialize store with default state
            console.log('🦇 FileProcessorService: Initializing store...');
            this.initializeStore();

            // Load settings
            console.log('🦇 FileProcessorService: Loading settings...');
            await this.loadProcessingOptions();

            console.log('🦇 FileProcessorService: Setting ready state...');
            this.state = LifecycleState.Ready;
            this.isInitializing = false;
            this.initializationError = null;

            // Verify ready state
            console.log('🦇 FileProcessorService: Verifying ready state...');
            if (!this.isReady()) {
                throw new Error('Service failed to reach ready state after initialization');
            }

            console.log('🦇 FileProcessorService: Initialization complete');

        } catch (error) {
            console.error('🦇 FileProcessorService: Initialization failed:', error);
            this.handleInitializationError(error);
            throw error;
        } finally {
            this.isInitializing = false;
        }
    }

    private async waitForDependencies(): Promise<void> {
        const dependencies = [
            { service: this.aiService, name: 'AIService' },
            { service: this.settingsService, name: 'SettingsService' },
            { service: this.fileScanner, name: 'FileScannerService' },
            { service: this.generatorFactory, name: 'GeneratorFactory' }
        ];

        for (const { service, name } of dependencies) {
            await this.waitForDependency(service, name);
        }
    }

    private async waitForDependency(service: { isReady: () => boolean }, name: string): Promise<void> {
        console.log(`🦇 FileProcessorService: Waiting for ${name}...`);
        const timeout = 30000;
        const startTime = Date.now();
        let lastLog = 0;

        while (!service.isReady()) {
            const now = Date.now();
            if (now - lastLog >= 5000) { // Log every 5 seconds
                console.log(`🦇 FileProcessorService: Still waiting for ${name}... (${Math.round((now - startTime)/1000)}s)`);
                lastLog = now;
            }

            if (now - startTime > timeout) {
                throw new Error(`Timeout waiting for ${name} to be ready`);
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log(`🦇 FileProcessorService: ${name} is ready`);
    }

    private initializeStore(): void {
        const initialState: ProcessingState = {
            isProcessing: false,
            currentFile: null,
            progress: 0,
            error: null,
            queue: [],
            state: ProcessingStateEnum.IDLE,
            filesQueued: 0,
            filesProcessed: 0,
            filesRemaining: 0,
            errors: [],
            startTime: null,
            estimatedTimeRemaining: null
        };

        this.store.set(initialState);
        
        // Verify store initialization
        const state = get(this.store);
        if (!state) {
            throw new Error('Failed to initialize processing state store');
        }
    }

    private async loadProcessingOptions(): Promise<void> {
        const settings = this.settingsService.getSettings();
        this.options = {
            ...this.options,
            generateFrontMatter: settings.frontMatter.autoGenerate,
            generateWikilinks: settings.advanced.generateWikilinks,
            maxConcurrentProcessing: settings.advanced.maxConcurrentProcessing,
            chunkSize: settings.advanced.batchSize,
            delayBetweenChunks: settings.advanced.delayBetweenChunks,
            maxRetries: settings.advanced.maxRetries
        };
    }

    public setStatusBar(statusBar: IProcessingStatusBar): void {
        this.statusBar = statusBar;
    }

    public async processSingleFile(
        file: TFile,
        options?: Partial<ProcessingOptions>
    ): Promise<FileProcessingResult> {
        if (!this.isReady()) {
            throw new ServiceError(this.serviceName, 'Service not ready');
        }

        const startTime = Date.now();
        let result: FileProcessingResult = {
            success: false,
            path: file.path,
            frontMatterGenerated: false,
            wikilinksGenerated: false,
            processingTime: 0
        };

        try {
            this.updateProcessingState({
                isProcessing: true,
                currentFile: file.path,
                state: ProcessingStateEnum.RUNNING
            });

            result = await this.processFile(file, options);
            await this.handleProcessingResult(result);

            return result;
        } catch (error) {
            result = this.createErrorResult(file, error, startTime);
            await this.handleProcessingError(error, file);
            return result;
        } finally {
            this.updateProcessingStats(result);
            this.updateStatusBar(file.path);
        }
    }

    private async processFile(
        file: TFile,
        options?: Partial<ProcessingOptions>
    ): Promise<FileProcessingResult> {
        const startTime = Date.now();
        const processOptions = { ...this.options, ...options };
        let frontMatterGenerated = false;
        let wikilinksGenerated = false;

        try {
            // Generate front matter if needed
            if (processOptions.generateFrontMatter) {
                const hasFM = await this.fileScanner.hasFrontMatter(file);
                if (!hasFM) {
                    await this.generateFrontMatter(file);
                    frontMatterGenerated = true;
                }
            }

            // Generate wikilinks if enabled
            if (processOptions.generateWikilinks) {
                const wikilinkResult = await this.generateWikilinks(file);
                wikilinksGenerated = wikilinkResult.success;
            }

            return {
                success: true,
                path: file.path,
                frontMatterGenerated,
                wikilinksGenerated,
                processingTime: Date.now() - startTime
            };

        } catch (error) {
            throw new ServiceError(
                this.serviceName,
                `Failed to process file ${file.path}`,
                error instanceof Error ? error : undefined
            );
        }
    }

    private async generateFrontMatter(file: TFile): Promise<void> {
        const frontMatter = `---
title: ${file.basename}
created: ${new Date().toISOString()}
---
`;
        const content = await this.app.vault.read(file);
        await this.app.vault.modify(file, frontMatter + content);
    }

    private async generateWikilinks(file: TFile): Promise<{ success: boolean }> {
        const wikilinkGenerator = await this.generatorFactory.getWikilinkGenerator();
        await wikilinkGenerator.initialize();

        const content = await this.app.vault.read(file);
        const existingPages = this.app.vault.getMarkdownFiles().map(f => f.basename);
        
        const result = await wikilinkGenerator.generate({
            content,
            existingPages
        });

        await this.app.vault.modify(file, result.content);
        return { success: true };
    }

    private handleInitializationError(error: unknown): void {
        this.initializationError = error instanceof Error ? error : new Error('Unknown error');
        this.state = LifecycleState.Error;
        this.isInitializing = false;

        console.error('🦇 FileProcessorService: Initialization failed:', error);
        throw new ServiceError(
            this.serviceName,
            'Failed to initialize file processor',
            error instanceof Error ? error : undefined
        );
    }

    private async handleProcessingResult(result: FileProcessingResult): Promise<void> {
        await this.databaseService.markFileAsProcessed({ path: result.path } as TFile, result);
        
        if (result.success) {
            new Notice(`Successfully processed ${result.path}`);
        }
    }

    private createErrorResult(file: TFile, error: unknown, startTime: number): FileProcessingResult {
        return {
            success: false,
            path: file.path,
            frontMatterGenerated: false,
            wikilinksGenerated: false,
            processingTime: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }

    private async handleProcessingError(error: unknown, file?: TFile): Promise<void> {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('🦇 Processing error:', error);
        
        if (file) {
            new Notice(`Error processing file ${file.path}: ${errorMessage}`);
        }

        this.updateProcessingState({
            isProcessing: false,
            currentFile: null,
            state: ProcessingStateEnum.ERROR,
            error: errorMessage
        });
    }

    private updateProcessingState(update: Partial<ProcessingState>): void {
        this.store.update(state => ({
            ...state,
            ...update
        }));
    }

    private updateProcessingStats(result: FileProcessingResult): void {
        this.processingStats.processedFiles++;
        if (!result.success) {
            this.processingStats.errorFiles++;
        }
        
        // Update average processing time
        const totalTime = this.processingStats.averageProcessingTime * (this.processingStats.processedFiles - 1);
        this.processingStats.averageProcessingTime = 
            (totalTime + result.processingTime) / this.processingStats.processedFiles;
    }

    private updateStatusBar(currentFile: string): void {
        if (!this.statusBar) return;

        const state = get(this.store);
        this.statusBar.updateFromState({
            currentFile: currentFile || null,
            progress: (state.filesProcessed / state.filesQueued) * 100,
            status: {
                state,
                filesQueued: state.filesQueued,
                filesProcessed: state.filesProcessed,
                filesRemaining: state.filesRemaining,
                currentFile: currentFile || undefined,
                errors: state.errors,
                startTime: state.startTime || undefined,
                estimatedTimeRemaining: state.estimatedTimeRemaining || undefined
            }
        });
    }

    protected async destroyInternal(): Promise<void> {
        try {
            this.processingQueue = [];
            this.activeChunks.clear();
            this.initializeStore();
            console.log('🦇 FileProcessorService: Cleanup complete');
            FileProcessorService.instance = null;
        } catch (error) {
            console.error('🦇 FileProcessorService: Error during cleanup:', error);
        }
    }
}