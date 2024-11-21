// src/managers/FileManager.ts

import { App, TFile, TAbstractFile } from 'obsidian';
import { v4 as uuidv4 } from 'uuid'; // Ensure to install uuid: npm install uuid @types/uuid
import GraphWeaverPlugin from '../../main';
import { IService } from '@services/core/IService';
import { LifecycleState } from '@type/base.types';import { ServiceError } from '@services/core/ServiceError';
import BatchProcessorModal from '@components/modals/BatchProcessorModal.svelte';
import { FileProcessorService } from '@services/file/FileProcessorService';
import { SettingsService } from '@services/SettingsService';
import { DatabaseService } from '@services/DatabaseService';
import { AIService } from '@services/ai/AIService';
import { FileScannerService } from '@services/file/FileScannerService';
import { GeneratorFactory } from '@services/ai/GeneratorFactory';
import { processingStore } from '@stores/ProcessingStore';
import { uiStore } from '@stores/UIStore';
import type { Notification } from '@type/store.types';

export class FileManager implements IService {
    public readonly serviceId = 'file-manager';
    public readonly serviceName = 'File Manager';
    private serviceState: ServiceState = ServiceState.Uninitialized;
    private serviceError: ServiceError | null = null;
    private unloading = false;

    constructor(
        private plugin: GraphWeaverPlugin,
        private app: App,
        private settingsService: SettingsService,
        private databaseService: DatabaseService,
        private aiService: AIService,
        private fileProcessor: FileProcessorService,
        private generatorFactory: GeneratorFactory,
        private fileScanner: FileScannerService
    ) {}

    private createNotification(message: string, type: Notification['type']): Notification {
        return {
            id: uuidv4(),
            message,
            type,
            timestamp: Date.now()
        };
    }

    public async initialize(): Promise<void> {
        try {
            this.serviceState = ServiceState.Initializing;
            this.app.vault.on('create', this.handleFileModify.bind(this) as (...args: unknown[]) => unknown);
            this.app.vault.on('modify', this.handleFileModify.bind(this) as (...args: unknown[]) => unknown);
            this.serviceState = ServiceState.Ready;
        } catch (error) {
            this.serviceError = error instanceof Error ? 
                new ServiceError(this.serviceName, error.message) : null;
            this.serviceState = ServiceState.Error;
            throw error;
        }
    }

    public async destroy(): Promise<void> {
        this.unloading = true;
        this.app.vault.off('create', this.handleFileModify.bind(this) as (...args: unknown[]) => unknown);
        this.app.vault.off('modify', this.handleFileModify.bind(this) as (...args: unknown[]) => unknown);
        this.serviceState = ServiceState.Destroyed;
    }

    public isReady(): boolean {
        return this.serviceState === ServiceState.Ready && !this.unloading;
    }

    public getState(): { state: ServiceState; error: ServiceError | null } {
        return { state: this.serviceState, error: this.serviceError };
    }

    private async handleFileModify(file: TAbstractFile): Promise<void> {
        if (!(file instanceof TFile) || !this.settingsService.getSettings().frontMatter.autoGenerate) {
            return;
        }

        try {
            const hasFrontMatter = await this.fileScanner.hasFrontMatter(file);
            if (!hasFrontMatter) {
                processingStore.startProcessing(file.path);
                const result = await this.fileProcessor.processSingleFile(file, {
                    generateFrontMatter: true
                });
                processingStore.completeFile(file.path);
                uiStore.addNotification(this.createNotification(
                    `Generated front matter for ${file.basename}`,
                    'success'
                ));
            }
        } catch (error) {
            processingStore.setError(error instanceof Error ? error.message : 'Unknown error');
            uiStore.addNotification(this.createNotification(
                `Error processing file ${file.path}`,
                'error'
            ));
        }
    }

    public async generateFrontmatter(): Promise<void> {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            uiStore.addNotification(this.createNotification(
                'No active file. Please open a file to generate frontmatter.',
                'warning'
            ));
            return;
        }

        try {
            processingStore.startProcessing(activeFile.path);
            const result = await this.fileProcessor.processSingleFile(activeFile, {
                generateFrontMatter: true
            });

            processingStore.completeFile(activeFile.path);
            uiStore.addNotification(this.createNotification(
                result.success ? 'Frontmatter generated successfully!' : `Error: ${result.error}`,
                result.success ? 'success' : 'error'
            ));
        } catch (error) {
            processingStore.setError(error instanceof Error ? error.message : 'Unknown error');
            uiStore.addNotification(this.createNotification(
                'Failed to generate frontmatter',
                'error'
            ));
        }
    }

    public async generateWikilinks(): Promise<void> {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            uiStore.addNotification(this.createNotification(
                'No active file. Please open a file to generate wikilinks.',
                'warning'
            ));
            return;
        }

        try {
            processingStore.startProcessing(activeFile.path);
            const result = await this.fileProcessor.processSingleFile(activeFile, {
                generateWikilinks: true
            });

            processingStore.completeFile(activeFile.path);
            uiStore.addNotification(this.createNotification(
                result.success ? 'Wikilinks generated successfully!' : `Error: ${result.error}`,
                result.success ? 'success' : 'error'
            ));
        } catch (error) {
            processingStore.setError(error instanceof Error ? error.message : 'Unknown error');
            uiStore.addNotification(this.createNotification(
                'Failed to generate wikilinks',
                'error'
            ));
        }
    }

    public async generateKnowledgeBloom(): Promise<void> {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            uiStore.addNotification(this.createNotification(
                'No active file. Please open a file to generate Knowledge Bloom.',
                'warning'
            ));
            return;
        }

        try {
            processingStore.startProcessing(activeFile.path);
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

            processingStore.completeFile(activeFile.path);
            uiStore.addNotification(this.createNotification(
                `Generated ${result.generatedNotes.length} new notes!`,
                'success'
            ));
        } catch (error) {
            processingStore.setError(error instanceof Error ? error.message : 'Unknown error');
            uiStore.addNotification(this.createNotification(
                'Failed to generate Knowledge Bloom',
                'error'
            ));
        }
    }

    public openBatchProcessor(): void {
        uiStore.pushModal('batch-processor');
        new BatchProcessorModal({
            target: document.body,
            props: {
                app: this.app,
                aiService: this.aiService,
                settingsService: this.settingsService,
                onClose: () => {
                    uiStore.popModal();
                }
            }
        });
    }
}