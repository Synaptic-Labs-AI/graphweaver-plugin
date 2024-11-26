import { Notice, requestUrl, RequestUrlResponse } from 'obsidian';
import { AIProvider, AIResponse, AIModel, AIModelMap, AIResponseOptions } from '../models/AIModels';
import { SettingsService } from '../services/SettingsService';
import { JsonValidationService } from '../services/JsonValidationService';
import { AIAdapter } from './AIAdapter';

/**
 * Groq service adapter implementation
 * Handles communication with Groq's API for various models
 */
export class GroqAdapter extends AIAdapter {
    constructor(
        protected settingsService: SettingsService,
        protected jsonValidationService: JsonValidationService
    ) {
        super(settingsService, jsonValidationService);
        const aiProviderSettings = this.settingsService.getSetting('aiProvider');
        this.apiKey = aiProviderSettings.apiKeys[AIProvider.Groq] || '';
        this.models = AIModelMap[AIProvider.Groq];
    }

    /**
     * Generate a response using the Groq API
     */
    public async generateResponse(
        prompt: string,
        modelApiName: string,
        options?: AIResponseOptions
    ): Promise<AIResponse> {
        try {
            const apiModel = this.getApiModelName(modelApiName);
            if (!apiModel) {
                throw new Error(`No valid model found for ${this.getProviderType()}`);
            }

            if (!this.apiKey) {
                throw new Error('Groq API key is not set');
            }

            const settings = this.settingsService.getSettings();
            const temperature = this.getTemperature(settings);
            const maxTokens = options?.maxTokens || this.getMaxTokens(settings);

            const response = await this.makeApiRequest({
                model: apiModel,
                prompt,
                temperature,
                maxTokens,
                rawResponse: options?.rawResponse
            });

            const content = this.extractContentFromResponse(response);

            // Return raw content if requested
            if (options?.rawResponse) {
                return { success: true, data: content };
            }

            // Otherwise validate as JSON
            const validatedContent = await this.jsonValidationService.validateAndCleanJson(content);
            return { success: true, data: validatedContent };
        } catch (error) {
            return this.handleError(error);
        }
    }

    /**
     * Make a request to the Groq API
     */
    protected async makeApiRequest(params: {
        model: string;
        prompt: string;
        temperature: number;
        maxTokens: number;
        rawResponse?: boolean;
    }): Promise<RequestUrlResponse> {
        const response = await requestUrl({
            url: 'https://api.groq.com/openai/v1/chat/completions',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: params.model,
                messages: [
                    {
                        role: 'system',
                        content: params.rawResponse
                            ? 'You are a helpful assistant.'
                            : 'You are a helpful assistant that responds in JSON format.'
                    },
                    { role: 'user', content: params.prompt }
                ],
                temperature: params.temperature,
                max_tokens: params.maxTokens,
                response_format: params.rawResponse ? undefined : { type: 'json_object' }
            })
        });

        if (response.status !== 200) {
            const errorBody = response.json;
            throw new Error(
                `API request failed with status ${response.status}: ${
                    errorBody?.error?.message || 'Unknown error'
                }`
            );
        }

        return response;
    }

    /**
     * Extract content from API response
     */
    protected extractContentFromResponse(response: RequestUrlResponse): string {
        if (!response.json?.choices?.[0]?.message?.content) {
            throw new Error('Invalid response format from Groq API');
        }
        return response.json.choices[0].message.content;
    }

    /**
     * Get temperature setting
     */
    protected getTemperature(settings: any): number {
        return (settings.advanced?.temperature >= 0 && settings.advanced?.temperature <= 1)
            ? settings.advanced.temperature
            : 0.7;
    }

    /**
     * Get max tokens setting
     */
    protected getMaxTokens(settings: any): number {
        return (settings.advanced?.maxTokens > 0) ? settings.advanced.maxTokens : 1000;
    }

    /**
     * Handle errors in API calls
     */
    protected handleError(error: unknown): AIResponse {
        console.error('Error in Groq API call:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        new Notice(`Groq API Error: ${errorMessage}`);
        return { success: false, error: errorMessage };
    }

    /**
     * Get available models
     */
    public getAvailableModels(): string[] {
        return this.models.map(model => model.apiName);
    }

    /**
     * Get provider type
     */
    public getProviderType(): AIProvider {
        return AIProvider.Groq;
    }

    /**
     * Set API key
     */
    public setApiKey(apiKey: string): void {
        this.apiKey = apiKey;
    }

    /**
     * Get API key
     */
    public getApiKey(): string {
        return this.apiKey;
    }

    /**
     * Configure the adapter
     */
    public configure(config: any): void {
        if (config?.apiKey) {
            this.setApiKey(config.apiKey);
        }
    }

    /**
     * Check if adapter is ready
     */
    public isReady(): boolean {
        return !!this.apiKey && this.models.length > 0;
    }

    /**
     * Get API model name
     */
    public getApiModelName(modelApiName: string): string {
        const model = this.models.find(m => m.apiName === modelApiName);
        if (!model) {
            console.warn(`Model ${modelApiName} not found for ${this.getProviderType()}. Using first available model.`);
            return this.models[0]?.apiName || modelApiName;
        }
        return model.apiName;
    }
}