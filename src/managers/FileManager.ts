// src/managers/FileManager.ts

import { App, TFile, Notice, TAbstractFile } from 'obsidian';
import GraphWeaverPlugin from 'main';
import { IService } from '../services/core/IService';
import { ServiceState } from '../state/ServiceState';
import { ServiceError } from '../services/core/ServiceError';
import { BatchProcessorModal } from '../components/modals/BatchProcessorModal';
import { FileProcessorService } from '../services/file/FileProcessorService';
import { StateManager } from './StateManager';
import { SettingsService } from '../services/SettingsService';
import { DatabaseService } from '../services/DatabaseService';
import { AIService } from '../services/ai/AIService';
import { FileScannerService } from '../services/file/FileScannerService';
import { GeneratorFactory } from '../services/ai/GeneratorFactory';

export class FileManager implements IService {
    // IService implementation
    public readonly serviceId = 'file-manager';
    public readonly serviceName = 'File Manager';
    private serviceState: ServiceState = ServiceState.Uninitialized;
    private serviceError: ServiceError | null = null;
    private unloading = false;

    constructor(
        private plugin: GraphWeaverPlugin,
        private app: App,
        private stateManager: StateManager,
        private settingsService: SettingsService,
        private databaseService: DatabaseService,
        private aiService: AIService,
        private fileProcessor: FileProcessorService,
        private generatorFactory: GeneratorFactory, // Inject GeneratorFactory
        private fileScanner: FileScannerService // Inject FileScannerService
    ) {}

    public async initialize(): Promise<void> {
        try {
            this.serviceState = ServiceState.Initializing;
            this.app.vault.on('create', this.handleFileModify.bind(this));
            this.app.vault.on('modify', this.handleFileModify.bind(this));
            this.serviceState = ServiceState.Ready;
            console.log('FileManager: Initialized.');
        } catch (error) {
            this.serviceError = error instanceof Error ? 
                new ServiceError(this.serviceName, error.message) : null;
            this.serviceState = ServiceState.Error;
            console.error('FileManager: Initialization failed:', error);
            throw error;
        }
    }

    public async destroy(): Promise<void> {
        this.unloading = true;
        this.serviceState = ServiceState.Destroyed;
        // Remove event listeners if any
        console.log('FileManager: Destroyed.');
    }

    public isReady(): boolean {
        return this.serviceState === ServiceState.Ready && !this.unloading;
    }

    public getState(): { state: ServiceState; error: ServiceError | null } {
        return { 
            state: this.serviceState,
            error: this.serviceError
        };
    }

    /**
     * Handle file creation and modification events
     */
    private async handleFileModify(file: TAbstractFile): Promise<void> {
        if (!(file instanceof TFile) || !this.settingsService.getSettings().frontMatter.autoGenerate) {
            return;
        }

        try {
            const hasFrontMatter = await this.fileScanner.hasFrontMatter(file);
            if (!hasFrontMatter) {
                const result = await this.fileProcessor.processSingleFile(file, {
                    generateFrontMatter: true
                });
                new Notice(`Generated front matter for ${file.basename}`);
                console.log(`FileManager: Generated front matter for ${file.path}`);
            }
        } catch (error) {
            console.error('FileManager: Error handling file modification:', error);
            new Notice(`Error processing file ${file.path}`);
        }
    }

    /**
     * Public method to generate front matter for the active file
     */
    public async generateFrontmatter(): Promise<void> {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('No active file. Please open a file to generate frontmatter.');
            return;
        }

        try {
            const result = await this.fileProcessor.processSingleFile(activeFile, {
                generateFrontMatter: true
            });

            if (result.success) {
                new Notice('Frontmatter generated successfully!');
                console.log(`FileManager: Frontmatter generated for ${activeFile.path}`);
            } else if (result.error) {
                new Notice(`Error: ${result.error}`);
                console.error(`FileManager: Error generating frontmatter for ${activeFile.path}:`, result.error);
            }
        } catch (error) {
            console.error('FileManager: Error generating frontmatter:', error);
            new Notice('Failed to generate frontmatter');
        }
    }

    /**
     * Public method to generate wikilinks for the active file
     */
    public async generateWikilinks(): Promise<void> {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('No active file. Please open a file to generate wikilinks.');
            return;
        }

        try {
            const result = await this.fileProcessor.processSingleFile(activeFile, {
                generateWikilinks: true
            });

            if (result.success) {
                new Notice('Wikilinks generated successfully!');
                console.log(`FileManager: Wikilinks generated for ${activeFile.path}`);
            } else if (result.error) {
                new Notice(`Error: ${result.error}`);
                console.error(`FileManager: Error generating wikilinks for ${activeFile.path}:`, result.error);
            }
        } catch (error) {
            console.error('FileManager: Error generating wikilinks:', error);
            new Notice('Failed to generate wikilinks');
        }
    }

    /**
     * Public method to generate Knowledge Bloom for the active file
     */
    public async generateKnowledgeBloom(): Promise<void> {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('No active file. Please open a file to generate Knowledge Bloom.');
            return;
        }

        try {
            const generationService = this.aiService.getGenerationService();
            const result = await generationService.generateKnowledgeBloom(activeFile);

            for (const note of result.generatedNotes) {
                const filePath = `${note.title}.md`;
                const existingFile = this.app.vault.getAbstractFileByPath(filePath);

                if (existingFile instanceof TFile) {
                    await this.app.vault.modify(existingFile, note.content);
                } else {
                    await this.app.vault.create(filePath, note.content);
                }
            }

            new Notice(`Generated ${result.generatedNotes.length} new notes!`);
            console.log(`FileManager: Generated ${result.generatedNotes.length} new notes for ${activeFile.path}`);
        } catch (error) {
            console.error('FileManager: Error generating Knowledge Bloom:', error);
            new Notice('Failed to generate Knowledge Bloom');
        }
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
