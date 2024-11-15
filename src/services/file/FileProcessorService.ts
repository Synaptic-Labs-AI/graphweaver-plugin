// src/services/file/FileProcessorService.ts

import { TFile, Notice, App } from 'obsidian';
import { IService } from '../core/IService';
import { ServiceState } from '../../state/ServiceState';
import { ServiceError } from '../core/ServiceError';
import { BatchProcessorModal } from 'src/components/modals/BatchProcessorModal';
import { StateManager } from '../../managers/StateManager';
import { SettingsService } from '../SettingsService';
import { DatabaseService } from '../DatabaseService';
import { AIService } from '../ai/AIService';
import { FileScannerService } from './FileScannerService';
import { GeneratorFactory } from '../ai/GeneratorFactory';

export class FileProcessorService implements IService {
    public readonly serviceId = 'file-processor';
    public readonly serviceName = 'File Processor Service';
    private serviceState: ServiceState = ServiceState.Uninitialized;
    private serviceError: ServiceError | null = null;
    private batchHandler: any = null; // Replace 'any' with actual type if available
    private readonly generatorFactory: GeneratorFactory;

    constructor(
        private readonly stateManager: StateManager,
        private readonly app: App,
        private readonly aiService: AIService,
        private readonly settingsService: SettingsService,
        private readonly databaseService: DatabaseService,
        private readonly fileScanner: FileScannerService,
        generatorFactory: GeneratorFactory // Inject GeneratorFactory
    ) {
        this.generatorFactory = generatorFactory;
    }

    public async initialize(): Promise<void> {
        try {
            this.serviceState = ServiceState.Initializing;
            // Initialize any required properties or listeners here
            this.serviceState = ServiceState.Ready;
        } catch (error) {
            this.serviceError = error instanceof Error ? 
                new ServiceError(this.serviceName, error.message) : null;
            this.serviceState = ServiceState.Error;
            console.error('FileProcessorService: Initialization failed:', error);
            throw error;
        }
    }

    public async destroy(): Promise<void> {
        // Clean up resources, listeners, etc.
        this.serviceState = ServiceState.Destroyed;
    }

    public isReady(): boolean {
        return this.serviceState === ServiceState.Ready && !this.serviceError;
    }

    public getState(): { state: ServiceState; error: ServiceError | null } {
        return { state: this.serviceState, error: this.serviceError };
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
        const startTime = Date.now();
        let frontMatterGenerated = false;
        let wikilinksGenerated = false;

        try {
            const settings = this.settingsService.getSettings();
            const generateFM = options?.generateFrontMatter ?? settings.frontMatter.autoGenerate;
            const generateWL = options?.generateWikilinks ?? settings.advanced.generateWikilinks;

            // Front Matter Generation
            if (generateFM) {
                const hasFM = await this.fileScanner.hasFrontMatter(file);
                if (!hasFM) {
                    await this.generateFrontMatter(file);
                    frontMatterGenerated = true;
                }
            }

            // Wikilinks Generation using WikilinkGenerator
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
            this.handleProcessingError('Failed to process file', error, file);
            
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

            // Get the WikilinkGenerator instance from the GeneratorFactory
            const wikilinkGenerator = await this.generatorFactory.getWikilinkGenerator();
            await wikilinkGenerator.initialize(); // Ensure the generator is initialized

            // Use the generator to process the content
            const result = await wikilinkGenerator.generate({
                content,
                existingPages
            });

            // Update the file with the new content containing wikilinks
            await this.app.vault.modify(file, result.content);

            return { success: true };
        } catch (error) {
            console.error(`FileProcessorService: Error generating wikilinks for ${file.path}:`, error);
            throw error;
        }
    }

    /**
     * Extract existing wikilinks from content to avoid duplicates
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
        const files = this.app.vault.getMarkdownFiles();
        return files.map(file => file.basename);
    }

    /**
     * Handle successful processing
     */
    public async handleSuccess(file: TFile, result: FileProcessingResult): Promise<void> {
        await this.databaseService.markFileAsProcessed(file, result);
        this.stateManager.update('processing', {
            isProcessing: false,
            currentFile: undefined,
            progress: 100,
            error: undefined
        });
        new Notice(`Successfully processed ${file.basename}`);
    }

    /**
     * Handle processing errors
     */
    public handleProcessingError(message: string, error: unknown, file?: TFile): void {
        console.error('Processing error:', error);
        new Notice(`Error processing file ${file?.path}: ${error instanceof Error ? error.message : 'Unknown error'}`);

        this.stateManager.update('processing', {
            isProcessing: false,
            currentFile: undefined,
            progress: 0,
            error: error instanceof Error ? error.message : 'Unknown error'
        });

        // Emit an event or handle error accordingly
    }

    /**
     * Open the batch processor modal
     */
    public openBatchProcessor(): void {
        new BatchProcessorModal(
            this.app,
            this.aiService,
            this.settingsService
        ).open();
    }
}

/**
 * Interface for file processing results
 */
export interface FileProcessingResult {
    success: boolean;
    path: string;
    frontMatterGenerated: boolean;
    wikilinksGenerated: boolean;
    processingTime: number;
    error?: string;
}
