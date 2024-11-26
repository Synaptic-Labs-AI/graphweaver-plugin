/**
 * Defines the available AI providers
 */
export enum AIProvider {
    OpenRouter = 'openrouter',
    OpenAI = 'openai',
    Anthropic = 'anthropic',
    Google = 'google',
    Groq = 'groq',
    Mistral = 'mistral',
    Perplexity = 'perplexity',
    LMStudio = 'lmstudio',
    
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
    /** Cost per million input tokens in USD */
    inputCostPer1M?: number;
    /** Cost per million output tokens in USD */
    outputCostPer1M?: number;
    /** Maximum context window size in tokens */
    contextWindow?: number;
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
 * Model information organized by provider
 */
export const AIModelMap: Record<AIProvider, AIModel[]> = {
    [AIProvider.OpenAI]: [
        { 
            name: 'GPT 4o mini',
            apiName: 'gpt-4o-mini',
            capabilities: {
                maxTokens: 16000,
                supportsFunctions: true,
                supportsStreaming: true
            },
            inputCostPer1M: 0.15,
            outputCostPer1M: 0.60,
            contextWindow: 128000
        },
        {
            name: 'GPT 4o',
            apiName: 'gpt-4o',
            capabilities: {
                maxTokens: 16000,
                supportsFunctions: true,
                supportsStreaming: true,
                supportsVision: true
            },
            inputCostPer1M: 2.50,
            outputCostPer1M: 10.00,
            contextWindow: 128000
        },
        {
            name: 'GPT o1 Preview',
            apiName: 'o1-preview',
            capabilities: {
                maxTokens: 33000,
                supportsFunctions: true,
                supportsStreaming: true
            },
            inputCostPer1M: 15.00,
            outputCostPer1M: 60.00,
            contextWindow: 128000
        },
        {
            name: 'GPT o1 Mini',
            apiName: 'o1-mini',
            capabilities: {
                maxTokens: 66000,
                supportsFunctions: true,
                supportsStreaming: true
            },
            inputCostPer1M: 3.00,
            outputCostPer1M: 12.00,
            contextWindow: 128000
        }
    ],
    [AIProvider.Anthropic]: [
        {
            name: 'Claude 3 Haiku',
            apiName: 'claude-3-haiku-20240307',
            capabilities: {
                maxTokens: 8192,
                supportsFunctions: true,
                supportsStreaming: true
            },
            inputCostPer1M: 0.25,
            outputCostPer1M: 1.25,
            contextWindow: 200000
        },
        {
            name: 'Claude 3.5 Haiku',
            apiName: 'claude-3-5-haiku-20241022',
            capabilities: {
                maxTokens: 8192,
                supportsFunctions: true,
                supportsStreaming: true
            },
            inputCostPer1M: 1.00,
            outputCostPer1M: 5.00,
            contextWindow: 200000
        },
        {
            name: 'Claude 3 Sonnet',
            apiName: 'claude-3-sonnet-20240229',
            capabilities: {
                maxTokens: 8192,
                supportsFunctions: true,
                supportsStreaming: true,
                supportsVision: true
            },
            inputCostPer1M: 3.00,
            outputCostPer1M: 15.00,
            contextWindow: 200000
        },
        {
            name: 'Claude 3 Opus',
            apiName: 'claude-3-opus-20240229',
            capabilities: {
                maxTokens: 8192,
                supportsFunctions: true,
                supportsStreaming: true,
                supportsVision: true
            },
            inputCostPer1M: 15.00,
            outputCostPer1M: 75.00,
            contextWindow: 200000
        },
        {
            name: 'Claude 3.5 Sonnet',
            apiName: 'claude-3-5-sonnet-20241022',
            capabilities: {
                maxTokens: 8192,
                supportsFunctions: true,
                supportsStreaming: true,
                supportsVision: true
            },
            inputCostPer1M: 3.00,
            outputCostPer1M: 15.00,
            contextWindow: 200000
        }
    ],
    [AIProvider.Google]: [
        {
            name: 'Gemini 1.5 Flash',
            apiName: 'gemini-1.5-flash',
            capabilities: {
                maxTokens: 8192,
                supportsStreaming: true
            },
            inputCostPer1M: 0.075,
            outputCostPer1M: 0.30,
            contextWindow: 1000000
        },
        {
            name: 'Gemini 1.5 Flash 8B',
            apiName: 'gemini-1.5-flash-8b',
            capabilities: {
                maxTokens: 8192,
                supportsStreaming: true
            },
            inputCostPer1M: 0.0375,
            outputCostPer1M: 0.15,
            contextWindow: 1000000
        },
        {
            name: 'Gemini 1.5 Pro',
            apiName: 'gemini-1.5-pro',
            capabilities: {
                maxTokens: 8192,
                supportsStreaming: true,
                supportsVision: true
            },
            inputCostPer1M: 2.50,
            outputCostPer1M: 10.00,
            contextWindow: 2000000
        }
    ],
    [AIProvider.Groq]: [
        {
            name: 'Llama 3.2 90B',
            apiName: 'llama-3.2-90b-vision-preview',
            capabilities: {
                maxTokens: 8192,
                supportsStreaming: true
            },
            inputCostPer1M: 0,
            outputCostPer1M: 0,
            contextWindow: 128000
        },
        {
            name: 'Llama 3.1 70B',
            apiName: 'llama-3.1-70b-versatile',
            capabilities: {
                maxTokens: 32768,
                supportsStreaming: true
            },
            inputCostPer1M: 0,
            outputCostPer1M: 0,
            contextWindow: 128000
        },
        {
            name: 'Llama 3.2 11B',
            apiName: 'llama-3.2-11b-vision-preview',
            capabilities: {
                maxTokens: 8192,
                supportsStreaming: true
            },
            inputCostPer1M: 0,
            outputCostPer1M: 0,
            contextWindow: 128000
        },
        {
            name: 'Llama 3.2 3B (Preview)',
            apiName: 'llama-3.2-3b-preview',
            capabilities: {
                maxTokens: 8192,
                supportsStreaming: true
            },
            inputCostPer1M: 0,
            outputCostPer1M: 0,
            contextWindow: 128000
        },
        {
            name: 'Llama 3.2 1B (Preview)',
            apiName: 'llama-3.2-1b-preview',
            capabilities: {
                maxTokens: 8192,
                supportsStreaming: true
            },
            inputCostPer1M: 0,
            outputCostPer1M: 0,
            contextWindow: 128000
        }
    ],
    [AIProvider.OpenRouter]: [
        {
            name: 'Claude 3.5 Haiku',
            apiName: 'anthropic/claude-3.5-haiku',
            capabilities: {
                maxTokens: 8192,
                supportsFunctions: true,
                supportsStreaming: true
            },
            inputCostPer1M: 1.00,
            outputCostPer1M: 1.00,
            contextWindow: 200000
        },
        {
            name: 'Anthropic Claude 3.5 Sonnet',
            apiName: 'anthropic/claude-3.5-sonnet',
            capabilities: {
                maxTokens: 8192,
                supportsFunctions: true,
                supportsStreaming: true,
                supportsVision: true
            },
            inputCostPer1M: 3.00,
            outputCostPer1M: 15.00,
            contextWindow: 200000
        },
        {
            name: 'Google Gemini Flash 1.5',
            apiName: 'google/gemini-flash-1.5',
            capabilities: {
                maxTokens: 8192,
                supportsStreaming: true
            },
            inputCostPer1M: 0.075,
            outputCostPer1M: 0.30,
            contextWindow: 1000000
        },
        {
            name: 'Google Gemini Flash 1.5 8B',
            apiName: 'google/gemini-flash-1.5-8b',
            capabilities: {
                maxTokens: 8192,
                supportsStreaming: true
            },
            inputCostPer1M: 0.0375,
            outputCostPer1M: 0.15,
            contextWindow: 1000000
        },
        {
            name: 'Google Gemini Pro 1.5',
            apiName: 'google/gemini-pro-1.5',
            capabilities: {
                maxTokens: 8192,
                supportsStreaming: true,
                supportsVision: true
            },
            inputCostPer1M: 1.25,
            outputCostPer1M: 5.00,
            contextWindow: 2000000
        },
        {
            name: 'Mistral Large',
            apiName: 'mistralai/mistral-large-2407',
            capabilities: {
                maxTokens: 128000,
                supportsStreaming: true
            },
            inputCostPer1M: 2.00,
            outputCostPer1M: 6.00,
            contextWindow: 128000
        },
        {
            name: 'Ministral 8b',
            apiName: 'mistralai/ministral-8b',
            capabilities: {
                maxTokens: 128000,
                supportsStreaming: true
            },
            inputCostPer1M: 0.10,
            outputCostPer1M: 0.10,
            contextWindow: 128000
        },
        {
            name: 'OpenAI GPT 4o',
            apiName: 'openai/gpt-4o-2024-11-20',
            capabilities: {
                maxTokens: 16000,
                supportsFunctions: true,
                supportsStreaming: true,
                supportsVision: true
            },
            inputCostPer1M: 2.50,
            outputCostPer1M: 10.00,
            contextWindow: 128000
        },
        {
            name: 'OpenAI GPT 4o Mini',
            apiName: 'openai/gpt-4o-mini',
            capabilities: {
                maxTokens: 16000,
                supportsFunctions: true,
                supportsStreaming: true
            },
            inputCostPer1M: 0.15,
            outputCostPer1M: 0.60,
            contextWindow: 128000
        },
        {
            name: 'OpenAI o1 Mini',
            apiName: 'openai/o1-mini',
            capabilities: {
                maxTokens: 66000,
                supportsFunctions: true,
                supportsStreaming: true
            },
            inputCostPer1M: 3.00,
            outputCostPer1M: 12.00,
            contextWindow: 128000
        },
        {
            name: 'OpenAI o1 Preview',
            apiName: 'openai/o1-preview',
            capabilities: {
                maxTokens: 33000,
                supportsFunctions: true,
                supportsStreaming: true
            },
            inputCostPer1M: 15.00,
            outputCostPer1M: 60.00,
            contextWindow: 128000
        }
    ],
    [AIProvider.Perplexity]: [
        {
            name: 'Perplexity Small',
            apiName: 'perplexity-small',
            capabilities: {
                maxTokens: 4096,
                supportsStreaming: true
            },
            inputCostPer1M: 0.20,
            outputCostPer1M: 0.20,
            contextWindow: 128000
        },
        {
            name: 'Perplexity Medium',
            apiName: 'perplexity-medium',
            capabilities: {
                maxTokens: 8192,
                supportsStreaming: true
            },
            inputCostPer1M: 0.50,
            outputCostPer1M: 0.50,
            contextWindow: 128000
        },
        {
            name: 'Perplexity Large',
            apiName: 'perplexity-large',
            capabilities: {
                maxTokens: 16384,
                supportsStreaming: true
            },
            inputCostPer1M: 1.00,
            outputCostPer1M: 1.00,
            contextWindow: 128000
        }
    ],
    [AIProvider.LMStudio]: [
        {
            name: 'Custom',
            apiName: 'custom',
            capabilities: {
                supportsStreaming: false
            },
        }
    ],
    [AIProvider.Mistral]: [ // Added Mistral models
        {
            name: 'Mistral Large',
            apiName: 'mistral-large-latest',
            capabilities: {
                maxTokens: 8192,
                supportsStreaming: true
            },
            inputCostPer1M: 0,
            outputCostPer1M: 0,
            contextWindow: 128000
        },
        {
            name: 'Ministral 8b',
            apiName: 'ministral-8b-latest',
            capabilities: {
                maxTokens: 8192,
                supportsStreaming: true
            },
            inputCostPer1M: 0,
            outputCostPer1M: 0,
            contextWindow: 128000
        },
        {
            name: 'Mistral Nemo',
            apiName: 'open-mistral-nemo',
            capabilities: {
                maxTokens: 8192,
                supportsStreaming: true
            },
            inputCostPer1M: 0,
            outputCostPer1M: 0,
            contextWindow: 128000
        },
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