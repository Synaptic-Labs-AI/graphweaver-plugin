import { AIProvider, AIModel } from './ai.types';

// OpenAI Models
const OpenAIModels: AIModel[] = [
    { 
        name: 'GPT 4o mini',
        apiName: 'gpt-4o-mini',
        capabilities: {
            maxTokens: 128000,
            supportsFunctions: true,
            supportsStreaming: true
        }
    },
    {
        name: 'GPT 4o',
        apiName: 'gpt-4o',
        capabilities: {
            maxTokens: 128000,
            supportsFunctions: true,
            supportsStreaming: true,
            supportsVision: true
        }
    },
    {
        name: 'GPT o1 Preview',
        apiName: 'o1-preview',
        capabilities: {
            maxTokens: 128000,
            supportsFunctions: true,
            supportsStreaming: true
        }
    },
    {
        name: 'GPT o1 Mini',
        apiName: 'o1-mini',
        capabilities: {
            maxTokens: 128000,
            supportsFunctions: true,
            supportsStreaming: true
        }
    }
];

// Anthropic Models
const AnthropicModels: AIModel[] = [
    {
        name: 'Claude 3 Haiku',
        apiName: 'claude-3-haiku-20240307',
        capabilities: {
            maxTokens: 200000,
            supportsFunctions: true,
            supportsStreaming: true
        }
    },
    {
        name: 'Claude 3 Sonnet',
        apiName: 'claude-3-sonnet-20240229',
        capabilities: {
            maxTokens: 200000,
            supportsFunctions: true,
            supportsStreaming: true,
            supportsVision: true
        }
    },
    {
        name: 'Claude 3 Opus',
        apiName: 'claude-3-opus-20240229',
        capabilities: {
            maxTokens: 200000,
            supportsFunctions: true,
            supportsStreaming: true,
            supportsVision: true
        }
    },
    {
        name: 'Claude 3.5 Sonnet',
        apiName: 'claude-3-5-sonnet-20240620',
        capabilities: {
            maxTokens: 200000,
            supportsFunctions: true,
            supportsStreaming: true,
            supportsVision: true
        }
    }
];

// Google Models
const GoogleModels: AIModel[] = [
    {
        name: 'Gemini 1.5 Flash',
        apiName: 'gemini-1.5-flash',
        capabilities: {
            maxTokens: 32000,
            supportsStreaming: true
        }
    },
    {
        name: 'Gemini 1.5 Flash 8B',
        apiName: 'gemini-1.5-flash-8b',
        capabilities: {
            maxTokens: 32000,
            supportsStreaming: true
        }
    },
    {
        name: 'Gemini 1.5 Pro',
        apiName: 'gemini-1.5-pro',
        capabilities: {
            maxTokens: 32000,
            supportsStreaming: true,
            supportsVision: true
        }
    }
];

// Groq Models
const GroqModels: AIModel[] = [
    {
        name: 'Llama 3.1 70B',
        apiName: 'llama-3.1-70b-versatile',
        capabilities: {
            maxTokens: 32000,
            supportsStreaming: true
        }
    },
    {
        name: 'Llama 3.1 8B',
        apiName: 'llama-3.1-8b-instant',
        capabilities: {
            maxTokens: 32000,
            supportsStreaming: true
        }
    },
    {
        name: 'Llama 3.2 1B (Preview)',
        apiName: 'llama-3.2-1b-preview',
        capabilities: {
            maxTokens: 32000,
            supportsStreaming: true
        }
    },
    {
        name: 'Llama 3.2 3B (Preview)',
        apiName: 'llama-3.2-3b-preview',
        capabilities: {
            maxTokens: 32000,
            supportsStreaming: true
        }
    }
];

// OpenRouter Models
const OpenRouterModels: AIModel[] = [
    {
        name: 'Anthropic Claude 3 Opus',
        apiName: 'anthropic/claude-3-opus',
        capabilities: {
            maxTokens: 200000,
            supportsFunctions: true,
            supportsStreaming: true,
            supportsVision: true
        }
    },
    {
        name: 'Anthropic Claude 3.5 Sonnet',
        apiName: 'anthropic/claude-3.5-sonnet',
        capabilities: {
            maxTokens: 200000,
            supportsFunctions: true,
            supportsStreaming: true,
            supportsVision: true
        }
    },
    {
        name: 'Google Gemini Flash 1.5',
        apiName: 'google/gemini-flash-1.5',
        capabilities: {
            maxTokens: 32000,
            supportsStreaming: true
        }
    },
    {
        name: 'Google Gemini Flash 1.5 8B',
        apiName: 'google/gemini-flash-1.5-8b',
        capabilities: {
            maxTokens: 32000,
            supportsStreaming: true
        }
    },
    {
        name: 'Google Gemini Pro 1.5',
        apiName: 'google/gemini-pro-1.5',
        capabilities: {
            maxTokens: 32000,
            supportsStreaming: true,
            supportsVision: true
        }
    },
    {
        name: 'Mistralai Mistral Large',
        apiName: 'mistralai/mistral-large',
        capabilities: {
            maxTokens: 32000,
            supportsStreaming: true
        }
    },
    {
        name: 'Mistralai Mistral Nemo',
        apiName: 'mistralai/mistral-nemo',
        capabilities: {
            maxTokens: 32000,
            supportsStreaming: true
        }
    },
    {
        name: 'OpenAI GPT 4o',
        apiName: 'openai/gpt-4o',
        capabilities: {
            maxTokens: 128000,
            supportsFunctions: true,
            supportsStreaming: true,
            supportsVision: true
        }
    },
    {
        name: 'OpenAI GPT 4o Mini',
        apiName: 'openai/gpt-4o-mini',
        capabilities: {
            maxTokens: 128000,
            supportsFunctions: true,
            supportsStreaming: true
        }
    },
    {
        name: 'OpenAI o1 Mini',
        apiName: 'openai/o1-mini',
        capabilities: {
            maxTokens: 128000,
            supportsFunctions: true,
            supportsStreaming: true
        }
    },
    {
        name: 'OpenAI o1 Preview',
        apiName: 'openai/o1-preview',
        capabilities: {
            maxTokens: 128000,
            supportsFunctions: true,
            supportsStreaming: true
        }
    },

];

// LMStudio Models
const LMStudioModels: AIModel[] = [
    {
        name: 'Custom',
        apiName: 'custom',
        capabilities: {
            supportsStreaming: false
        }
    }
];

/**
 * Complete mapping of all AI models by provider
 */
export const AIModelMap: Record<AIProvider, AIModel[]> = {
    [AIProvider.OpenAI]: OpenAIModels,
    [AIProvider.Anthropic]: AnthropicModels,
    [AIProvider.Google]: GoogleModels,
    [AIProvider.Groq]: GroqModels,
    [AIProvider.OpenRouter]: OpenRouterModels,
    [AIProvider.LMStudio]: LMStudioModels
};

/**
 * Utility functions for working with AI models
 */
export const AIModelUtils = {
    /**
     * Get a model by its API name
     * @param apiName The API name to look up
     * @returns The matching model or undefined
     */
    getModelByApiName(apiName: string): AIModel | undefined {
        for (const models of Object.values(AIModelMap)) {
            const model = models.find(m => m.apiName === apiName);
            if (model) return model;
        }
        return undefined;
    },

    /**
     * Get all models for a specific provider
     * @param provider The provider to get models for
     * @returns Array of models for the provider
     */
    getModelsForProvider(provider: AIProvider): AIModel[] {
        return AIModelMap[provider] || [];
    },

    /**
     * Check if a model supports a specific capability
     * @param model The model to check
     * @param capability The capability to check for
     * @returns Whether the model supports the capability
     */
    modelSupportsCapability(model: AIModel, capability: keyof AIModel['capabilities']): boolean {
        return !!model.capabilities?.[capability];
    },

    /**
     * Get all models that support a specific capability
     * @param capability The capability to filter by
     * @returns Array of models that support the capability
     */
    getModelsByCapability(capability: keyof AIModel['capabilities']): AIModel[] {
        const supportedModels: AIModel[] = [];
        for (const models of Object.values(AIModelMap)) {
            supportedModels.push(...models.filter(m => this.modelSupportsCapability(m, capability)));
        }
        return supportedModels;
    },

    /**
     * Get models by provider and capability
     * @param provider The provider to filter by
     * @param capability The capability to filter by
     * @returns Array of matching models
     */
    getModelsByProviderAndCapability(
        provider: AIProvider, 
        capability: keyof AIModel['capabilities']
    ): AIModel[] {
        return this.getModelsForProvider(provider)
            .filter(m => this.modelSupportsCapability(m, capability));
    }
};