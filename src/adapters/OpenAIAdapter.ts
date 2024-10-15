// src/adapters/OpenAIAdapter.ts

import { Notice, requestUrl, RequestUrlResponse } from 'obsidian';
import { AIProvider, AIResponse, AIAdapter, AIModel, AIModelMap } from '../models/AIModels';
import { SettingsService } from '../services/SettingsService';

export class OpenAIAdapter implements AIAdapter {
    public apiKey: string;
    public models: AIModel[];

    constructor(public settingsService: SettingsService) {
        const aiProviderSettings = this.settingsService.getSetting('aiProvider');
        this.apiKey = aiProviderSettings.apiKeys[AIProvider.OpenAI] || '';
        this.models = AIModelMap[AIProvider.OpenAI];
    }

    /**
     * Generates a response from OpenAI's API using the specified API model name.
     * @param prompt The input prompt.
     * @param modelApiName The API name of the model to use.
     * @returns An AIResponse containing the API's response or an error message.
     */
    public async generateResponse(prompt: string, modelApiName: string): Promise<AIResponse> {
        try {
            const apiModel = modelApiName; // Directly use the apiName
            if (!apiModel) {
                throw new Error(`Model ${modelApiName} is not supported`);
            }

            const settings = this.settingsService.getSettings();
            const temperature = (settings.advanced.temperature >= 0 && settings.advanced.temperature <= 1) ? settings.advanced.temperature : 0.7;
            const maxTokens = (settings.advanced.maxTokens > 0) ? settings.advanced.maxTokens : 1000;

            const response: RequestUrlResponse = await requestUrl({
                url: 'https://api.openai.com/v1/chat/completions',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: apiModel,
                    messages: [
                        { role: 'system', content: 'You are a helpful assistant designed to output JSON.' },
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

            const jsonResponse = response.json.choices[0].message.content;
            console.log("Parsed JSON Response:", jsonResponse);
            return {
                success: true,
                data: jsonResponse,
            };
        } catch (error) {
            console.error('Error in OpenAI API call:', error);
            new Notice(`OpenAI API Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
            };
        }
    }

    /**
     * Validates the OpenAI API key by making a test request.
     * @returns A boolean indicating whether the API key is valid.
     */
    public async validateApiKey(): Promise<boolean> {
        try {
            if (!this.apiKey) {
                throw new Error('OpenAI API key is not set');
            }

            const response: RequestUrlResponse = await requestUrl({
                url: 'https://api.openai.com/v1/models',
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });

            if (response.status === 200) {
                new Notice('OpenAI API key validated successfully');
                return true;
            } else {
                throw new Error(`API request failed with status ${response.status}`);
            }
        } catch (error) {
            console.error('Error validating OpenAI API key:', error);
            new Notice(`Failed to validate OpenAI API key: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
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
     * @returns The AIProvider enum value for OpenAI.
     */
    public getProviderType(): AIProvider {
        return AIProvider.OpenAI;
    }

    /**
     * Sets the API key for OpenAI.
     * @param apiKey The OpenAI API key.
     */
    public setApiKey(apiKey: string): void {
        this.apiKey = apiKey;
    }

    /**
     * Retrieves the current API key.
     * @returns The OpenAI API key.
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
        // For example, updating endpoint URLs or other settings
    }

    /**
     * Checks if the adapter is ready to make API calls.
     * @returns True if the API key is set, false otherwise.
     */
    public isReady(): boolean {
        return !!this.apiKey;
    }

    /**
     * Retrieves the API model name based on the provided API model identifier.
     * Since we're using apiName directly, this method can return the identifier itself.
     * @param modelIdentifier The API model name.
     * @returns The API model name or undefined if not found.
     */
    public getApiModelName(modelIdentifier: string): string | undefined {
        const model = this.models.find(m => m.apiName === modelIdentifier);
        return model?.apiName;
    }
}
