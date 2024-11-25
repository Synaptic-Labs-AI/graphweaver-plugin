/**
 * AI Types Module
 * @module types/ai
 * @description Core type definitions for AI functionality
 */

/**
 * Defines the available AI providers
 * @enum {string}
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
 * Model capabilities interface
 * @interface
 */
export interface AIModelCapabilities {
    /** Maximum tokens the model can process */
    maxTokens?: number;
    /** Whether the model supports function calling */
    supportsFunctions?: boolean;
    /** Whether the model supports streaming responses */
    supportsStreaming?: boolean;
    /** Whether the model supports vision/image input */
    supportsVision?: boolean;
}

/**
 * AI model definition
 * @interface
 */
export interface AIModel {
    /** Display name of the model */
    name: string;
    /** API identifier for the model */
    apiName: string;
    /** Model capabilities */
    capabilities?: AIModelCapabilities;
}

/**
 * Options for AI response generation
 * @interface
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
 * @interface
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
 * Model configuration options
 * @interface
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
 * @interface
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
 * AI state definition
 * @interface
 */

export interface KnowledgeBloomSettings {
    selectedModel: string;
    defaultPrompt?: string;
}

export interface GeneratedNote {
    title: string;
    content: string;
}

export interface KnowledgeBloomResult {
    generatedNotes: GeneratedNote[];
    stats?: {
        processedLinks: number;
        successfulGenerations: number;
        errors: number;
    };
}
