import { Notice, requestUrl } from 'obsidian';
import { SettingsService } from '../services/SettingsService';
import { JsonValidationService } from '../services/JsonValidationService';
import { AIProvider, AIResponse, AIAdapter, AIResponseOptions } from '../models/AIModels';

export class LMStudioAdapter implements AIAdapter {
    public model: string;
    public port: string;

    constructor(
        public settingsService: SettingsService,
        public jsonValidationService: JsonValidationService
    ) {
        this.updateSettings();
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

            const response = await requestUrl({
                url: `http://localhost:${this.port}/v1/chat/completions`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        {
                            role: "system",
                            content: options?.rawResponse 
                                ? "You are a helpful assistant." 
                                : "You are a helpful assistant that responds in JSON format."
                        },
                        {
                            role: "user",
                            content: prompt
                        }
                    ],
                    response_format: options?.rawResponse ? undefined : {
                        type: "json_schema",
                        json_schema: this.createJsonSchema()
                    },
                    temperature: 0.7,
                    max_tokens: options?.maxTokens || 1000,
                    stream: false
                })
            });

            if (response.status !== 200) {
                throw new Error(`API request failed with status ${response.status}`);
            }

            const content = response.json.choices[0].message.content;

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

    public async testConnection(prompt: string, model: string = 'default'): Promise<boolean> {
        try {
            if (!this.isReady()) {
                return false;
            }

            const response = await this.generateResponse("Return the word 'OK'.", model);
            
            if (!response.success || !response.data) {
                return false;
            }

            // Type guard to check if data is an object with response property
            if (typeof response.data === 'object' && response.data !== null && 
                'response' in response.data && 
                typeof (response.data as { response: unknown }).response === 'string') {
                return (response.data as { response: string }).response.toLowerCase().includes('ok');
            }

            return false;
        } catch (error) {
            console.error('Error in LM Studio test connection:', error);
            return false;
        }
    }

    public async validateApiKey(): Promise<boolean> {
        return this.isReady();
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

    public getApiModelName(modelName: string): string | undefined {
        return modelName;
    }

    public updateSettings(): void {
        const localLMStudioSettings = this.settingsService.getSettingSection('localLMStudio');
        this.model = localLMStudioSettings.modelName;
        this.port = localLMStudioSettings.port.toString();
    }
}