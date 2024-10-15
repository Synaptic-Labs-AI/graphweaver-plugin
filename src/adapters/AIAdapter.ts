// src/adapters/AIAdapter.ts

import { AIProvider, AIResponse } from '../models/AIModels';

export interface AIAdapter {
    generateResponse(prompt: string, model: string, options?: { maxTokens?: number }): Promise<AIResponse>;
    validateApiKey(): Promise<boolean>;
    getAvailableModels(): string[];
    getProviderType(): AIProvider;
    setApiKey(apiKey: string): void;
    getApiKey(): string;
    configure(config: any): void;
    isReady(): boolean;
    getApiModelName(modelName: string): string | undefined;
}
