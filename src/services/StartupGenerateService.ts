// File: src/services/StartupGenerateService.ts

import { TFile, Notice, App } from 'obsidian';
import { AIService } from './ai/AIService';
import { SettingsService } from './SettingsService';
import { DatabaseService } from './DatabaseService';
import { BatchProcessor } from '../generators/BatchProcessor';
import { StateManager } from '../managers/StateManager';
import { 
    StartupStateManager, 
    StartupState,
    StartupStateEvents 
} from '../managers/startup/StartupStateManager';
import { FileQueueManager } from '../managers/startup/FileQueueManager';
import { StartupConfigManager, StartupGenerateConfig } from '../managers/startup/StartupConfigManager';
import { FileProcessorService } from './file/FileProcessorService';
import { FileScannerService } from './file/FileScannerService';
import { ServiceManager } from '../managers/ServiceManager';

/**
 * Coordinates the startup content generation process using specialized managers
 */
export class StartupGenerateService {
    public isInitialLoad: boolean = true;

    private stateManager: StartupStateManager;
    private queueManager: FileQueueManager;
    private configManager: StartupConfigManager;
    private completionTimeout?: number;
    private isUnloading: boolean = false;
    private fileProcessor: FileProcessorService;
    private fileScanner: FileScannerService

    constructor(
        private app: App,
        private aiService: AIService,
        private settingsService: SettingsService,
        private databaseService: DatabaseService,
        private batchProcessor: BatchProcessor,
        private persistentStateManager: StateManager,
        private serviceManager: ServiceManager, // Added to retrieve services
        config: Partial<StartupGenerateConfig> = {}
    ) {
        // Initialize managers
        this.stateManager = new StartupStateManager();
        this.queueManager = new FileQueueManager();
        this.configManager = new StartupConfigManager(config);

        // Retrieve FileProcessorService from ServiceManager
        this.fileProcessor = this.serviceManager.getService<FileProcessorService>('file-processor');

        this.setupInitialState();
    }

    /**
     * Setup initial state and completion timeout
     */
    private setupInitialState(): void {
        if (this.isUnloading) return;

        this.stateManager.setState(StartupState.Initializing);
        const config = this.configManager.getConfig();

        this.completionTimeout = window.setTimeout(() => {
            if (this.shouldRunAutoGenerate()) {
                this.completeStartup();
            }
        }, config.startupDelay);
    }

    /**
     * Run startup generation process
     */
    public async runStartupGenerate(): Promise<void> {
        if (this.isUnloading) return;

        try {
            if (!this.validateServices()) {
                throw new Error('Required services not initialized');
            }

            if (!this.shouldRunAutoGenerate()) {
                this.completeStartup();
                return;
            }

            // Scan files
            this.stateManager.setState(StartupState.Scanning);
            const filesToProcess = await this.scanVaultFiles();

            if (filesToProcess.length > 0) {
                await this.processFiles(filesToProcess);
            } else {
                this.completeStartup();
            }
        } catch (error) {
            this.handleError('Startup generation failed:', error);
            this.stateManager.setState(StartupState.Error);
        }
    }

    /**
     * Scan vault for files needing processing
     */
    private async scanVaultFiles(): Promise<TFile[]> {
        const allFiles = this.app.vault.getMarkdownFiles();

        const filesToProcess: TFile[] = [];
        let processedCount = 0;

        for (const file of allFiles) {
            if (await this.shouldProcessFile(file)) {
                filesToProcess.push(file);
            }

            processedCount++;
            this.stateManager.emitProgress(processedCount, allFiles.length);
        }

        return filesToProcess;
    }

    /**
     * Process files using BatchProcessor
     */
    private async processFiles(files: TFile[]): Promise<void> {
        if (this.isUnloading) return;

        this.stateManager.setState(StartupState.Processing);

        try {
            await this.batchProcessor.generate({
                files,
                generateFrontMatter: true,
                generateWikilinks: true
            });
        } catch (error) {
            this.handleError('Error processing files:', error);
        } finally {
            this.completeStartup();
        }
    }

    /**
     * Check if file should be processed based on existing front matter
     */
    private async shouldProcessFile(file: TFile): Promise<boolean> {
        if (this.isUnloading) return false;

        try {
            const hasFrontMatter = await this.fileScanner.hasFrontMatter(file);
            return !hasFrontMatter;
        } catch (error) {
            this.handleError(`Error checking file ${file.path}:`, error);
            return false;
        }
    }

    /**
     * Check if auto-generate should run
     */
    private shouldRunAutoGenerate(): boolean {
        if (this.isUnloading) return false;

        return this.settingsService.getSettings().frontMatter.autoGenerate &&
               this.stateManager.getState() !== StartupState.Completed;
    }

    /**
     * Validate required services
     */
    private validateServices(): boolean {
        return !!(
            this.fileProcessor &&
            this.settingsService &&
            this.databaseService &&
            this.aiService &&
            this.batchProcessor
        );
    }

    /**
     * Complete startup process
     */
    private completeStartup(): void {
        if (this.isUnloading) return;

        if (this.completionTimeout) {
            clearTimeout(this.completionTimeout);
            this.completionTimeout = undefined;
        }

        this.stateManager.setState(StartupState.Completed);
        this.stateManager.emitEvent('completed');
    }

    /**
     * Handle errors consistently
     */
    private handleError(message: string, error: unknown): void {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(message, error);

        if (error instanceof Error) {
            this.stateManager.emitEvent('error', error);
        }

        if (!this.isUnloading) {
        }
    }

    /**
     * Get current startup state
     */
    public getCurrentState(): StartupState {
        return this.stateManager.getState();
    }

    /**
     * Subscribe to state events with proper typing
     */
    public on<K extends keyof StartupStateEvents>(
        event: K,
        callback: StartupStateEvents[K]
    ): void {
        if (!this.isUnloading) {
            this.stateManager.on(event, callback);
        }
    }

    /**
     * Clean up resources
     */
    public destroy(): void {
        this.isUnloading = true;

        if (this.completionTimeout) {
            clearTimeout(this.completionTimeout);
            this.completionTimeout = undefined;
        }

        this.stateManager.destroy();
        this.queueManager.destroy();
        this.configManager.destroy();
    }
}
