// main.ts

import { Plugin, App, Notice } from 'obsidian';
import { ServiceManager } from './src/managers/ServiceManager';
import { InitializationManager } from './src/managers/InitializationManager';
import { EventManager } from './src/managers/EventManager';
import { ErrorManager } from './src/managers/ErrorManager';
import { AIService } from './src/services/ai/AIService';
import { DatabaseService } from './src/services/DatabaseService';
import { SettingsService } from './src/services/SettingsService';
import { FileManager } from './src/managers/FileManager';
import { PersistentStateManager } from './src/managers/StateManager';
import { BatchProcessor } from './src/generators/BatchProcessor';
import { JsonValidationService } from './src/services/JsonValidationService';
import { FileProcessorService } from './src/services/file/FileProcessorService';
import { FileScannerService } from './src/services/file/FileScannerService';
import { AIOperationManager } from './src/services/ai/AIOperationManager';
import { AdapterRegistry } from './src/services/ai/AdapterRegistry';
import { GeneratorFactory } from './src/services/ai/GeneratorFactory';
import { MetricsTracker } from './src/services/ai/MetricsTracker';
import { OperationEventEmitter } from './src/services/ai/OperationEventEmitter';
import { QueueManagerService } from './src/services/ai/QueueManagerService';
import { GraphWeaverSettingTab } from 'src/settings/GraphWeaverSettingTab';
import { UIManager } from 'src/managers/UIManager';
import { WikilinkTextProcessor } from 'src/services/WikilinkTextProcessor';

/**
 * Main plugin class handling initialization and lifecycle management
 */
export default class GraphWeaverPlugin extends Plugin {
    private initManager: InitializationManager;
    private serviceManager: ServiceManager;
    private eventManager: EventManager;
    private errorManager: ErrorManager;
    private jsonValidationService: JsonValidationService;
    private uiManager?: UIManager;
    private wikilinkProcessor: WikilinkTextProcessor;

    constructor(app: App, manifest: any) {
        super(app, manifest);

        // Initialize core utilities
        this.errorManager = new ErrorManager();
        this.serviceManager = new ServiceManager(this.app);
        this.eventManager = new EventManager(app);
        this.jsonValidationService = new JsonValidationService();

        // Initialize manager after core services
        this.initManager = new InitializationManager(
            this,
            this.app,
            this.serviceManager,
            this.errorManager
        );
    }

    async onload(): Promise<void> {
        try {
            this.eventManager.register('layout-ready', this.handleLayoutReady.bind(this));
            this.app.workspace.containerEl.addClass('graphweaver-plugin');
            await this.registerServices(); // Only registering services here

            // UIManager will be initialized in handleLayoutReady

        } catch (error) {
            console.error('Failed to load plugin:', error);
        }
    }

    /**
     * Register all services in dependency order
     */
    private async registerServices(): Promise<void> {
        try {

            // Level 1: Core Services (no dependencies)
            this.registerStateManager();
            this.registerDatabaseService();
            this.registerFileScannerService();
            this.registerWikilinkTextProcessor();

            // Level 2: Services dependent on core
            this.registerSettingsService();

            // Level 3: AI Infrastructure
            await this.registerAIInfrastructure();

            // Level 4: File Processing
            await this.registerFileProcessingServices();

            // Level 5: High-level Services
            await this.registerHighLevelServices();

            // Level 6: Generator Factory
            // Removed the call to registerGeneratorFactory() as it's already handled in registerAIInfrastructure()

        } catch (error) {
            console.error('Service registration failed:', error);
            throw error;
        }
    }

    /**
     * Register core database service
     */
    private registerDatabaseService(): void {
        this.serviceManager.registerService({
            id: 'database',
            type: 'factory',
            factory: () => new DatabaseService(
                async () => {
                    const data = await this.loadData();
                    return data?.database || null;
                },
                async (data) => {
                    const currentData = await this.loadData() || {};
                    await this.saveData({ ...currentData, database: data });
                }
            ),
            dependencies: ['state'], // Added 'state' as a dependency
        });
    }

    /**
     * Register state management service
     */
    private registerStateManager(): void {
        this.serviceManager.registerService({
            id: 'state',
            type: 'factory',
            factory: () => new PersistentStateManager(
                undefined,
                'graphweaver_state'
            ),
        });
    }

    /**
     * Register settings service
     */
    private registerSettingsService(): void {
        this.serviceManager.registerService({
            id: 'settings',
            type: 'factory',
            factory: () => new SettingsService(this),
            dependencies: ['database', 'state'],
        });
    }

    /**
     * Register file scanner service
     */
    private registerFileScannerService(): void {
        this.serviceManager.registerService({
            id: 'file-scanner',
            type: 'factory',
            factory: () => new FileScannerService(this.app.vault),
        });
    }

    /**
     * Register WikilinkTextProcessor service
     */
    private registerWikilinkTextProcessor(): void {
        this.serviceManager.registerService({
            id: 'wikilink-text-processor',
            type: 'factory',
            factory: () => new WikilinkTextProcessor(),
        });
    }

    /**
     * Register AI infrastructure services
     */
    private async registerAIInfrastructure(): Promise<void> {
        // Register Metrics Tracker
        this.serviceManager.registerService({
            id: 'metrics-tracker',
            type: 'factory',
            factory: () => new MetricsTracker(),
        });

        // Register Operation Event Emitter
        this.serviceManager.registerService({
            id: 'operation-emitter',
            type: 'factory',
            factory: () => new OperationEventEmitter(),
        });

        // Register Adapter Registry - Moved before generator-factory
        this.serviceManager.registerService({
            id: 'adapter-registry',
            type: 'factory',
            factory: () => new AdapterRegistry(
                this.serviceManager.getService<PersistentStateManager>('state'),
                this.serviceManager.getService<SettingsService>('settings'),
                this.jsonValidationService
            ),
            dependencies: ['state', 'settings'],
        });

        // Register Generator Factory
        this.serviceManager.registerService({
            id: 'generator-factory',
            type: 'factory',
            factory: () => new GeneratorFactory(
                this.app,
                this.serviceManager.getService<PersistentStateManager>('state'),
                this.serviceManager.getService<SettingsService>('settings'),
                this.serviceManager.getService<AdapterRegistry>('adapter-registry'),
                this.serviceManager.getService<WikilinkTextProcessor>('wikilink-text-processor')
            ),
            dependencies: ['state', 'settings', 'adapter-registry', 'wikilink-text-processor'],
        });

        // Register Queue Manager
        this.serviceManager.registerService({
            id: 'queue-manager',
            type: 'factory',
            factory: () => {
                const operationEmitter = this.serviceManager.getService<OperationEventEmitter>('operation-emitter');
                const metricsTracker = this.serviceManager.getService<MetricsTracker>('metrics-tracker');

                return new QueueManagerService(
                    async (operation) => {
                        await operation.execute();
                        operationEmitter.emitOperationComplete({
                            type: operation.type,
                            startTime: Date.now(),
                            success: true,
                        });
                        metricsTracker.trackOperation({
                            type: operation.type,
                            startTime: Date.now(),
                            success: true,
                        });
                    }
                );
            },
            dependencies: ['operation-emitter', 'metrics-tracker'],
        });

        // Register Operation Manager
        this.serviceManager.registerService({
            id: 'operation-manager',
            type: 'factory',
            factory: () => new AIOperationManager(
                this.serviceManager.getService<PersistentStateManager>('state'),
                this.serviceManager.getService<AdapterRegistry>('adapter-registry'),
                this.serviceManager.getService<GeneratorFactory>('generator-factory')
            ),
            dependencies: ['state', 'adapter-registry', 'generator-factory'],
        });

        // Register AI Service
        this.serviceManager.registerService({
            id: 'ai',
            type: 'factory',
            factory: () => new AIService(
                this.app,
                this.serviceManager.getService<AIOperationManager>('operation-manager'),
                this.serviceManager.getService<SettingsService>('settings'),
                this.jsonValidationService,
                this.serviceManager.getService<DatabaseService>('database'),
                this.serviceManager.getService<PersistentStateManager>('state'),
                this.serviceManager.getService<WikilinkTextProcessor>('wikilink-text-processor')
            ),
            dependencies: ['operation-manager', 'settings', 'database', 'state', 'wikilink-text-processor'],
        });
    }

    /**
     * Register file processing related services
     */
    private async registerFileProcessingServices(): Promise<void> {
        // Register File Processor
        this.serviceManager.registerService({
            id: 'file-processor',
            type: 'factory',
            factory: () => new FileProcessorService(
                this.serviceManager.getService<PersistentStateManager>('state'),
                this.app,
                this.serviceManager.getService<AIService>('ai'),
                this.serviceManager.getService<SettingsService>('settings'),
                this.serviceManager.getService<DatabaseService>('database'),
                this.serviceManager.getService<FileScannerService>('file-scanner'),
                this.serviceManager.getService<GeneratorFactory>('generator-factory') // Inject GeneratorFactory
            ),
            dependencies: ['state', 'ai', 'settings', 'database', 'file-scanner', 'generator-factory'], // Add 'generator-factory' dependency
        });

        // Register Batch Processor
        this.serviceManager.registerService({
            id: 'batch-processor',
            type: 'factory',
            factory: () => new BatchProcessor(
                this.app,
                this.serviceManager.getService<FileProcessorService>('file-processor'),
                this.serviceManager.getService<AIOperationManager>('operation-manager')
                    .getOperationExecutor(), // Ensure this method returns an appropriate executor
                this.serviceManager.getService<GeneratorFactory>('generator-factory')
            ),
            dependencies: ['file-processor', 'operation-manager', 'generator-factory'],
        });
    }

    /**
     * Register high-level services
     */
    private async registerHighLevelServices(): Promise<void> {
        // Register File Manager
        this.serviceManager.registerService({
            id: 'file',
            type: 'factory',
            factory: () => new FileManager(
                this,
                this.app,
                this.serviceManager.getService<PersistentStateManager>('state'),
                this.serviceManager.getService<SettingsService>('settings'),
                this.serviceManager.getService<DatabaseService>('database'),
                this.serviceManager.getService<AIService>('ai'),
                this.serviceManager.getService<FileProcessorService>('file-processor'),
                this.serviceManager.getService<GeneratorFactory>('generator-factory'),
                this.serviceManager.getService<FileScannerService>('file-scanner')
            ),
            dependencies: ['state', 'settings', 'database', 'ai', 'file-processor', 'generator-factory', 'file-scanner'],
        });
    }

    private async handleLayoutReady(): Promise<void> {
        try {
            await this.initManager.initialize(); 

            // Initialize UI Manager
            this.uiManager = new UIManager(
                this,
                this.app,
                this.serviceManager.getService<DatabaseService>('database')
            );
            await this.uiManager.initialize();

            // Register commands and settings (only once!)
            this.registerCommands();
            this.addSettingTab(new GraphWeaverSettingTab(this.app, this));

        } catch (error) {
            console.error('Failed to initialize plugin:', error);
        }
    }

    async onunload(): Promise<void> {
        this.app.workspace.containerEl.removeClass('graphweaver-plugin');
        this.eventManager.cleanup();
        await this.serviceManager.destroy();

        // Destroy UIManager
        if (this.uiManager) {
            await this.uiManager.destroy();
        }
    }

    // Public service access methods
    public getDatabaseService = (): DatabaseService =>
        this.serviceManager.getService('database');

    public getSettingsService = (): SettingsService =>
        this.serviceManager.getService('settings');

    public getAIService = (): AIService =>
        this.serviceManager.getService('ai');

    public getFileManager = (): FileManager =>
        this.serviceManager.getService('file');

    public getStateManager = (): PersistentStateManager =>
        this.serviceManager.getService('state');

    public getBatchProcessor = (): BatchProcessor =>
        this.serviceManager.getService('batch-processor');

    public getOperationManager = (): AIOperationManager =>
        this.serviceManager.getService('operation-manager');

    public getFileProcessor = (): FileProcessorService =>
        this.serviceManager.getService('file-processor');

    public getFileScanner = (): FileScannerService =>
        this.serviceManager.getService('file-scanner');

    /**
     * Register Obsidian commands (optional if handled by UIManager)
     */
    private registerCommands(): void {
        // If UIManager handles commands, you can remove or keep this
        // Example of registering a command manually
        this.addCommand({
            id: 'generate-frontmatter',
            name: 'Generate Front Matter',
            callback: () => this.getFileManager().generateFrontmatter(),
        });

        this.addCommand({
            id: 'generate-wikilinks',
            name: 'Generate Wikilinks',
            callback: () => this.getFileManager().generateWikilinks(),
        });

        this.addCommand({
            id: 'generate-knowledge-bloom',
            name: 'Generate Knowledge Bloom',
            callback: () => this.getFileManager().generateKnowledgeBloom(),
        });

        this.addCommand({
            id: 'batch-process-files',
            name: 'Batch Process Files',
            callback: () => this.getFileManager().openBatchProcessor(),
        });
    }
}
