// src/models/AIModels.ts

export enum AIProvider {
    OpenAI = 'openai',
    Anthropic = 'anthropic',
    Google = 'google',
    Groq = 'groq',
    OpenRouter = 'openrouter',
    LMStudio = 'lmstudio'
}

export type AIProviderType = keyof typeof AIProvider;

export interface AIResponse {
    success: boolean;
    data?: any;
    error?: string;
}

export interface AIModel {
    name: string;
    apiName: string;
}

export interface AIModelConfig {
    maxTokens?: number;
    temperature?: number;
}

export interface AIAdapter {
    generateResponse(prompt: string, model: string): Promise<AIResponse>;
    testConnection(prompt: string, model: string): Promise<boolean>;
    validateApiKey(): Promise<boolean>;
    getAvailableModels(): string[];
    getProviderType(): AIProvider;
    setApiKey(apiKey: string): void;
    getApiKey(): string;
    configure(config: any): void;
    isReady(): boolean;
    getApiModelName(modelName: string): string | undefined;
}

export const AIModelMap: Record<AIProvider, AIModel[]> = {
    [AIProvider.OpenAI]: [
        { name: 'GPT 4o mini', apiName: 'gpt-4o-mini' },
        { name: 'GPT 4o', apiName: 'gpt-4o' },
        { name: 'GPT o1 Preview', apiName: 'o1-preview' },
        { name: 'GPT o1 Mini', apiName: 'o1-mini' }
    ],
    [AIProvider.Anthropic]: [
        { name: 'Claude 3 Haiku', apiName: 'claude-3-haiku-20240307' },
        { name: 'Claude 3 Sonnet', apiName: 'claude-3-sonnet-20240229' },
        { name: 'Claude 3 Opus', apiName: 'claude-3-opus-20240229' },
        { name: 'Claude 3.5 Sonnet', apiName: 'claude-3-5-sonnet-20240620' }
    ],
    [AIProvider.Google]: [
        { name: 'Gemini 1.5 Flash', apiName: 'gemini-1.5-flash' },
        { name: 'Gemini 1.5 Flash 8B', apiName: 'gemini-1.5-flash-8b' },
        { name: 'Gemini 1.5 Pro', apiName: 'gemini-1.5-pro' }
    ],
    [AIProvider.Groq]: [
        { name: 'Llama 3.1 70B', apiName: 'llama-3.1-70b-versatile' },
        { name: 'Llama 3.1 8B', apiName: 'llama-3.1-8b-instant' },
        { name: 'Llama 3.2 1B (Preview)', apiName: 'llama-3.2-1b-preview' },
        { name: 'Llama 3.2 3B (Preview)', apiName: 'llama-3.2-3b-preview' }
    ],
    [AIProvider.OpenRouter]: [
        { name: 'Anthropic Claude 3 Haiku', apiName: 'anthropic/claude-3-haiku' },
        { name: 'Anthropic Claude 3 Opus', apiName: 'anthropic/claude-3-opus' },
        { name: 'Anthropic Claude 3.5 Sonnet', apiName: 'anthropic/claude-3.5-sonnet' },
        { name: 'Google Gemini Flash 1.5', apiName: 'google/gemini-flash-1.5' },
        { name: 'Google Gemini Flash 1.5 8B', apiName: 'google/gemini-flash-1.5-8b' },
        { name: 'Google Gemini Pro 1.5', apiName: 'google/gemini-pro-1.5' },
        { name: 'Mistralai Mistral Large', apiName: 'mistralai/mistral-large' },
        { name: 'Mistralai Mistral Nemo', apiName: 'mistralai/mistral-nemo' },
        { name: 'OpenAI GPT 4o', apiName: 'openai/gpt-4o' },
        { name: 'OpenAI GPT 4o Mini', apiName: 'openai/gpt-4o-mini' },
        { name: 'OpenAI o1 Mini', apiName: 'openai/o1-mini' },
        { name: 'OpenAI o1 Preview', apiName: 'openai/o1-preview' }
    ],
    [AIProvider.LMStudio]: [
        { name: 'Custom', apiName: 'custom' }
    ]
};
