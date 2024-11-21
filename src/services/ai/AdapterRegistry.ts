import { AIProvider, AIAdapter, AIModel } from '@type/ai.types';
import { AIModelMap } from '@type/aiModels';
import { OpenAIAdapter } from "@adapters/OpenAIAdapter";
import { AnthropicAdapter } from "@adapters/AnthropicAdapter";
import { GeminiAdapter } from "@adapters/GeminiAdapter";
import { GroqAdapter } from "@adapters/GroqAdapter";
import { OpenRouterAdapter } from "@adapters/OpenRouterAdapter";
import { LMStudioAdapter } from "@adapters/LMStudioAdapter";
import { SettingsService } from "../SettingsService";
import { JsonValidationService } from '@services/JsonValidationService';
import { IService } from '@services/core/IService';
import { LifecycleState } from '@type/base.types';import { ServiceError } from '@services/core/ServiceError';
import { aiStore } from '@stores/AIStore';
import { settingsStore } from '@stores/SettingStore';
import type { Unsubscriber } from 'svelte/store';
import { get } from 'svelte/store';

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
 */
export class AdapterRegistry implements IService {
    // IService implementation
    public readonly serviceId = 'adapter-registry';
    public readonly serviceName = 'Adapter Registry';
    private LifecycleState: LifecycleState = LifecycleState.Uninitialized;
    private serviceError: ServiceError | null = null;

    // Adapter management
    private adapters: Map<AIProvider, AIAdapter>;
    private adapterStatus: Map<AIProvider, AdapterStatus>;
    private currentProvider: AIProvider;
    private unsubscribers: Unsubscriber[] = [];
    private isUnloading = false;

    constructor(
        private settingsService: SettingsService,
        private jsonValidationService: JsonValidationService
    ) {
        this.adapters = new Map();
        this.adapterStatus = new Map();
        
        // Get initial provider from settings store
        const settings = get(settingsStore);
        this.currentProvider = settings.aiProvider.selected;
    }

    /**
     * Get current service state
     */
    public getState(): { state: LifecycleState; error: ServiceError | null } {
        return {
            state: this.LifecycleState,
            error: this.serviceError
        };
    }

    /**
     * Initialize the service and adapters
     */
    public async initialize(): Promise<void> {
        try {
            this.LifecycleState = LifecycleState.Initializing;
            await this.initializeAdapters();
            this.setupSubscriptions();
            this.LifecycleState = LifecycleState.Ready;
        } catch (error) {
            this.LifecycleState = LifecycleState.Error;
            this.serviceError = error instanceof ServiceError ? error : 
                new ServiceError(this.serviceName, 'Failed to initialize adapters');
            throw this.serviceError;
        }
    }

    /**
     * Check if service is ready
     */
    public isReady(): boolean {
        return this.LifecycleState === LifecycleState.Ready && !this.isUnloading;
    }

    /**
     * Clean up resources and destroy adapters
     */
    public async destroy(): Promise<void> {
        if (this.isUnloading) return;

        try {
            this.isUnloading = true;
            this.LifecycleState = LifecycleState.Destroying;

            // Clean up subscriptions
            this.unsubscribers.forEach(unsubscribe => unsubscribe());
            this.unsubscribers = [];

            // Clean up adapters
            const cleanupPromises = Array.from(this.adapters.values())
                .map(async (adapter) => {
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

            await Promise.all(cleanupPromises);
            this.adapters.clear();
            this.adapterStatus.clear();

            this.updateAIStore();
            this.LifecycleState = LifecycleState.Destroyed;

        } catch (error) {
            this.LifecycleState = LifecycleState.Error;
            this.serviceError = error instanceof ServiceError ? error :
                new ServiceError(this.serviceName, 'Failed to destroy adapters');
            throw this.serviceError;
        }
    }

    /**
     * Set up store subscriptions
     */
    private setupSubscriptions(): void {
        // Monitor settings changes
        const settingsUnsub = settingsStore.subscribe(settings => {
            if (!this.isUnloading && settings.aiProvider.selected !== this.currentProvider) {
                void this.handleProviderChange(settings.aiProvider.selected);
            }
        });

        this.unsubscribers.push(settingsUnsub);
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

        this.updateAIStore();
    }

    /**
     * Handle provider changes
     */
    private async handleProviderChange(newProvider: AIProvider): Promise<void> {
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
            this.updateAIStore();
        } catch (error) {
            this.handleError(error as Error);
            
            if (!this.isUnloading) {
                settingsStore.update(settings => ({
                    ...settings,
                    aiProvider: {
                        ...settings.aiProvider,
                        selected: this.currentProvider
                    }
                }));
            }
        }
    }

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
            const models = AIModelMap[provider] || [];
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

    private updateAdapterStatus(
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
        
        this.updateAIStore();
    }

    private updateAIStore(): void {
        if (this.isUnloading) return;

        const currentAdapter = this.adapters.get(this.currentProvider);
        const currentStatus = this.adapterStatus.get(this.currentProvider);

        if (currentAdapter && currentStatus) {
            aiStore.update(state => ({
                ...state,
                isConnected: currentStatus.isConnected,
                currentModel: currentAdapter.getApiKey() ? 
                    AIModelMap[this.currentProvider][0].apiName : '',
                isProcessing: false,
                provider: this.currentProvider,
                availableModels: AIModelMap[this.currentProvider] || [],
                error: currentStatus.lastError
            }));
        }
    }

    private handleError(error: Error): void {
        if (this.isUnloading) return;

        console.error('AdapterRegistry error:', error);
        this.serviceError = new ServiceError(this.serviceName, error.message);
        
        aiStore.update(state => ({
            ...state,
            error: error.message,
            lastError: {
                message: error.message,
                timestamp: Date.now()
            },
            isConnected: false,
            isProcessing: false
        }));
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

    public getAllAvailableModels(): AIModel[] {
        const allModels: AIModel[] = [];
        for (const provider of this.adapters.keys()) {
            allModels.push(...(AIModelMap[provider] || []));
        }
        return allModels;
    }
}