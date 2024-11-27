import { Notice, requestUrl, RequestUrlResponse } from 'obsidian';
import { AIProvider, AIResponse, AIModelMap, AIResponseOptions } from '../models/AIModels';
import { SettingsService } from '../services/SettingsService';
import { JsonValidationService } from '../services/JsonValidationService';
import { AIAdapter } from './AIAdapter';

/**
 * Gemini service adapter implementation
 * Handles communication with Google's Gemini API
 * Note: Gemini has a different API structure from other providers
 */
export class GeminiAdapter extends AIAdapter {
    constructor(
        protected settingsService: SettingsService,
        protected jsonValidationService: JsonValidationService
    ) {
        super(settingsService, jsonValidationService);
        const aiProviderSettings = this.settingsService.getSetting('aiProvider');
        this.apiKey = aiProviderSettings.apiKeys[AIProvider.Google] || '';
        this.models = AIModelMap[AIProvider.Google];
    }

    /**
     * Generate a response using the Gemini API
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
                throw new Error('Google API key is not set');
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

            try {
                // For JSON responses, we need to ensure the content is valid JSON
                const validatedContent = await this.jsonValidationService.validateAndCleanJson(content);
                return { success: true, data: validatedContent };
            } catch (jsonError) {
                // If JSON validation fails and we're not in raw mode, format as JSON
                return {
                    success: true,
                    data: { response: content }
                };
            }
        } catch (error) {
            return this.handleError(error);
        }
    }

    /**
     * Make a request to the Gemini API
     */
    protected async makeApiRequest(params: {
        model: string;
        prompt: string;
        temperature: number;
        maxTokens: number;
        rawResponse?: boolean;
    }): Promise<RequestUrlResponse> {
        const systemPrompt = params.rawResponse
            ? 'You are a helpful assistant.'
            : "You are a helpful assistant that responds in JSON format. Your response should be valid JSON with a 'response' field containing your answer.";

        const requestBody = {
            contents: [
                {
                    parts: [
                        { text: systemPrompt },
                        { text: params.prompt }
                    ]
                }
            ],
            generationConfig: {
                temperature: params.temperature,
                maxOutputTokens: params.maxTokens,
                topK: 40,
                topP: 0.95
            }
        };

        return await requestUrl({
            url: `https://generativelanguage.googleapis.com/v1/models/${params.model}:generateContent`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': this.apiKey
            },
            body: JSON.stringify(requestBody)
        });
    }

    /**
     * Extract content from Gemini API response
     */
    protected extractContentFromResponse(response: RequestUrlResponse): string {
        if (!response.json?.candidates?.[0]?.content?.parts?.[0]?.text) {
            throw new Error('Invalid response format from Gemini API');
        }
        return response.json.candidates[0].content.parts[0].text;
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
        console.error('Error in Gemini API call:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        new Notice(`Gemini API Error: ${errorMessage}`);
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
        return AIProvider.Google;
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