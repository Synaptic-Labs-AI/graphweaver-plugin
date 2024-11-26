import { Notice, requestUrl, RequestUrlResponse } from 'obsidian';
import { SettingsService } from '../services/SettingsService';
import { JsonValidationService } from '../services/JsonValidationService';
import { AIProvider, AIResponse, AIResponseOptions } from '../models/AIModels';
import { AIAdapter } from './AIAdapter';

export class LMStudioAdapter extends AIAdapter {
    public model: string;
    public port: string;

    constructor(
        public settingsService: SettingsService,
        public jsonValidationService: JsonValidationService
    ) {
        super(settingsService, jsonValidationService);
        this.updateSettings();
    }

    protected async makeApiRequest(params: {
        model: string;
        prompt: string;
        temperature: number;
        maxTokens: number;
        rawResponse?: boolean;
    }): Promise<RequestUrlResponse> {
        return await requestUrl({
            url: `http://localhost:${this.port}/v1/chat/completions`,
            method: 'POST',
            headers: {
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
                response_format: params.rawResponse ? undefined : { type: 'json_schema' },
                stream: false
            })
        });
    }

    protected extractContentFromResponse(response: RequestUrlResponse): string {
        if (!response.json?.choices?.[0]?.message?.content) {
            throw new Error('Invalid response format from LM Studio API');
        }
        return response.json.choices[0].message.content;
    }

    public async generateResponse(
        prompt: string, 
        model: string = 'default',
        options?: AIResponseOptions
    ): Promise<AIResponse> {
        try {
            if (!this.isReady()) {
                throw new Error('LM Studio settings are not properly configured');
            }

            const response = await this.makeApiRequest({
                model: this.model,
                prompt,
                temperature: 0.7,
                maxTokens: options?.maxTokens || 1000,
                rawResponse: options?.rawResponse
            });

            if (response.status !== 200) {
                throw new Error(`API request failed with status ${response.status}`);
            }

            const content = this.extractContentFromResponse(response);

            // Handle raw response if requested
            if (options?.rawResponse) {
                return {
                    success: true,
                    data: content
                };
            }

            // Otherwise validate JSON
            const validatedContent = await this.jsonValidationService.validateAndCleanJson(content);
            return {
                success: true,
                data: validatedContent
            };
        } catch (error) {
            console.error('Error in LM Studio API call:', error);
            new Notice(`LM Studio API Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }

    public createJsonSchema() {
        return {
            name: "assistant_response",
            strict: "true",
            schema: {
                type: "object",
                properties: {
                    response: {
                        type: "string"
                    }
                },
                required: ["response"]
            }
        };
    }

    public getAvailableModels(): string[] {
        return [this.model];
    }

    public getProviderType(): AIProvider {
        return AIProvider.LMStudio;
    }

    public setApiKey(apiKey: string): void {
        // LM Studio doesn't use an API key, so this method is a no-op
    }

    public getApiKey(): string {
        return '';
    }

    public configure(config: any): void {
        if (config.model) {
            this.model = config.model;
        }
        if (config.port) {
            this.port = config.port.toString();
        }
        this.settingsService.updateNestedSetting('localLMStudio', 'modelName', this.model);
        this.settingsService.updateNestedSetting('localLMStudio', 'port', parseInt(this.port, 10));
    }

    public isReady(): boolean {
        return !!this.model && !!this.port;
    }

    public getApiModelName(modelName: string): string {
        return modelName || 'default';
    }

    public updateSettings(): void {
        const localLMStudioSettings = this.settingsService.getSetting('localLMStudio');
        this.model = localLMStudioSettings.modelName;
        this.port = localLMStudioSettings.port.toString();
    }
}