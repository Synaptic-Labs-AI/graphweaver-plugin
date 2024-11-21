import { Notice, requestUrl, RequestUrlResponse } from 'obsidian';
import { AIProvider, AIResponse, AIAdapter, AIModel, AIResponseOptions } from '@type/ai.types';
import { AIModelMap } from '@type/aiModels';
import { SettingsService } from '@services/SettingsService';
import { JsonValidationService } from '@services/JsonValidationService';

/**
 * Gemini service adapter implementation
 * Handles communication with Google's Gemini API
 * Note: Gemini has a different API structure from other providers
 */
export class GeminiAdapter implements AIAdapter {
    public apiKey: string;
    public models: AIModel[];

    constructor(
        public settingsService: SettingsService,
        public jsonValidationService: JsonValidationService
    ) {
        const aiProviderSettings = this.settingsService.getSettingSection('aiProvider');
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
     * Test connection to Gemini API
     */
    public async testConnection(prompt: string, modelApiName: string): Promise<boolean> {
        try {
            if (!this.apiKey) {
                return false;
            }

            const response = await this.generateResponse(
                prompt || "Return the word 'OK'.",
                modelApiName,
                { rawResponse: true }
            );

            if (!response.success || typeof response.data !== 'string') {
                return false;
            }

            return response.data.toLowerCase().includes('ok');
        } catch (error) {
            console.error('Error in Gemini test connection:', error);
            return false;
        }
    }

    /**
     * Make a request to the Gemini API
     */
    public async makeApiRequest(params: {
        model: string;
        prompt: string;
        temperature: number;
        maxTokens: number;
        rawResponse?: boolean;
    }): Promise<RequestUrlResponse> {
        // Build the system prompt based on response type
        const systemPrompt = params.rawResponse
            ? "You are a helpful assistant."
            : "You are a helpful assistant that responds in JSON format. Your response should be valid JSON with a 'response' field containing your answer.";

        // Gemini uses a different request format
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

        const response = await requestUrl({
            url: `https://generativelanguage.googleapis.com/v1/models/${params.model}:generateContent`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': this.apiKey
            },
            body: JSON.stringify(requestBody)
        });

        if (response.status !== 200) {
            const errorBody = response.json;
            throw new Error(
                `API request failed with status ${response.status}: ${
                    errorBody?.error?.message || response.text
                }`
            );
        }

        return response;
    }

    /**
     * Extract content from Gemini API response
     */
    public extractContentFromResponse(response: RequestUrlResponse): string {
        if (!response.json?.candidates?.[0]?.content?.parts?.[0]?.text) {
            throw new Error('Invalid response format from Gemini API');
        }
        const content = response.json.candidates[0].content;
        return content.parts[0].text;
    }

    /**
     * Get temperature setting
     */
    public getTemperature(settings: any): number {
        return (settings.advanced?.temperature >= 0 && settings.advanced?.temperature <= 1)
            ? settings.advanced.temperature
            : 0.7;
    }

    /**
     * Get max tokens setting
     */
    public getMaxTokens(settings: any): number {
        return (settings.advanced?.maxTokens > 0) ? settings.advanced.maxTokens : 1000;
    }

    /**
     * Handle errors in API calls
     */
    public handleError(error: unknown): AIResponse {
        console.error('Error in Gemini API call:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        new Notice(`Gemini API Error: ${errorMessage}`);
        return { success: false, error: errorMessage };
    }

    /**
     * Validate API key
     */
    public async validateApiKey(): Promise<boolean> {
        try {
            if (!this.apiKey) {
                throw new Error('Google API key is not set');
            }

            if (this.models.length === 0) {
                throw new Error('No models available for Gemini');
            }

            const isValid = await this.testConnection(
                "Return the word 'OK'.",
                this.models[0].apiName
            );

            if (isValid) {
                new Notice('Gemini API key validated successfully');
                return true;
            } else {
                throw new Error('Failed to validate API key');
            }
        } catch (error) {
            console.error('Error validating Gemini API key:', error);
            new Notice(`Failed to validate Gemini API key: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
            return false;
        }
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