import { AIProvider, AIAdapter } from '../../models/AIModels';
import { AdapterRegistry } from './AdapterRegistry';
import { AIServiceError } from './AIServiceError';

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
            throw new AIServiceError(`Failed to test connection for provider ${provider}`, error);
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
            throw new AIServiceError(`Failed to get models for provider ${provider}`, error);
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
            throw new AIServiceError(`Failed to validate API key for provider ${provider}`, error);
        }
    }
}