import { Notice, requestUrl, RequestUrlResponse } from 'obsidian';
import { AIProvider, AIResponse, AIAdapter, AIModel, AIModelMap } from '../models/AIModels';
import { SettingsService } from '../services/SettingsService';
import { JsonValidationService } from '../services/JsonValidationService';

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

    public async generateResponse(prompt: string, modelApiName: string): Promise<AIResponse> {
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
            const maxTokens = this.getMaxTokens(settings);

            const response = await this.makeApiRequest(apiModel, prompt, temperature, maxTokens);
            const content = this.extractContentFromResponse(response);
            const validatedContent = await this.jsonValidationService.validateAndCleanJson(content);
            return { success: true, data: validatedContent };
        } catch (error) {
            return this.handleError(error);
        }
    }

    public async testConnection(prompt: string, modelApiName: string): Promise<boolean> {
        try {
            if (!this.apiKey) {
                throw new Error('OpenRouter API key is not set');
            }

            const apiModel = this.getApiModelName(modelApiName);
            const response = await this.makeApiRequest(apiModel, prompt, 0.7, 50);
            const content = this.extractContentFromResponse(response);
            return content.toLowerCase().includes('ok');
        } catch (error) {
            console.error('Error in OpenRouter test connection:', error);
            return false;
        }
    }

    public getTemperature(settings: any): number {
        return (settings.advanced.temperature >= 0 && settings.advanced.temperature <= 1) 
            ? settings.advanced.temperature 
            : 0.7;
    }

    public getMaxTokens(settings: any): number {
        return (settings.advanced.maxTokens > 0) ? settings.advanced.maxTokens : 1000;
    }

    public async makeApiRequest(apiModel: string, prompt: string, temperature: number, maxTokens: number): Promise<RequestUrlResponse> {
        const response: RequestUrlResponse = await requestUrl({
            url: `https://openrouter.ai/api/v1/chat/completions`,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: apiModel,
                messages: [{ role: 'user', content: prompt }],
                temperature: temperature,
                max_tokens: maxTokens
            })
        });

        if (response.status !== 200) {
            throw new Error(`API request failed with status ${response.status}`);
        }

        return response;
    }

    public extractContentFromResponse(response: RequestUrlResponse): string {
        return response.json.choices[0].message.content;
    }

    public handleError(error: unknown): AIResponse {
        console.error('Error in OpenRouter API call:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        new Notice(`OpenRouter API Error: ${errorMessage}`);
        return { success: false, error: errorMessage };
    }

    public async validateApiKey(): Promise<boolean> {
        try {
            if (!this.apiKey) {
                throw new Error('OpenRouter API key is not set');
            }

            const response = await this.testConnection("Return the word 'OK'.", this.models[0].apiName);
            if (response) {
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

    public getAvailableModels(): string[] {
        return this.models.map(model => model.apiName);
    }

    public getProviderType(): AIProvider {
        return AIProvider.OpenRouter;
    }

    public setApiKey(apiKey: string): void {
        this.apiKey = apiKey;
    }

    public getApiKey(): string {
        return this.apiKey;
    }

    public configure(config: any): void {
        // Implement any additional configuration logic here
    }

    public isReady(): boolean {
        return !!this.apiKey;
    }

    public getApiModelName(modelApiName: string): string {
        const model = this.models.find(m => m.apiName === modelApiName);
        if (!model) {
            console.warn(`Model ${modelApiName} not found for ${this.getProviderType()}. Using first available model.`);
            return this.models[0]?.apiName || modelApiName;
        }
        return model.apiName;
    }
}