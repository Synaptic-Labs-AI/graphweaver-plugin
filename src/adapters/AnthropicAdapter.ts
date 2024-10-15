// src/adapters/AnthropicAdapter.ts

import { Notice, requestUrl, RequestUrlResponse } from 'obsidian';
import { AIProvider, AIResponse, AIAdapter, AIModel, AIModelMap } from '../models/AIModels';
import { SettingsService } from '../services/SettingsService';

export class AnthropicAdapter implements AIAdapter {
    public apiKey: string;
    public models: AIModel[];

    constructor(public settingsService: SettingsService) {
        const aiProviderSettings = this.settingsService.getSetting('aiProvider');
        this.apiKey = aiProviderSettings.apiKeys[AIProvider.Anthropic] || '';
        this.models = AIModelMap[AIProvider.Anthropic];
    }

    /**
     * Generates a response from Anthropic's API using the specified API model name.
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
                throw new Error('Anthropic API key is not set');
            }

            const settings = this.settingsService.getSettings();
            const temperature = (settings.advanced.temperature >= 0 && settings.advanced.temperature <= 1)
                ? settings.advanced.temperature
                : 0.7;
            const maxTokens = (settings.advanced.maxTokens > 0) ? settings.advanced.maxTokens : 1000;

            // Prepare the prompt as per Anthropic's API requirements
            const anthropicPrompt = `\n\nHuman: ${prompt}\n\nAssistant:`;

            const response: RequestUrlResponse = await requestUrl({
                url: 'https://api.anthropic.com/v1/complete',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey
                },
                body: JSON.stringify({
                    model: apiModel,
                    prompt: anthropicPrompt,
                    max_tokens_to_sample: maxTokens,
                    temperature: temperature,
                    stop_sequences: ['\n\nHuman:'],
                    stream: false,
                    metadata: {
                        user_id: 'obsidian-plugin'
                    }
                })
            });

            if (response.status !== 200) {
                throw new Error(`API request failed with status ${response.status}: ${response.text}`);
            }

            const content = response.json.completion.trim();
            console.log("Anthropic Response:", content);

            return {
                success: true,
                data: content,
            };
        } catch (error) {
            console.error('Error in Anthropic API call:', error);
            new Notice(`Anthropic API Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
            };
        }
    }

    /**
     * Validates the Anthropic API key by making a test request.
     * @returns A boolean indicating whether the API key is valid.
     */
    public async validateApiKey(): Promise<boolean> {
        try {
            if (!this.apiKey) {
                throw new Error('Anthropic API key is not set');
            }

            // Attempt to send a minimal request to validate the API key
            const response: RequestUrlResponse = await requestUrl({
                url: 'https://api.anthropic.com/v1/complete',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey
                },
                body: JSON.stringify({
                    model: this.models[0].apiName, // Use the first available model
                    prompt: '\n\nHuman: Hello\n\nAssistant:',
                    max_tokens_to_sample: 1,
                    temperature: 0.0,
                    stop_sequences: ['\n\nHuman:'],
                    stream: false
                })
            });

            if (response.status === 200) {
                new Notice('Anthropic API key validated successfully');
                return true;
            } else {
                throw new Error(`API request failed with status ${response.status}: ${response.text}`);
            }
        } catch (error) {
            console.error('Error validating Anthropic API key:', error);
            new Notice(`Failed to validate Anthropic API key: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
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
     * @returns The AIProvider enum value for Anthropic.
     */
    public getProviderType(): AIProvider {
        return AIProvider.Anthropic;
    }

    /**
     * Sets the API key for Anthropic.
     * @param apiKey The Anthropic API key.
     */
    public setApiKey(apiKey: string): void {
        this.apiKey = apiKey;
    }

    /**
     * Retrieves the current API key.
     * @returns The Anthropic API key.
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
