// src/adapters/GroqAdapter.ts

import { Notice, requestUrl, RequestUrlResponse } from 'obsidian';
import { AIProvider, AIResponse, AIAdapter, AIModel, AIModelMap } from '../models/AIModels';
import { SettingsService } from '../services/SettingsService';

export class GroqAdapter implements AIAdapter {
    public apiKey: string;
    public models: AIModel[];

    constructor(public settingsService: SettingsService) {
        const aiProviderSettings = this.settingsService.getSetting('aiProvider');
        this.apiKey = aiProviderSettings.apiKeys[AIProvider.Groq] || '';
        this.models = AIModelMap[AIProvider.Groq];
    }

    /**
     * Generates a response from Groq's API using the specified API model name.
     * @param prompt The input prompt.
     * @param modelApiName The API name of the model to use.
     * @returns An AIResponse containing the API's response or an error message.
     */
    public async generateResponse(prompt: string, modelApiName: string): Promise<AIResponse> {
        try {
            const apiModel = this.getApiModelName(modelApiName);
            if (!apiModel) {
                throw new Error(`Model ${modelApiName} is not supported`);
            }

            if (!this.apiKey) {
                throw new Error('Groq API key is not set');
            }

            const settings = this.settingsService.getSettings();
            const temperature = (settings.advanced.temperature >= 0 && settings.advanced.temperature <= 1) ? settings.advanced.temperature : 0.7;
            const maxTokens = (settings.advanced.maxTokens > 0) ? settings.advanced.maxTokens : 1000;

            const response: RequestUrlResponse = await requestUrl({
                url: 'https://api.groq.com/openai/v1/chat/completions',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: apiModel,
                    messages: [
                        { role: 'system', content: 'You are a helpful assistant that responds in JSON format.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: temperature,
                    max_tokens: maxTokens,
                    response_format: { type: 'json_object' }
                })
            });

            if (response.status !== 200) {
                throw new Error(`API request failed with status ${response.status}`);
            }

            const content = response.json.choices[0].message.content;
            console.log("Parsed JSON Response:", content);
            return { success: true, data: content };
        } catch (error) {
            console.error('Error in Groq API call:', error);
            new Notice(`Groq API Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
        }
    }

    /**
     * Validates the Groq API key by making a test request.
     * @returns A boolean indicating whether the API key is valid.
     */
    public async validateApiKey(): Promise<boolean> {
        try {
            if (!this.apiKey) {
                throw new Error('Groq API key is not set');
            }

            const response: RequestUrlResponse = await requestUrl({
                url: 'https://api.groq.com/openai/v1/models',
                method: 'GET',
                headers: { 'Authorization': `Bearer ${this.apiKey}` }
            });

            if (response.status === 200) {
                new Notice('Groq API key validated successfully');
                return true;
            } else {
                throw new Error(`API request failed with status ${response.status}`);
            }
        } catch (error) {
            console.error('Error validating Groq API key:', error);
            new Notice(`Failed to validate Groq API key: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
            return false;
        }
    }

    /**
     * Retrieves the list of available model API names.
     * @returns An array of model API names.
     */
    public getAvailableModels(): string[] {
        return this.models.map(model => model.apiName);
    }

    /**
     * Gets the provider type.
     * @returns The AIProvider enum value for Groq.
     */
    public getProviderType(): AIProvider {
        return AIProvider.Groq;
    }

    /**
     * Sets the API key for Groq.
     * @param apiKey The Groq API key.
     */
    public setApiKey(apiKey: string): void {
        this.apiKey = apiKey;
    }

    /**
     * Retrieves the current API key.
     * @returns The Groq API key.
     */
    public getApiKey(): string {
        return this.apiKey;
    }

    /**
     * Configures additional settings for the adapter.
     * @param config The configuration object.
     */
    public configure(config: any): void {
        // Implement any additional configuration logic here
    }

    /**
     * Checks if the adapter is ready to make API calls.
     * @returns True if the API key is set, false otherwise.
     */
    public isReady(): boolean {
        return !!this.apiKey;
    }

    /**
     * Validates and retrieves the API model name.
     * @param modelApiName The API model name to validate.
     * @returns The API model name if valid, otherwise undefined.
     */
    public getApiModelName(modelApiName: string): string | undefined {
        const model = this.models.find(m => m.apiName === modelApiName);
        return model?.apiName;
    }
}
