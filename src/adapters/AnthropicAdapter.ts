import { Notice, requestUrl, RequestUrlResponse } from 'obsidian';
import { AIProvider, AIResponse, AIModel, AIModelMap } from '../models/AIModels';
import { SettingsService } from '../services/SettingsService';
import { JsonValidationService } from '../services/JsonValidationService';
import { AIAdapter } from './AIAdapter';

export class AnthropicAdapter extends AIAdapter {
    public apiKey: string;
    public models: AIModel[];

    constructor(
        public settingsService: SettingsService,
        public jsonValidationService: JsonValidationService
    ) {
        super(settingsService, jsonValidationService);
        const aiProviderSettings = this.settingsService.getSetting('aiProvider');
        this.apiKey = aiProviderSettings.apiKeys[AIProvider.Anthropic] || '';
        this.models = AIModelMap[AIProvider.Anthropic];
    }

    public async generateResponse(prompt: string, modelApiName: string, options?: { 
        rawResponse?: boolean;
        maxTokens?: number; 
    }): Promise<AIResponse> {
        try {
            const apiModel = this.getApiModelName(modelApiName);
            if (!apiModel) {
                throw new Error(`Invalid model: ${modelApiName} for ${this.getProviderType()}`);
            }
    
            if (!this.apiKey) {
                throw new Error('Anthropic API key is not set');
            }
    
            const settings = this.settingsService.getSettings();
            const temperature = this.getTemperature(settings);
            const maxTokens = options?.maxTokens || this.getMaxTokens(settings);
    
            const response = await this.makeApiRequest({ model: apiModel, prompt, temperature, maxTokens, rawResponse: options?.rawResponse });
            const content = this.extractContentFromResponse(response);
    
            // If rawResponse is true, skip JSON validation
            if (options?.rawResponse) {
                return { success: true, data: content };
            }
    
            const validatedContent = await this.jsonValidationService.validateAndCleanJson(content);
            return { success: true, data: validatedContent };
        } catch (error) {
            return this.handleError(error);
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

    protected async makeApiRequest(params: {
        model: string;
        prompt: string;
        temperature: number;
        maxTokens: number;
        rawResponse?: boolean;
    }): Promise<RequestUrlResponse> {
        return await requestUrl({
            url: 'https://api.anthropic.com/v1/messages',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: params.model,
                messages: [{ role: 'user', content: params.prompt }],
                max_tokens: params.maxTokens,
                temperature: params.temperature
            })
        });
    }

    protected extractContentFromResponse(response: RequestUrlResponse): string {
        if (!response.json?.content?.[0]?.text) {
            throw new Error('Invalid response format from Anthropic API');
        }
        return response.json.content[0].text;
    }

    public handleError(error: unknown): AIResponse {
        console.error('Error in Anthropic API call:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        new Notice(`Anthropic API Error: ${errorMessage}`);
        return { success: false, error: errorMessage };
    }

    public getAvailableModels(): string[] {
        return this.models.map(model => model.apiName);
    }

    public getProviderType(): AIProvider {
        return AIProvider.Anthropic;
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
            throw new Error(`Model ${modelApiName} not found for ${this.getProviderType()}`);
        }
        return model.apiName;
    }
}