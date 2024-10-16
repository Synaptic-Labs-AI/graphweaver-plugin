import { Notice, requestUrl } from 'obsidian';
import { SettingsService } from '../services/SettingsService';
import { JsonValidationService } from '../services/JsonValidationService';
import { AIProvider, AIResponse, AIAdapter } from '../models/AIModels';

export class LMStudioAdapter implements AIAdapter {
    public model: string;
    public port: string;

    constructor(
        public settingsService: SettingsService,
        public jsonValidationService: JsonValidationService
    ) {
        this.updateSettings();
    }

    public async generateResponse(prompt: string, model: string = 'default'): Promise<AIResponse> {
        try {
            if (!this.isReady()) {
                throw new Error('LM Studio settings are not properly configured');
            }

            const jsonSchema = this.createJsonSchema();
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
                            content: "You are a helpful assistant that responds in JSON format."
                        },
                        {
                            role: "user",
                            content: prompt
                        }
                    ],
                    response_format: {
                        type: "json_schema",
                        json_schema: jsonSchema
                    },
                    temperature: 0.7,
                    max_tokens: 1000,
                    stream: false
                })
            });

            if (response.status !== 200) {
                throw new Error(`API request failed with status ${response.status}`);
            }

            const content = response.json.choices[0].message.content;
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

    private createJsonSchema() {
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
            return response.success && response.data && typeof response.data === 'object' && 
                   'response' in response.data && typeof response.data.response === 'string' && 
                   response.data.response.toLowerCase().includes('ok');
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
        const localLMStudioSettings = this.settingsService.getSetting('localLMStudio');
        this.model = localLMStudioSettings.modelName;
        this.port = localLMStudioSettings.port.toString();
    }
}