import { Notice, requestUrl, RequestUrlResponse } from 'obsidian';
import { AIProvider, AIResponse, AIAdapter, AIModel, AIModelMap, AIResponseOptions } from '../models/AIModels';
import { SettingsService } from '../services/SettingsService';
import { JsonValidationService } from '../services/JsonValidationService';

/**
 * OpenRouter AI service adapter implementation
 * Handles communication with OpenRouter's API for various AI models
 */
export class OpenRouterAdapter implements AIAdapter {
    public apiKey: string;
    public models: AIModel[];

    constructor(
        public settingsService: SettingsService,
        public jsonValidationService: JsonValidationService
    ) {
        const aiProviderSettings = this.settingsService.getSetting('aiProvider');
        this.apiKey = aiProviderSettings.apiKeys[AIProvider.OpenRouter] || '';
        this.models = AIModelMap[AIProvider.OpenRouter];
    }

    /**
     * Generate a response using the OpenRouter API
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
                throw new Error('OpenRouter API key is not set');
            }

            const settings = this.settingsService.getSettings();
            const temperature = this.getTemperature(settings);
            const maxTokens = options?.maxTokens || this.getMaxTokens(settings);

            const response = await this.makeApiRequest(
                apiModel, 
                prompt, 
                temperature, 
                maxTokens,
                options?.rawResponse
            );

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
     * Test connection to OpenRouter API
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
            console.error('Error in OpenRouter test connection:', error);
            return false;
        }
    }

    /**
     * Make a request to the OpenRouter API
     */
    private async makeApiRequest(
        apiModel: string, 
        prompt: string, 
        temperature: number, 
        maxTokens: number,
        rawResponse?: boolean
    ): Promise<RequestUrlResponse> {
        const response = await requestUrl({
            url: `https://openrouter.ai/api/v1/chat/completions`,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://github.com/yourusername/obsidian-plugin', // Replace with your plugin's URL
                'X-Title': 'Obsidian Plugin' // Replace with your plugin's name
            },
            body: JSON.stringify({
                model: apiModel,
                messages: [
                    {
                        role: 'system',
                        content: rawResponse 
                            ? 'You are a helpful assistant.' 
                            : 'You are a helpful assistant that responds in JSON format.'
                    },
                    { role: 'user', content: prompt }
                ],
                temperature: temperature,
                max_tokens: maxTokens,
                response_format: rawResponse ? undefined : { type: 'json_object' }
            })
        });

        if (response.status !== 200) {
            throw new Error(`API request failed with status ${response.status}`);
        }

        return response;
    }

    /**
     * Extract content from API response
     */
    private extractContentFromResponse(response: RequestUrlResponse): string {
        if (!response.json?.choices?.[0]?.message?.content) {
            throw new Error('Invalid response format from OpenRouter API');
        }
        return response.json.choices[0].message.content;
    }

    /**
     * Get temperature setting
     */
    private getTemperature(settings: any): number {
        return (settings.advanced?.temperature >= 0 && settings.advanced?.temperature <= 1) 
            ? settings.advanced.temperature 
            : 0.7;
    }

    /**
     * Get max tokens setting
     */
    private getMaxTokens(settings: any): number {
        return (settings.advanced?.maxTokens > 0) ? settings.advanced.maxTokens : 1000;
    }

    /**
     * Handle errors in API calls
     */
    private handleError(error: unknown): AIResponse {
        console.error('Error in OpenRouter API call:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        new Notice(`OpenRouter API Error: ${errorMessage}`);
        return { success: false, error: errorMessage };
    }

    /**
     * Validate API key
     */
    public async validateApiKey(): Promise<boolean> {
        try {
            if (!this.apiKey) {
                throw new Error('OpenRouter API key is not set');
            }

            if (this.models.length === 0) {
                throw new Error('No models available for OpenRouter');
            }

            const isValid = await this.testConnection(
                "Return the word 'OK'.",
                this.models[0].apiName
            );

            if (isValid) {
                new Notice('OpenRouter API key validated successfully');
                return true;
            } else {
                throw new Error('Failed to validate API key');
            }
        } catch (error) {
            console.error('Error validating OpenRouter API key:', error);
            new Notice(`Failed to validate OpenRouter API key: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
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
        return AIProvider.OpenRouter;
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
        // Implement any additional configuration logic here
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