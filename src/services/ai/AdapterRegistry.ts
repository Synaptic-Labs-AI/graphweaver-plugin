import { AIProvider, AIAdapter, AIModel, AIModelMap } from '../../models/AIModels';
import { OpenAIAdapter } from "../../adapters/OpenAIAdapter";
import { AnthropicAdapter } from "../../adapters/AnthropicAdapter";
import { GeminiAdapter } from "../../adapters/GeminiAdapter";
import { GroqAdapter } from "../../adapters/GroqAdapter";
import { OpenRouterAdapter } from "../../adapters/OpenRouterAdapter";
import { LMStudioAdapter } from "../../adapters/LMStudioAdapter";
import { SettingsService } from "../SettingsService";
import { JsonValidationService } from "../JsonValidationService";
import { PersistentStateManager } from "../../managers/StateManager";
import { PluginState } from "../../state/PluginState";
import { IService } from '../core/IService';
import { ServiceState } from '../../state/ServiceState';
import { ServiceError } from '../core/ServiceError';

/**
 * Interface for adapter status tracking
 */
interface AdapterStatus {
    isInitialized: boolean;
    isConnected: boolean;
    lastConnected?: number;
    lastValidated?: number;
    lastError?: string;
}

/**
 * Manages AI provider adapters lifecycle and state
 * Provides centralized adapter access and health monitoring
 */
export class AdapterRegistry implements IService {
    // IService implementation
    public readonly serviceId = 'adapter-registry';
    public readonly serviceName = 'Adapter Registry';
    private serviceState: ServiceState = ServiceState.Uninitialized;
    private serviceError: ServiceError | null = null;

    // Adapter management
    private adapters: Map<AIProvider, AIAdapter>;
    private adapterStatus: Map<AIProvider, AdapterStatus>;
    public currentProvider: AIProvider;
    private stateSnapshot: PluginState;
    private unsubscribeCallbacks: (() => void)[] = [];
    private isUnloading = false;

    constructor(
        private stateManager: PersistentStateManager,
        private settingsService: SettingsService,
        private jsonValidationService: JsonValidationService
    ) {
        this.adapters = new Map();
        this.adapterStatus = new Map();
        this.stateSnapshot = this.stateManager.getSnapshot();
        this.currentProvider = this.stateSnapshot.settings.aiProvider;
    }

    /**
     * Initialize the service and adapters
     */
    public async initialize(): Promise<void> {
        try {
            this.serviceState = ServiceState.Initializing;
            await this.initializeAdapters();
            await this.setupSubscriptions();
            this.serviceState = ServiceState.Ready;
        } catch (error) {
            this.serviceState = ServiceState.Error;
            this.serviceError = error instanceof ServiceError ? error : 
                new ServiceError(this.serviceName, 'Failed to initialize adapters');
            throw this.serviceError;
        }
    }

    /**
     * Check if service is ready
     */
    public isReady(): boolean {
        return this.serviceState === ServiceState.Ready && !this.isUnloading;
    }

    /**
     * Clean up resources and destroy adapters
     */
    public async destroy(): Promise<void> {
        if (this.isUnloading) return;

        try {
            this.isUnloading = true;
            this.serviceState = ServiceState.Destroying;

            // Clean up subscriptions
            this.unsubscribeCallbacks.forEach(unsubscribe => unsubscribe());
            this.unsubscribeCallbacks = [];

            // Clean up adapters with proper type checking for callable
            const cleanupPromises = Array.from(this.adapters.values())
                .map(async (adapter) => {
                    // Check both existence and that it's a callable function
                    if ('destroy' in adapter && 
                        adapter.destroy && 
                        typeof adapter.destroy === 'function') {
                        try {
                            await adapter.destroy();
                        } catch (error) {
                            console.warn(
                                `Failed to destroy adapter for ${adapter.getProviderType()}: ` +
                                `${error instanceof Error ? error.message : 'Unknown error'}`
                            );
                        }
                    }
                });

            // Wait for all cleanup to complete
            await Promise.all(cleanupPromises);

            // Clear adapter references
            this.adapters.clear();
            this.adapterStatus.clear();

            this.updateState();
            this.serviceState = ServiceState.Destroyed;

        } catch (error) {
            this.serviceState = ServiceState.Error;
            this.serviceError = error instanceof ServiceError ? error :
                new ServiceError(this.serviceName, 'Failed to destroy adapters');
            throw this.serviceError;
        }
    }

    /**
     * Get current service state
     */
    public getState(): { state: ServiceState; error: ServiceError | null } {
        return { 
            state: this.serviceState, 
            error: this.serviceError 
        };
    }

    /**
     * Initialize all supported adapters
     */
    private async initializeAdapters(): Promise<void> {
        const adapterInitializers = new Map<AIProvider, () => AIAdapter>([
            [AIProvider.OpenAI, () => new OpenAIAdapter(this.settingsService, this.jsonValidationService)],
            [AIProvider.Anthropic, () => new AnthropicAdapter(this.settingsService, this.jsonValidationService)],
            [AIProvider.Google, () => new GeminiAdapter(this.settingsService, this.jsonValidationService)],
            [AIProvider.Groq, () => new GroqAdapter(this.settingsService, this.jsonValidationService)],
            [AIProvider.OpenRouter, () => new OpenRouterAdapter(this.settingsService, this.jsonValidationService)],
            [AIProvider.LMStudio, () => new LMStudioAdapter(this.settingsService, this.jsonValidationService)]
        ]);

        for (const [provider, initializer] of adapterInitializers) {
            try {
                this.adapters.set(provider, initializer());
                this.adapterStatus.set(provider, {
                    isInitialized: true,
                    isConnected: false
                });
            } catch (error) {
                console.error(`Failed to initialize adapter for ${provider}:`, error);
                this.updateAdapterStatus(provider, {
                    isInitialized: false,
                    isConnected: false,
                    lastError: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        this.updateState();
    }

    /**
     * Set up state subscriptions
     */
    private async setupSubscriptions(): Promise<void> {
        // Settings subscription
        const settingsUnsubscribe = this.stateManager.subscribe('settings', async (settings) => {
            if (!this.isUnloading && settings.aiProvider !== this.currentProvider) {
                await this.handleProviderChange(settings.aiProvider);
            }
        });
        this.unsubscribeCallbacks.push(settingsUnsubscribe);

        // AI state subscription
        const aiStateUnsubscribe = this.stateManager.subscribe('ai', () => {
            if (!this.isUnloading) {
                this.stateSnapshot = this.stateManager.getSnapshot();
            }
        });
        this.unsubscribeCallbacks.push(aiStateUnsubscribe);
    }

    /**
     * Handle provider changes
     */
    public async handleProviderChange(newProvider: AIProvider): Promise<void> {
        if (this.isUnloading) return;

        try {
            const adapter = this.getAdapter(newProvider);
            if (!adapter) {
                throw new Error(`No adapter available for provider: ${newProvider}`);
            }

            const isValid = await this.validateAdapter(newProvider);
            if (!isValid) {
                throw new Error(`Failed to validate adapter for provider: ${newProvider}`);
            }

            this.currentProvider = newProvider;
            this.updateState();
        } catch (error) {
            this.handleError(error as Error);
            
            if (!this.isUnloading) {
                this.stateManager.update('settings', {
                    aiProvider: this.currentProvider
                });
            }
        }
    }

    // Rest of the public interface methods remain the same, but with isUnloading checks added
    
    public getAdapter(provider: AIProvider): AIAdapter | undefined {
        return this.adapters.get(provider);
    }

    public getCurrentAdapter(): AIAdapter {
        if (this.isUnloading) {
            throw new Error('Service is being unloaded');
        }

        const adapter = this.getAdapter(this.currentProvider);
        if (!adapter) {
            throw new Error(`No adapter available for current provider: ${this.currentProvider}`);
        }
        return adapter;
    }

    public async validateAdapter(provider: AIProvider): Promise<boolean> {
        if (this.isUnloading) return false;

        const adapter = this.getAdapter(provider);
        if (!adapter) return false;

        try {
            const isValid = await adapter.validateApiKey();
            this.updateAdapterStatus(provider, {
                isConnected: isValid,
                lastValidated: Date.now()
            });
            return isValid;
        } catch (error) {
            this.updateAdapterStatus(provider, {
                isConnected: false,
                lastError: error instanceof Error ? error.message : 'Unknown error',
                lastValidated: Date.now()
            });
            return false;
        }
    }

    public async testConnection(provider: AIProvider): Promise<boolean> {
        if (this.isUnloading) return false;

        const adapter = this.getAdapter(provider);
        if (!adapter) {
            this.handleError(new Error(`No adapter available for provider: ${provider}`));
            return false;
        }

        try {
            const models = this.getAvailableModels(provider);
            if (models.length === 0) {
                throw new Error(`No models available for provider: ${provider}`);
            }

            const testModel = models[0].apiName;
            const testPrompt = "Return the word 'OK'.";
            const isConnected = await adapter.testConnection(testPrompt, testModel);

            this.updateAdapterStatus(provider, {
                isConnected,
                lastConnected: isConnected ? Date.now() : undefined,
                lastError: isConnected ? undefined : 'Connection test failed'
            });

            return isConnected;
        } catch (error) {
            this.updateAdapterStatus(provider, {
                isConnected: false,
                lastError: error instanceof Error ? error.message : 'Unknown error during connection test'
            });

            this.handleError(error instanceof Error ? error : new Error('Connection test failed'));
            return false;
        }
    }

    public updateAdapterStatus(
        provider: AIProvider,
        status: Partial<AdapterStatus>
    ): void {
        if (this.isUnloading) return;

        const currentStatus = this.adapterStatus.get(provider) || {
            isInitialized: false,
            isConnected: false
        };
        
        this.adapterStatus.set(provider, {
            ...currentStatus,
            ...status
        });
        
        this.updateState();
    }

    public getAvailableModels(provider: AIProvider): AIModel[] {
        return AIModelMap[provider] || [];
    }

    private updateState(): void {
        if (this.isUnloading) return;

        const currentAdapter = this.adapters.get(this.currentProvider);
        const currentStatus = this.adapterStatus.get(this.currentProvider);

        if (currentAdapter && currentStatus) {
            this.stateManager.update('ai', {
                isConnected: currentStatus.isConnected,
                currentModel: currentAdapter.getApiKey() ? 
                    AIModelMap[this.currentProvider][0].apiName : '',
                isProcessing: false,
                provider: this.currentProvider,
                availableModels: this.getAvailableModels(this.currentProvider),
                error: currentStatus.lastError
            });
        }
    }

    private handleError(error: Error): void {
        if (this.isUnloading) return;

        console.error('AdapterRegistry error:', error);
        this.serviceError = new ServiceError(this.serviceName, error.message);
        
        this.stateManager.update('ai', {
            error: error.message,
            lastError: {
                message: error.message,
                timestamp: Date.now()
            },
            isConnected: false,
            isProcessing: false
        });
    }

    // Utility methods
    public getAdapterStatus(provider: AIProvider): AdapterStatus | undefined {
        return this.adapterStatus.get(provider);
    }

    public getAllAdapterStatus(): Map<AIProvider, AdapterStatus> {
        return new Map(this.adapterStatus);
    }

    public isAdapterHealthy(provider: AIProvider): boolean {
        const status = this.adapterStatus.get(provider);
        return !!(status?.isInitialized && status?.isConnected);
    }

    public getHealthyAdapters(): AIProvider[] {
        return Array.from(this.adapterStatus.entries())
            .filter(([_, status]) => status.isInitialized && status.isConnected)
            .map(([provider]) => provider);
    }

    public getAllAvailableModels(): { provider: AIProvider; model: AIModel }[] {
        const models: { provider: AIProvider; model: AIModel }[] = [];
        for (const provider of this.adapters.keys()) {
            const providerModels = this.getAvailableModels(provider);
            providerModels.forEach(model => {
                models.push({ provider, model });
            });
        }
        return models;
    }
}