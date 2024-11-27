import { Notice, RequestUrlResponse } from 'obsidian';
import { AIProvider, AIResponse, AIModel, AIModelMap, AIResponseOptions } from '../models/AIModels';
import { SettingsService } from '../services/SettingsService';
import { JsonValidationService } from '../services/JsonValidationService';
import { MistralAdapter } from './MistralAdapter'; // Add import for MistralAdapter


export abstract class AIAdapter {
    protected apiKey: string = '';
    protected models: AIModel[] = [];

    constructor(
        protected settingsService: SettingsService,
        protected jsonValidationService: JsonValidationService
    ) {
        const aiProviderSettings = this.settingsService.getSetting('aiProvider');
        this.apiKey = aiProviderSettings.apiKeys[this.getProviderType()] || '';
        this.models = AIModelMap[this.getProviderType()];
    }

    // Methods that must be implemented by specific adapters
    protected abstract makeApiRequest(params: {
        model: string;
        prompt: string;
        temperature: number;
        maxTokens: number;
        rawResponse?: boolean;
    }): Promise<RequestUrlResponse>;

    protected abstract extractContentFromResponse(response: RequestUrlResponse): string;

    abstract getProviderType(): AIProvider;

    // Shared implementation methods
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

            if (!this.apiKey && this.getProviderType() !== AIProvider.LMStudio) {
                throw new Error(`${this.getProviderType()} API key is not set`);
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

            if (options?.rawResponse) {
                return { success: true, data: content };
            }

            const validatedContent = await this.jsonValidationService.validateAndCleanJson(content);
            return { success: true, data: validatedContent };
        } catch (error) {
            return this.handleError(error);
        }
    }

    public async testConnection(prompt: string, modelApiName: string): Promise<boolean> {
        try {
            if (!this.isReady()) {
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
            console.error(`Error in ${this.getProviderType()} test connection:`, error);
            return false;
        }
    }

    protected getTemperature(settings: any): number {
        return (settings.advanced?.temperature >= 0 && settings.advanced?.temperature <= 1)
            ? settings.advanced.temperature
            : 0.7;
    }

    protected getMaxTokens(settings: any): number {
        return (settings.advanced?.maxTokens > 0) ? settings.advanced.maxTokens : 1000;
    }

    protected handleError(error: unknown): AIResponse {
        console.error(`Error in ${this.getProviderType()} API call:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        new Notice(`${this.getProviderType()} API Error: ${errorMessage}`);
        return { success: false, error: errorMessage };
    }

    public async validateApiKey(): Promise<boolean> {
        try {
            if (!this.isReady()) {
                throw new Error(`${this.getProviderType()} is not properly configured`);
            }

            const isValid = await this.testConnection(
                "Return the word 'OK'.",
                this.models[0].apiName
            );

            if (isValid) {
                new Notice(`${this.getProviderType()} API key validated successfully`);
                return true;
            } else {
                throw new Error('Failed to validate API key');
            }
        } catch (error) {
            console.error(`Error validating ${this.getProviderType()} API key:`, error);
            new Notice(`Failed to validate ${this.getProviderType()} API key: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
            return false;
        }
    }

    public getAvailableModels(): string[] {
        return this.models.map(model => model.apiName);
    }

    public setApiKey(apiKey: string): void {
        this.apiKey = apiKey;
    }

    public getApiKey(): string {
        return this.apiKey;
    }

    public configure(config: any): void {
        if (config?.apiKey) {
            this.setApiKey(config.apiKey);
        }
    }

    public isReady(): boolean {
        return (!!this.apiKey || this.getProviderType() === AIProvider.LMStudio) && this.models.length > 0;
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
