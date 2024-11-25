import { Plugin, Notice, App } from 'obsidian';
import { 
    initializeStores, 
    initializeCoreServices,
    registerFileServices,
    registerUIServices,
    initializeUIServices,
    destroyUIServices
} from '@registrations/index';
import { GraphWeaverSettingTab } from '@settings/GraphWeaverSettingTab';
import { ServiceRegistry } from '@registrations/ServiceRegistrations';
import { CommandManager } from '@managers/CommandManager';
import { pluginStore } from '@stores/index';
import { ServiceError } from '@services/core/ServiceError';
import { AIService } from '@services/ai/AIService';
import { SettingsService } from '@services/SettingsService';
import { AIOperationManager } from '@services/ai/AIOperationManager';
import { JsonValidationService } from '@services/JsonValidationService';
import { DatabaseService } from '@services/DatabaseService';
import { WikilinkTextProcessor } from '@services/WikilinkTextProcessor';
import { AdapterRegistry } from '@services/ai/AdapterRegistry';
import { GeneratorFactory } from '@services/ai/GeneratorFactory';
import { IService } from '@services/core/IService';
import { FileProcessorService } from '@services/file/FileProcessorService';
import { FileScannerService } from '@services/file/FileScannerService';
import { writable } from 'svelte/store';
import { ProcessingState, ProcessingStateEnum } from '@type/processing.types';
import { TagManagementService } from '@services/tags/TagManagementService';

/**
 * GraphWeaver Plugin
 * Implements AI-powered knowledge graph generation for Obsidian
 */
export default class GraphWeaverPlugin extends Plugin {
    private readonly CONFIG = {
        INIT_RETRY_MS: 5000,
        MAX_INIT_RETRIES: 3,
        SAVE_INTERVAL_MS: 1000
    };

    private commandManager: CommandManager;
    private initRetryCount = 0;
    private isInitialized = false;
    private aiService!: AIService;
    private settingsService!: SettingsService;
    private serviceRegistry: ServiceRegistry;
    private readonly initializedServices = new Set<string>();
    private initializationPromise: Promise<void> | null = null;
    private settingTab: GraphWeaverSettingTab | null = null;
    public tagManager!: TagManagementService; // For tag management

    // Add ! to indicate these will be definitely assigned
    settings!: SettingsService;
    ai!: AIService;

    constructor(app: App, manifest: any) {
        super(app, manifest);
        this.commandManager = new CommandManager(this);
        this.serviceRegistry = ServiceRegistry.getInstance();
    }

    /**
     * Plugin load lifecycle method
     */
    async onload(): Promise<void> {
        try {
            console.log('🦇 Starting GraphWeaver initialization...');

            // Initialize core components first
            await this.initializeCore();

            // Create and initialize SettingsService first
            this.settings = new SettingsService(this);
            await this.settings.initialize();

            // Create required dependencies for AIService
            const jsonValidationService = new JsonValidationService();
            await jsonValidationService.initialize();

            const databaseService = new DatabaseService(this);
            await databaseService.initialize();

            const wikilinkProcessor = new WikilinkTextProcessor();
            await wikilinkProcessor.initialize();

            const adapterRegistry = new AdapterRegistry(this.settings, jsonValidationService);
            await adapterRegistry.initialize();

            const generatorFactory = new GeneratorFactory(
                this.app,
                this.settings,
                adapterRegistry,
                wikilinkProcessor
            );
            await generatorFactory.initialize();

            const operationManager = new AIOperationManager(adapterRegistry, generatorFactory);
            await operationManager.initialize();

            // Now create AIService with all required dependencies
            this.ai = new AIService(
                this.app,
                operationManager,
                this.settings,
                jsonValidationService,
                databaseService,
                wikilinkProcessor
            );
            await this.ai.initialize();

            // Initialize tag management service with app and plugin instance
            this.tagManager = new TagManagementService(this.app, this);
            await this.tagManager.initialize();

            // Continue with remaining initialization
            await this.initializeServices();
            await this.registerFeatures();

            this.isInitialized = true;
            console.log('🦇 GraphWeaver initialization complete!');
            new Notice('GraphWeaver initialized successfully! 🚀');
        } catch (error) {
            await this.handleInitializationError(error);
        }
    }

    /**
     * Initialize core plugin components
     */
    private async initializeCore(): Promise<void> {
        try {
            console.log('🦇 Initializing core components...');
            
            // Load saved data
            const savedData = await this.loadData();
            
            // Initialize stores first
            await initializeStores({
                plugin: this,
                data: savedData
            });

            // Initialize service registry
            await this.serviceRegistry.initializeRegistry();
            
            // Initialize core services
            await initializeCoreServices(this);

            console.log('🦇 Core initialization complete');
        } catch (error) {
            throw new ServiceError('Core Initialization', 'Failed to initialize core components', error);
        }
    }

    /**
     * Initialize and register all services
     */
    private async initializeServices(): Promise<void> {
        try {
            console.log('🦇 Starting service initialization...');

            const ServiceIds = {
                SETTINGS: 'settingsService',
                JSON_VALIDATION: 'jsonValidationService',
                DATABASE: 'databaseService',
                WIKILINK: 'wikilinkProcessor',
                ADAPTER_REGISTRY: 'adapterRegistry',
                GENERATOR_FACTORY: 'generatorFactory',
                AI_OPERATION: 'aiOperationManager',
                AI_SERVICE: 'aiService',
                FILE_PROCESSOR: 'fileProcessorService'
            } as const;

            // Track services that have been initialized
            this.initializedServices.clear();

            // Group 1: Core Services (No Dependencies)
            // Settings, JSON Validation, Database
            console.log('🦇 Initializing Core Services (Group 1)...');
            
            this.settingsService = new SettingsService(this);
            await this.settingsService.initialize();
            await this.verifyServiceReady(this.settingsService, 'Settings Service');
            await this.serviceRegistry.registerService(ServiceIds.SETTINGS, this.settingsService);
            this.initializedServices.add(ServiceIds.SETTINGS);
            
            const jsonValidationService = new JsonValidationService();
            await jsonValidationService.initialize();
            await this.verifyServiceReady(jsonValidationService, 'JSON Validation Service');
            await this.serviceRegistry.registerService(ServiceIds.JSON_VALIDATION, jsonValidationService);
            this.initializedServices.add(ServiceIds.JSON_VALIDATION);
            
            const databaseService = new DatabaseService(this);
            await databaseService.initialize();
            await this.verifyServiceReady(databaseService, 'Database Service');
            await this.serviceRegistry.registerService(ServiceIds.DATABASE, databaseService);
            this.initializedServices.add(ServiceIds.DATABASE);

            // Group 2: Processing Services
            console.log('🦇 Initializing Processing Services (Group 2)...');
            
            const wikilinkProcessor = new WikilinkTextProcessor();
            await wikilinkProcessor.initialize();
            await this.verifyServiceReady(wikilinkProcessor, 'Wikilink Processor');
            await this.serviceRegistry.registerService(ServiceIds.WIKILINK, wikilinkProcessor);
            this.initializedServices.add(ServiceIds.WIKILINK);

            // Group 3: Registry and Factory Services
            console.log('🦇 Initializing Registry Services (Group 3)...');
            
            const adapterRegistry = new AdapterRegistry(this.settingsService, jsonValidationService);
            await adapterRegistry.initialize();
            await this.verifyServiceReady(adapterRegistry, 'Adapter Registry');
            await this.serviceRegistry.registerService(ServiceIds.ADAPTER_REGISTRY, adapterRegistry);
            this.initializedServices.add(ServiceIds.ADAPTER_REGISTRY);

            const generatorFactory = new GeneratorFactory(
                this.app,
                this.settingsService,
                adapterRegistry,
                wikilinkProcessor
            );
            await generatorFactory.initialize();
            await this.verifyServiceReady(generatorFactory, 'Generator Factory');
            await this.serviceRegistry.registerService(ServiceIds.GENERATOR_FACTORY, generatorFactory);
            this.initializedServices.add(ServiceIds.GENERATOR_FACTORY);

            // Group 4: AI Services
            console.log('🦇 Initializing AI Services (Group 4)...');
            
            const operationManager = new AIOperationManager(adapterRegistry, generatorFactory);
            await operationManager.initialize();
            await this.verifyServiceReady(operationManager, 'AI Operation Manager');
            await this.serviceRegistry.registerService(ServiceIds.AI_OPERATION, operationManager);
            this.initializedServices.add(ServiceIds.AI_OPERATION);

            this.aiService = new AIService(
                this.app,
                operationManager,
                this.settingsService,
                jsonValidationService,
                databaseService,
                wikilinkProcessor
            );
            await this.aiService.initialize();
            await this.verifyServiceReady(this.aiService, 'AI Service');
            await this.serviceRegistry.registerService(ServiceIds.AI_SERVICE, this.aiService);
            this.initializedServices.add(ServiceIds.AI_SERVICE);

            // Group 5: File Services with explicit service tracking
            console.log('🦇 Initializing File Services (Group 5)...');

            let fileScannerService: FileScannerService;
            if (!this.initializedServices.has('fileScannerService')) {
                console.log('🦇 Creating new FileScannerService instance');
                fileScannerService = new FileScannerService(this.app.vault);
                await fileScannerService.initialize();
                await this.verifyServiceReady(fileScannerService, 'File Scanner Service');
                await this.serviceRegistry.registerService('fileScannerService', fileScannerService);
                this.initializedServices.add('fileScannerService');
            } else {
                console.log('🦇 Reusing existing FileScannerService instance');
                fileScannerService = this.serviceRegistry.getService('fileScannerService');
            }

            // Initialize Processing State Store
            const processingStateStore = writable<ProcessingState>({
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
            });

            // Initialize File Processor Service with singleton check
            let fileProcessorService: FileProcessorService | null = null;
            if (!this.initializedServices.has(ServiceIds.FILE_PROCESSOR)) {
                console.log('🦇 Creating new FileProcessorService instance');
                fileProcessorService = new FileProcessorService(
                    this.app,
                    this.aiService,
                    this.settingsService,
                    databaseService,
                    fileScannerService,
                    generatorFactory,
                    processingStateStore
                );

                await fileProcessorService.initialize();
                await this.verifyServiceReady(fileProcessorService, 'File Processor Service');
                await this.serviceRegistry.registerService(ServiceIds.FILE_PROCESSOR, fileProcessorService);
                this.initializedServices.add(ServiceIds.FILE_PROCESSOR);
            }

            // Modify how remaining services are registered
            console.log('🦇 Registering remaining services...');
            // Pass initialized services to prevent re-initialization
            await registerFileServices(this.app);
            await registerUIServices();

            // Initialize UI services
            console.log('🦇 Initializing UI services...');
            await initializeUIServices();

            // Final verification
            await this.verifyAllServices();

            console.log('🦇 Service initialization complete');
        } catch (error) {
            console.error('🦇 Service initialization failed:', error);
            throw new ServiceError(
                'Service Initialization',
                'Failed to initialize services',
                error instanceof Error ? error : undefined
            );
        }
    }

    private async waitForDependencies(services: IService[], context: string): Promise<void> {
        console.log(`🦇 Waiting for dependencies: ${context}...`);
        const timeout = 30000; // 30 seconds
        const startTime = Date.now();

        while (services.some(service => !service.isReady())) {
            if (Date.now() - startTime > timeout) {
                const notReady = services.filter(s => !s.isReady()).map(s => s.serviceName);
                throw new Error(`Timeout waiting for dependencies: ${notReady.join(', ')}`);
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        console.log(`🦇 All dependencies ready for: ${context}`);
    }

    /**
     * Verify that a specific service is ready
     */
    private async verifyServiceReady(service: IService, serviceName: string): Promise<void> {
        console.log(`🦇 Verifying ${serviceName}...`);
        
        // Initial check
        if (service.isReady()) {
            console.log(`🦇 ${serviceName} is ready`);
            return;
        }

        // Wait for up to 5 seconds for service to be ready
        for (let i = 0; i < 50; i++) {
            await new Promise(resolve => setTimeout(resolve, 100));
            if (service.isReady()) {
                console.log(`🦇 ${serviceName} is ready after waiting`);
                return;
            }
        }

        throw new ServiceError(
            serviceName,
            `Service failed to reach ready state after initialization`
        );
    }

    /**
     * Verify all services are ready
     */
    private async verifyAllServices(): Promise<void> {
        console.log('🦇 Verifying all services...');
        
        const services = this.serviceRegistry.getRegisteredServices();
        const notReady = services.filter(s => !s.service.isReady());

        if (notReady.length > 0) {
            const names = notReady.map(s => s.name).join(', ');
            console.error('🦇 Services not ready:', names);
            throw new ServiceError(
                'Service Verification',
                `Services not ready: ${names}`
            );
        }

        console.log('🦇 All services verified and ready');
    }

    /**
     * Register plugin features
     */
    private async registerFeatures(): Promise<void> {
        try {
            console.log('🦇 Registering features...');

            // Initialize command manager
            await this.commandManager.initialize();

            // Ensure settings tab is only added once
            if (!this.settingTab) {
                this.settingTab = new GraphWeaverSettingTab(this.app, this);
                this.addSettingTab(this.settingTab);
            }

            // Setup auto-save
            this.registerInterval(
                window.setInterval(
                    () => this.saveData(pluginStore.getSnapshot()),
                    this.CONFIG.SAVE_INTERVAL_MS
                )
            );

            console.log('🦇 Feature registration complete');
        } catch (error) {
            throw new ServiceError('Feature Registration', 'Failed to register features', error);
        }
    }

    /**
     * Handle initialization errors with retry logic
     */
    private async handleInitializationError(error: unknown): Promise<void> {
        console.error('🦇 Initialization error:', error);

        if (this.initRetryCount < this.CONFIG.MAX_INIT_RETRIES) {
            this.initRetryCount++;
            new Notice(`Initialization failed. Retrying... (${this.initRetryCount}/${this.CONFIG.MAX_INIT_RETRIES})`);
            
            setTimeout(() => this.onload(), this.CONFIG.INIT_RETRY_MS);
        } else {
            new Notice('Failed to initialize plugin. Please restart Obsidian.');
            throw error instanceof Error ? error : new Error(String(error));
        }
    }

    /**
     * Plugin unload lifecycle method
     */
    async onunload(): Promise<void> {
        try {
            console.log('🦇 Unloading GraphWeaver...');
            
            await this.commandManager?.destroy();
            await destroyUIServices();
            await this.serviceRegistry.destroyAll();
            
            // Clean up settings tab
            if (this.settingTab) {
                this.settingTab = null;
            }
            
            console.log('🦇 GraphWeaver unloaded successfully');
        } catch (error) {
            console.error('🦇 Error during plugin unload:', error);
        }
    }

    /**
     * Public getter for initialization state
     */
    public isReady(): boolean {
        return this.isInitialized && 
               !this.initializationPromise &&
               this.settingsService?.isReady() && 
               this.aiService?.isReady() &&
               this.tagManager?.isReady();
    }

    public getAIService(): AIService {
        if (!this.isReady()) {
            throw new ServiceError('Plugin', 'Plugin not ready. Services still initializing.');
        }
        return this.aiService;
    }

    public getSettingsService(): SettingsService {
        if (!this.isReady()) {
            throw new ServiceError('Plugin', 'Plugin not ready. Services still initializing.');
        }
        return this.settingsService;
    }

    public async ensureInitialized(): Promise<void> {
        if (!this.initializationPromise) {
            this.initializationPromise = this.initializeServices()
                .finally(() => {
                    this.initializationPromise = null;
                });
        }
        return this.initializationPromise;
    }
}