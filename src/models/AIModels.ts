/**
 * Defines the available AI providers
 */
export enum AIProvider {
    OpenAI = 'openai',
    Anthropic = 'anthropic',
    Google = 'google',
    Groq = 'groq',
    OpenRouter = 'openrouter',
    LMStudio = 'lmstudio'
}

/**
 * Type for provider keys
 */
export type AIProviderType = keyof typeof AIProvider;

/**
 * Options for AI response generation
 */
export interface AIResponseOptions {
    /** Skip JSON validation and return raw response */
    rawResponse?: boolean;
    /** Maximum tokens to generate */
    maxTokens?: number;
    /** Temperature for response generation */
    temperature?: number;
    /** Additional provider-specific options */
    providerOptions?: Record<string, unknown>;
}

/**
 * Structure of AI response
 */
export interface AIResponse {
    /** Whether the request was successful */
    success: boolean;
    /** Response data if successful */
    data?: unknown;
    /** Error message if unsuccessful */
    error?: string;
}

/**
 * AI model definition
 */
export interface AIModel {
    /** Display name of the model */
    name: string;
    /** API identifier for the model */
    apiName: string;
    /** Optional model capabilities */
    capabilities?: {
        maxTokens?: number;
        supportsFunctions?: boolean;
        supportsStreaming?: boolean;
        supportsVision?: boolean;
    };
}

/**
 * Model configuration options
 */
export interface AIModelConfig {
    /** Maximum tokens to generate */
    maxTokens?: number;
    /** Temperature for generation */
    temperature?: number;
    /** Model-specific configuration */
    modelSpecific?: Record<string, unknown>;
}

/**
 * Core AI adapter interface
 */
export interface AIAdapter {
    /**
     * Generate a response from the AI model
     * @param prompt The input prompt
     * @param model The model to use
     * @param options Generation options
     */
    generateResponse(
        prompt: string,
        model: string,
        options?: AIResponseOptions
    ): Promise<AIResponse>;

    /**
     * Test connection to the AI provider
     * @param prompt Test prompt
     * @param model Model to test
     */
    testConnection(prompt: string, model: string): Promise<boolean>;

    /**
     * Validate the API key
     */
    validateApiKey(): Promise<boolean>;

    /**
     * Get available models for this provider
     */
    getAvailableModels(): string[];

    /**
     * Get the provider type
     */
    getProviderType(): AIProvider;

    /**
     * Set the API key
     */
    setApiKey(apiKey: string): void;

    /**
     * Get the current API key
     */
    getApiKey(): string;

    /**
     * Configure the adapter
     * @param config Configuration options
     */
    configure(config: AIModelConfig): void;

    /**
     * Check if the adapter is ready
     */
    isReady(): boolean;

    /**
     * Get the API name for a model
     * @param modelName Model name to look up
     */
    getApiModelName(modelName: string): string | undefined;

        /**
     * Clean up adapter resources
     */
        destroy?(): Promise<void>;
}

/**
 * Model information organized by provider
 */
export const AIModelMap: Record<AIProvider, AIModel[]> = {
    [AIProvider.OpenAI]: [
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
    ],
    [AIProvider.Anthropic]: [
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
    ],
    [AIProvider.Google]: [
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
    ],
    [AIProvider.Groq]: [
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
    ],
    [AIProvider.OpenRouter]: [
        {
            name: 'Anthropic Claude 3 Haiku',
            apiName: 'anthropic/claude-3-haiku',
            capabilities: {
                maxTokens: 200000,
                supportsFunctions: true,
                supportsStreaming: true
            }
        },
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
        }
    ],
    [AIProvider.LMStudio]: [
        {
            name: 'Custom',
            apiName: 'custom',
            capabilities: {
                supportsStreaming: false
            }
        }
    ]
};

/**
 * Helper utilities for working with AI models
 */
export const AIModelUtils = {
    /**
     * Get a model by its API name
     */
    getModelByApiName(apiName: string): AIModel | undefined {
        for (const models of Object.values(AIModelMap)) {
            const model = models.find(m => m.apiName === apiName);
            if (model) return model;
        }
        return undefined;
    },

    /**
     * Get all models for a provider
     */
    getModelsForProvider(provider: AIProvider): AIModel[] {
        return AIModelMap[provider] || [];
    },

    /**
     * Check if a model supports a capability
     */
    modelSupportsCapability(model: AIModel, capability: keyof AIModel['capabilities']): boolean {
        return !!model.capabilities?.[capability];
    }
};