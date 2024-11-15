import { App } from 'obsidian';
import { CoreService } from '../core/CoreService';
import { ServiceError } from '../core/ServiceError';
import { PersistentStateManager } from '../../managers/StateManager';
import { SettingsService } from '../SettingsService';
import { JsonValidationService } from '../JsonValidationService';
import { DatabaseService } from '../DatabaseService';
import { AIStateHandler, StateEvent } from './AIStateHandler';
import { GeneratorFactory } from './GeneratorFactory';
import { AdapterRegistry } from './AdapterRegistry';
import { AIGenerationService } from './AIGenerationService';
import { AIProvider, AIAdapter } from '../../models/AIModels';
import { IConfigurableService, IReinitializableService } from '../core/IService';
import { AIOperationManager } from './AIOperationManager';
import { WikilinkTextProcessor } from '../WikilinkTextProcessor';

/**
 * Configuration interface for AIService
 */
export interface AIServiceConfig {
    defaultProvider?: AIProvider;
    enableNotifications?: boolean;
    debug?: boolean;
}

/**
 * Enhanced AIService that extends CoreService and implements additional interfaces
 * for configuration and reinitialization capabilities
 */
export class AIService extends CoreService 
    implements IConfigurableService<AIServiceConfig>, IReinitializableService {
    
    private generatorFactory: GeneratorFactory;
    private adapterRegistry: AdapterRegistry;
    private stateHandler: AIStateHandler;
    private generationService: AIGenerationService | null = null;
    private config: AIServiceConfig;

    constructor(
        private app: App,
        private operationManager: AIOperationManager,
        private settingsService: SettingsService,
        private jsonValidationService: JsonValidationService,
        private databaseService: DatabaseService,
        private stateManager: PersistentStateManager,
        private wikilinkProcessor: WikilinkTextProcessor,
        config: Partial<AIServiceConfig> = {}
    ) {
        super('ai-service', 'AI Service');
        this.config = {
            defaultProvider: AIProvider.OpenAI,
            enableNotifications: true,
            debug: false,
            ...config
        };
    }

    /**
     * Initialize core components and services
     * @throws ServiceError if initialization fails
     */
    protected async initializeInternal(): Promise<void> {
        try {
            // Initialize core components
            this.initializeComponents();

            // Initialize in dependency order
            await this.adapterRegistry.initialize();
            await this.generatorFactory.initialize();

            // Create generation service after generators are ready
            this.generationService = new AIGenerationService(this.generatorFactory);

            // Update state handler
            this.stateHandler.updateState(
                { isInitialized: true },
                StateEvent.StatusChanged
            );

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
            this.stateManager,
            this.settingsService,
            this.jsonValidationService
        );

        this.generatorFactory = new GeneratorFactory(
            this.app,
            this.stateManager,
            this.settingsService,
            this.adapterRegistry,
            this.wikilinkProcessor
        );

        this.stateHandler = new AIStateHandler(this.stateManager);
    }

    /**
     * Clean up resources
     */
    protected async destroyInternal(): Promise<void> {
        try {
            // Clean up in reverse initialization order
            this.generationService = null;
            await this.generatorFactory?.resetAll();
            await this.adapterRegistry?.destroy();
            this.stateHandler?.destroy();
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
     * @param config Service configuration
     */
    public async configure(config: Partial<AIServiceConfig>): Promise<void> {
        this.config = { ...this.config, ...config };
        
        if (config.defaultProvider) {
            await this.adapterRegistry.handleProviderChange(config.defaultProvider);
        }
    }

    /**
     * Reinitialize the service
     */
    public async reinitialize(): Promise<void> {
        if (!this.isReady()) {
            throw new ServiceError(this.serviceName, 'Cannot reinitialize when not ready');
        }

        try {
            await this.destroy();
            this.initializeComponents();
            await this.initialize();
            
            if (this.config.enableNotifications) {
            }
        } catch (error) {
            throw new ServiceError(
                this.serviceName,
                'Failed to reinitialize AI service',
                error instanceof Error ? error : undefined
            );
        }
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
        return this.adapterRegistry.currentProvider;
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
            return await this.adapterRegistry.testConnection(provider);
        } catch (error) {
            this.handleError('Failed to test connection', error);
            return false;
        }
    }
}