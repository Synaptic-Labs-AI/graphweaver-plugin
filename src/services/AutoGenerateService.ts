import { App, TFile, Vault, Notice } from 'obsidian';
import { AIService } from './AIService';
import { SettingsService } from './SettingsService';
import { DatabaseService } from './DatabaseService';
import { BatchProcessor } from '../generators/BatchProcessor';
import { 
    ProcessingEvent,
    ProcessingOptions,
    FileProcessingResult,
    ProcessingStats,
    DEFAULT_PROCESSING_OPTIONS
} from '../models/ProcessingTypes';
import { BaseService } from './BaseService';
import { JsonValidationService } from './JsonValidationService';
import { AIProvider } from 'src/models/AIModels';
import { 
    AIAdapter, 
    OpenAIAdapter, 
    AnthropicAdapter, 
    GeminiAdapter, 
    GroqAdapter, 
    OpenRouterAdapter, 
    LMStudioAdapter, 
    PerplexityAdapter,
    MistralAdapter 
} from '../adapters';

/**
 * Enhanced service for automatic content generation during vault startup
 * Handles processing of unprocessed files when vault is first opened
 */
export class AutoGenerateService extends BaseService {
    public batchProcessor: BatchProcessor;
    public isProcessing: boolean = false;
    public isStartupComplete: boolean = false;
    public options: ProcessingOptions = DEFAULT_PROCESSING_OPTIONS;
    public readonly NOTIFICATION_TIMEOUT = 3000;
    adapters: Map<AIProvider, AIAdapter>;
    jsonValidationService: JsonValidationService;

    constructor(
        public app: App,
        public vault: Vault,
        public aiService: AIService,
        public settingsService: SettingsService,
        public databaseService: DatabaseService,
        jsonValidationService: JsonValidationService // Add this parameter
    ) {
        super();
        this.jsonValidationService = jsonValidationService;
        this.initializeBatchProcessor();
    }

    /**
     * Initialize the batch processor and set up event handlers
     */
    public initializeBatchProcessor(): void {
        this.batchProcessor = new BatchProcessor(
            this.aiService.getCurrentAdapter(),
            this.settingsService,
            this.aiService.frontMatterGenerator,
            this.aiService.wikilinkGenerator,
            this.databaseService,
            this.app
        );

        this.setupEventHandlers();
    }

    /**
     * Set up event handlers for processing events
     */
    public setupEventHandlers(): void {
        this.batchProcessor.on('start', () => {
            this.isProcessing = true;
            this.showNotification('Starting vault content analysis...');
        });
    
        this.batchProcessor.on('complete', (stats: ProcessingEvent['complete']) => {
            this.isProcessing = false;
            this.handleProcessingComplete(stats);
        });
    
        this.batchProcessor.on('error', (error: ProcessingEvent['error']) => {
            console.error('Processing error:', error);
            this.showNotification(`Error processing file: ${error.filePath}`, true);
        });
    
        ['progress', 'pause', 'resume', 'error'].forEach(event => {
            this.batchProcessor.on(event as keyof ProcessingEvent, (data) => {
                this.emitter.emit(event, data);  // Changed from eventEmitter to emitter
            });
        });
    }

    /**
     * Start automatic generation process
     * Only runs during initial vault startup
     */
    public async runAutoGenerate(): Promise<void> {
        if (!this.shouldRunAutoGenerate()) {
            return;
        }

        try {
            const unprocessedFiles = await this.getUnprocessedFiles();
            
            if (unprocessedFiles.length === 0) {
                console.log('AutoGenerateService: No files need processing');
                this.completeStartup();
                return;
            }

            await this.processFiles(unprocessedFiles);
            this.completeStartup();

        } catch (error) {
            this.handleError('Error during startup generation process:', error);
            this.completeStartup();
        }
    }

    /**
     * Check if auto-generate should run
     */
    public shouldRunAutoGenerate(): boolean {
        if (this.isStartupComplete) {
            console.log('AutoGenerateService: Startup already completed');
            return false;
        }

        if (this.isProcessing) {
            console.log('AutoGenerateService: Already processing files');
            return false;
        }

        const settings = this.settingsService.getSettings();
        if (!settings.frontMatter.autoGenerate) {
            console.log('AutoGenerateService: Auto-generate is disabled');
            this.completeStartup();
            return false;
        }

        return true;
    }

    /**
     * Mark startup as complete
     */
    public completeStartup(): void {
        this.isStartupComplete = true;
        console.log('AutoGenerateService: Startup processing completed');
    }

    /**
     * Get files that need processing
     */
    public async getUnprocessedFiles(): Promise<TFile[]> {
        const allFiles = this.vault.getMarkdownFiles();
        const needsProcessing = await Promise.all(
            allFiles.map(async file => ({
                file,
                needsProcessing: await this.isUnprocessedFile(file)
            }))
        );

        return needsProcessing
            .filter(result => result.needsProcessing)
            .map(result => result.file);
    }

    /**
     * Check if a file needs processing
     */
    public async isUnprocessedFile(file: TFile): Promise<boolean> {
        try {
            // Skip files being processed
            if (this.isFileBeingProcessed(file)) {
                return false;
            }

            // Skip files that don't need processing
            if (!this.databaseService.needsProcessing(file)) {
                return false;
            }

            const content = await this.vault.read(file);
            
            // Skip files that are too short or empty
            if (content.trim().length < 10) {
                return false;
            }

            // Skip files that already have front matter
            if (content.startsWith('---\n')) {
                return false;
            }

            return true;
        } catch (error) {
            this.handleError(`Error checking file ${file.path}:`, error);
            return false;
        }
    }

    /**
     * Check if a file is currently being processed
     */
    public isFileBeingProcessed(file: TFile): boolean {
        return this.isProcessing;
    }

    /**
     * Process a batch of files
     */
    public async processFiles(files: TFile[]): Promise<void> {
        const settings = this.settingsService.getSettings();
        
        const result = await this.batchProcessor.generate({
            files,
            generateFrontMatter: true,
            // generateWikilinks is now optional and can be omitted
            options: this.options
        });

        await this.updateDatabase(result);
    }

    /**
     * Update database with processing results
     */
    public async updateDatabase(result: { fileResults: FileProcessingResult[] }): Promise<void> {
        // Update database with results
        await Promise.all(result.fileResults.map(fileResult => 
            this.databaseService.markFileAsProcessed(
                this.vault.getAbstractFileByPath(fileResult.path) as TFile,
                fileResult
            )
        ));
    }

    /**
     * Handle processing completion
     */
    public handleProcessingComplete(stats: ProcessingStats): void {
        let message = `Initial vault analysis complete: ${stats.processedFiles} files processed`;
        
        if (stats.errorFiles > 0) {
            message += `, ${stats.errorFiles} errors`;
        }

        if (stats.endTime && stats.startTime) {
            const seconds = Math.round((stats.endTime - stats.startTime) / 1000);
            message += ` in ${seconds}s`;
        }

        this.showNotification(message);
    }

    /**
     * Show notification to user
     */
    public showNotification(message: string, isError: boolean = false): void {
        if (isError) {
            console.error(message);
        }
        new Notice(message, this.NOTIFICATION_TIMEOUT);
    }

    /**
     * Update processing options
     */
    public updateOptions(options: Partial<ProcessingOptions>): void {
        this.options = { ...this.options, ...options };
    }

    /**
     * Clean up resources
     */
    public destroy(): void {
        this.emitter.removeAllListeners();  // Changed from eventEmitter to emitter
        this.isStartupComplete = false;
        this.isProcessing = false;
    }

    /**
     * Initialize the status bar
     * Note: Status bar is now handled by main.ts
     */
    public initializeStatusBar(_statusBarEl: HTMLElement): void {
        return;
    }

    public initializeAdapters(): void {
        this.adapters = new Map<AIProvider, AIAdapter>([
            [AIProvider.OpenAI, new OpenAIAdapter(this.settingsService, this.jsonValidationService)],
            [AIProvider.Anthropic, new AnthropicAdapter(this.settingsService, this.jsonValidationService)],
            [AIProvider.Google, new GeminiAdapter(this.settingsService, this.jsonValidationService)],
            [AIProvider.Groq, new GroqAdapter(this.settingsService, this.jsonValidationService)],
            [AIProvider.OpenRouter, new OpenRouterAdapter(this.settingsService, this.jsonValidationService)],
            [AIProvider.LMStudio, new LMStudioAdapter(this.settingsService, this.jsonValidationService)],
            [AIProvider.Perplexity, new PerplexityAdapter(this.settingsService, this.jsonValidationService)],
            [AIProvider.Mistral, new MistralAdapter(this.settingsService, this.jsonValidationService)],
        ]);
    }
}