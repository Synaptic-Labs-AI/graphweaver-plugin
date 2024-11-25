import { App, Notice } from 'obsidian';
import { CoreService } from '@services/core/CoreService';
import { ServiceError } from '@services/core/ServiceError';
import { SettingsService } from '@services/SettingsService';
import { JsonValidationService } from '@services/JsonValidationService';
import { DatabaseService } from '@services/DatabaseService';
import { AIModelUtils } from '@type/aiModels';
import { GeneratorFactory } from './GeneratorFactory';
import { AdapterRegistry } from './AdapterRegistry';
import { AIGenerationService } from './AIGenerationService';
import { AIProvider, AIAdapter } from '@type/ai.types';
import { IConfigurableService, IReinitializableService } from '@services/core/IService';
import { AIOperationManager } from './AIOperationManager';
import { WikilinkTextProcessor } from '@services/WikilinkTextProcessor';
import { aiStore } from '@stores/AIStore';
import { settingsStore } from '@stores/SettingStore';
import { get, type Unsubscriber } from 'svelte/store';

/**
 * Configuration interface for AIService
 */
export interface AIServiceConfig {
    defaultProvider?: AIProvider;
    enableNotifications?: boolean;
    debug?: boolean;
}

/**
 * Enhanced AIService that coordinates AI functionality
 */
export class AIService extends CoreService 
    implements IConfigurableService<AIServiceConfig>, IReinitializableService {
    
    protected generatorFactory: GeneratorFactory;
    protected generationService!: AIGenerationService; // Use definite assignment
    protected adapterRegistry: AdapterRegistry; // Add missing property
    private config: AIServiceConfig;
    private unsubscribers: Unsubscriber[] = [];
    private isInitializing = false;

    constructor(
        protected app: App,
        protected operationManager: AIOperationManager,
        protected settingsService: SettingsService,
        protected jsonValidationService: JsonValidationService,
        protected databaseService: DatabaseService,
        protected wikilinkProcessor: WikilinkTextProcessor,
        config: Partial<AIServiceConfig> = {}
    ) {
        super('ai-service', 'AI Service');
        this.config = {
            defaultProvider: AIProvider.OpenAI,
            enableNotifications: true,
            debug: false,
            ...config
        };

        // Initialize AdapterRegistry first
        this.adapterRegistry = new AdapterRegistry(
            settingsService,
            jsonValidationService
        );

        // Create generator factory with correct arguments
        this.generatorFactory = new GeneratorFactory(
            app,
            settingsService, 
            this.adapterRegistry,
            wikilinkProcessor
        );
    }

    /**
     * Initialize core components and services
     */
    protected async initializeInternal(): Promise<void> {
        try {
            // Initialize core components
            await this.adapterRegistry.initialize();
            await this.generatorFactory.initialize();

            // Validate provider setup
            const provider = this.getProviderFromStore();
            const models = AIModelUtils.getModelsForProvider(provider);
            if (!models.length) {
                throw new Error(`No models available for provider: ${provider}`);
            }

            // Update store with valid models
            aiStore.update(state => ({
                ...state,
                availableModels: models,
                currentModel: models[0].apiName,
                isInitialized: true
            }));

            // Create generation service after validation
            this.generationService = new AIGenerationService(this.generatorFactory);
            
            this.setupSubscriptions();

        } catch (error) {
            throw new ServiceError(
                this.serviceName,
                'Failed to initialize AI service',
                error instanceof Error ? error : undefined
            );
        }
    }

    /**
     * Initialize core components
     */
    private initializeComponents(): void {
        this.adapterRegistry = new AdapterRegistry(
            this.settingsService,
            this.jsonValidationService
        );
    
        // Fixed order to match GeneratorFactory constructor parameters
        this.generatorFactory = new GeneratorFactory(
            this.app,                    // App
            this.settingsService,        // SettingsService
            this.adapterRegistry,        // AdapterRegistry
            this.wikilinkProcessor       // WikilinkTextProcessor
        );
    }

    /**
     * Set up store subscriptions
     */
    private setupSubscriptions(): void {
        // Monitor settings changes
        const settingsUnsub = settingsStore.subscribe(settings => {
            if (this.config.debug) {
                console.log('🦇 AI Service settings update:', settings);
            }
        });

        // Monitor AI state changes
        const aiStoreUnsub = aiStore.subscribe(state => {
            if (this.config.debug) {
                console.log('🦇 AI Service state update:', state);
            }
        });

        this.unsubscribers.push(settingsUnsub, aiStoreUnsub);
    }

    /**
     * Clean up resources
     */
    protected async destroyInternal(): Promise<void> {
        try {
            // Clean up subscriptions
            this.unsubscribers.forEach(unsub => unsub());
            this.unsubscribers = [];

            // Clean up in reverse initialization order
            await this.generatorFactory?.resetAll();
            await this.adapterRegistry?.destroy();

            // Update store state
            aiStore.update(state => ({
                ...state,
                isInitialized: false
            }));
        } catch (error) {
            throw new ServiceError(
                this.serviceName,
                'Failed to clean up AI service',
                error instanceof Error ? error : undefined
            );
        }
    }

    /**
     * Configure the service
     */
    public async configure(config: Partial<AIServiceConfig>): Promise<void> {
        this.config = { ...this.config, ...config };
        
        if (config.defaultProvider) {
            const currentProvider = this.getProviderFromStore();
            if (currentProvider !== config.defaultProvider) {
                await this.adapterRegistry.testConnection(config.defaultProvider);
                this.updateAIStore({ provider: config.defaultProvider });
            }
        }

        if (this.config.debug) {
            console.log('🦇 AI Service configured:', this.config);
        }
    }

    /**
     * Get current provider from store
     */
    private getProviderFromStore(): AIProvider {
        const state = get(aiStore);
        return state.provider;
    }

    /**
     * Reinitialize the service
     */
    public async reinitialize(): Promise<void> {
        if (this.isInitializing) {
            throw new ServiceError('AI Service', 'Service is already initializing');
        }
        
        try {
            this.isInitializing = true;
            await this.waitForDependencies();
            await this.initialize();
        } finally {
            this.isInitializing = false;
        }
    }

    private async waitForDependencies(): Promise<void> {
        // Wait for required services to be ready
        const maxAttempts = 50;
        const interval = 100;
        
        for (let i = 0; i < maxAttempts; i++) {
            if (this.checkDependenciesReady()) {
                return;
            }
            await new Promise(resolve => setTimeout(resolve, interval));
        }
        throw new ServiceError('AI Service', 'Dependencies failed to initialize');
    }

    private checkDependenciesReady(): boolean {
        return this.settingsService?.isReady() && 
               this.operationManager?.isReady() &&
               this.databaseService?.isReady();
    }

    /**
     * Update AI store state
     */
    private updateAIStore(update: Partial<Parameters<typeof aiStore.update>[0]>): void {
        aiStore.update(state => ({
            ...state,
            ...update
        }));
    }

    /**
     * Get the current AI adapter
     */
    public getCurrentAdapter(): AIAdapter {
        return this.adapterRegistry.getCurrentAdapter();
    }

    /**
     * Get the current provider
     */
    public getCurrentProvider(): AIProvider {
        return this.getProviderFromStore();
    }

    /**
     * Get the adapter registry
     */
    public getAdapterRegistry(): AdapterRegistry {
        if (!this.adapterRegistry) {
            throw new ServiceError(this.serviceName, 'AdapterRegistry not initialized');
        }
        return this.adapterRegistry;
    }

    /**
     * Get the generator factory
     */
    public getGeneratorFactory(): GeneratorFactory {
        if (!this.generatorFactory) {
            throw new ServiceError(this.serviceName, 'GeneratorFactory not initialized');
        }
        return this.generatorFactory;
    }

    /**
     * Get the generation service
     */
    public getGenerationService(): AIGenerationService {
        if (!this.generationService) {
            this.generationService = new AIGenerationService(this.generatorFactory);
        }
        return this.generationService;
    }

    /**
     * Test connection to provider
     */
    public async testConnection(provider: AIProvider): Promise<boolean> {
        if (!this.isReady()) {
            await this.initialize();
        }

        try {
            const result = await this.adapterRegistry.testConnection(provider);
            if (this.config.enableNotifications) {
                new Notice(
                    result 
                        ? `Successfully connected to ${provider}`
                        : `Failed to connect to ${provider}`
                );
            }
            return result;
        } catch (error) {
            this.handleError('Failed to test connection', error);
            return false;
        }
    }
}