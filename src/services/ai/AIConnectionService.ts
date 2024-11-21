import { AIProvider, AIAdapter } from '@type/ai.types';
import { AdapterRegistry } from './AdapterRegistry';
import { ServiceError } from '@services/core/ServiceError';

/**
 * Handles AI provider connection testing and status management
 */
export class AIConnectionService {
    constructor(private adapterRegistry: AdapterRegistry) {}

    /**
     * Test connection for a specific provider
     */
    public async testConnection(provider: AIProvider): Promise<boolean> {
        try {
            const adapter = this.getAdapter(provider);
            const testModel = adapter.getAvailableModels()[0];
            return await adapter.testConnection("Return the word 'OK'.", testModel);
        } catch (error) {
            throw new ServiceError(`Failed to test connection for provider ${provider}`, (error as Error).message);
        }
    }

    /**
     * Get adapter for provider
     */
    private getAdapter(provider: AIProvider): AIAdapter {
        const adapter = this.adapterRegistry.getAdapter(provider);
        if (!adapter) {
            throw new Error(`No adapter available for provider: ${provider}`);
        }
        return adapter;
    }

    /**
     * Check if a specific provider is available
     */
    public isProviderAvailable(provider: AIProvider): boolean {
        try {
            return !!this.getAdapter(provider)?.isReady();
        } catch {
            return false;
        }
    }

    /**
     * Get available models for a provider
     */
    public getAvailableModels(provider: AIProvider): string[] {
        try {
            return this.getAdapter(provider).getAvailableModels();
        } catch (error) {
            throw new ServiceError(`Failed to get models for provider ${provider}`, (error as Error).message);
        }
    }

    /**
     * Validate API key for a provider
     */
    public async validateApiKey(provider: AIProvider, apiKey: string): Promise<boolean> {
        try {
            const adapter = this.getAdapter(provider);
            adapter.setApiKey(apiKey);
            return await adapter.validateApiKey();
        } catch (error) {
            throw new ServiceError(`Failed to validate API key for provider ${provider}`, (error as Error).message);
        }
    }
}