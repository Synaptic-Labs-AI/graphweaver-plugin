// src/services/file/FileProcessorService.ts

import { TFile, Notice, App } from 'obsidian';
import { CoreService } from '@services/core/CoreService';
import { LifecycleState } from '@type/base.types';import { ServiceError } from '@services/core/ServiceError';
import { AIService } from '@services/ai/AIService';
import { SettingsService } from '@services/SettingsService';
import { DatabaseService } from '@services/DatabaseService';
import { FileScannerService } from './FileScannerService';
import { GeneratorFactory } from '@services/ai/GeneratorFactory';
import { ProcessingState, ProcessingStateEnum } from '@type/processing.types';
import type { Writable } from 'svelte/store';
import BatchProcessorModal from '@components/modals/BatchProcessorModal.svelte';

/**
 * File processing result interface
 */
export interface FileProcessingResult {
    success: boolean;
    path: string;
    frontMatterGenerated: boolean;
    wikilinksGenerated: boolean;
    processingTime: number;
    error?: string;
}

/**
 * Enhanced FileProcessorService that integrates with Svelte stores
 */
export class FileProcessorService extends CoreService {
    private batchHandler: BatchProcessorModal | null = null;

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
    }

    /**
     * Initialize the service
     */
    protected async initializeInternal(): Promise<void> {
        try {
            // Initialize required components
            if (!this.fileScanner || !this.generatorFactory) {
                throw new Error('Required services not available');
            }
        } catch (error) {
            throw new ServiceError(
                this.serviceName,
                'Failed to initialize file processor',
                error instanceof Error ? error : undefined
            );
        }
    }

    /**
     * Clean up resources
     */
    protected async destroyInternal(): Promise<void> {
        this.batchHandler?.close();
        this.batchHandler = null;
    }

    /**
     * Process a single file with specified options
     */
    public async processSingleFile(
        file: TFile,
        options?: {
            generateFrontMatter?: boolean;
            generateWikilinks?: boolean;
        }
    ): Promise<FileProcessingResult> {
        if (!this.isReady()) {
            throw new ServiceError(this.serviceName, 'Service not ready');
        }

        const startTime = Date.now();
        let frontMatterGenerated = false;
        let wikilinksGenerated = false;

        try {
            const settings = this.settingsService.getSettings();
            const generateFM = options?.generateFrontMatter ?? settings.frontMatter.autoGenerate;
            const generateWL = options?.generateWikilinks ?? settings.advanced.generateWikilinks;

            // Generate front matter if needed
            if (generateFM) {
                const hasFM = await this.fileScanner.hasFrontMatter(file);
                if (!hasFM) {
                    await this.generateFrontMatter(file);
                    frontMatterGenerated = true;
                }
            }

            // Generate wikilinks if enabled
            if (generateWL) {
                const wikilinkResult = await this.generateWikilinks(file);
                wikilinksGenerated = wikilinkResult.success;
            }

            const processingTime = Date.now() - startTime;
            const result: FileProcessingResult = {
                success: true,
                path: file.path,
                frontMatterGenerated,
                wikilinksGenerated,
                processingTime
            };

            await this.handleSuccess(file, result);
            return result;

        } catch (error) {
            const processingTime = Date.now() - startTime;
            this.handleProcessingError('Failed to process file', error);
            
            return {
                success: false,
                path: file.path,
                frontMatterGenerated,
                wikilinksGenerated,
                processingTime,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Generate front matter for a file
     */
    private async generateFrontMatter(file: TFile): Promise<void> {
        const frontMatter = `---
title: ${file.basename}
created: ${new Date().toISOString()}
---
`;
        const content = await this.app.vault.read(file);
        await this.app.vault.modify(file, frontMatter + content);
    }

    /**
     * Generate wikilinks using WikilinkGenerator
     */
    private async generateWikilinks(file: TFile): Promise<{ success: boolean }> {
        try {
            const content = await this.app.vault.read(file);
            const existingPages = this.getExistingPageNames();
            const existingWikilinks = this.extractExistingWikilinks(content);

            // Get and initialize WikilinkGenerator
            const wikilinkGenerator = await this.generatorFactory.getWikilinkGenerator();
            await wikilinkGenerator.initialize();

            // Generate wikilinks
            const result = await wikilinkGenerator.generate({
                content,
                existingPages
            });

            // Update file content
            await this.app.vault.modify(file, result.content);
            return { success: true };
        } catch (error) {
            console.error(`Failed to generate wikilinks for ${file.path}:`, error);
            throw error;
        }
    }

    /**
     * Extract existing wikilinks from content
     */
    private extractExistingWikilinks(content: string): Set<string> {
        const regex = /\[\[([^\]]+)\]\]/g;
        const existingLinks = new Set<string>();
        let match: RegExpExecArray | null;

        while ((match = regex.exec(content)) !== null) {
            const link = match[1].split('|')[0].trim().toLowerCase();
            existingLinks.add(link);
        }

        return existingLinks;
    }

    /**
     * Get existing page names in the vault
     */
    private getExistingPageNames(): string[] {
        return this.app.vault.getMarkdownFiles().map(file => file.basename);
    }

    /**
     * Handle successful processing
     */
    private async handleSuccess(file: TFile, result: FileProcessingResult): Promise<void> {
        await this.databaseService.markFileAsProcessed(file, result);
        
        this.store.update((state: ProcessingState) => ({
            ...state,
            isProcessing: false,
            currentFile: null, // Changed from undefined to null
            progress: 100,
            error: null,      // Changed from undefined to null
            queue: [],
            state: ProcessingStateEnum.IDLE,
            filesQueued: 0,
            filesProcessed: 0,
            filesRemaining: 0,
            errors: [],
            startTime: null,  // Changed from undefined to null
            estimatedTimeRemaining: null // Changed from undefined to null
        }));

        new Notice(`Successfully processed ${file.basename}`);
    }

    /**
     * Handle processing errors with proper overloads
     */
    public handleProcessingError(message: string, error: unknown): void;
    public handleProcessingError(message: string, error: unknown, file?: TFile): void {
        console.error('Processing error:', error);
        
        if (file) {
            new Notice(`Error processing file ${file.path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        this.store.update((state: ProcessingState) => ({
            ...state,
            isProcessing: false,
            currentFile: null, // Changed from undefined to null
            progress: 0,
            error: error instanceof Error ? error.message : 'Unknown error',
            queue: [],
            state: ProcessingStateEnum.ERROR,
            filesQueued: 0,
            filesProcessed: 0,
            filesRemaining: 0,
            errors: [
                ...state.errors,
                {
                    filePath: file?.path || 'unknown',
                    error: error instanceof Error ? error.message : 'Unknown error',
                    timestamp: Date.now(),
                    retryCount: 0
                }
            ],
            startTime: null,
            estimatedTimeRemaining: null
        }));
    }

    /**
     * Open the batch processor modal
     */
    public openBatchProcessor(): void {
        if (!this.isReady()) {
            throw new ServiceError(this.serviceName, 'Service not ready');
        }
    
        this.batchHandler = new BatchProcessorModal({
            target: this.app.workspace.containerEl,
            props: {
                app: this.app,
                settingsService: this.settingsService,
                onClose: () => {
                    this.batchHandler = null;
                }
            }
        });
    }
}