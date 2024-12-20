import { requestUrl, RequestUrlResponse } from 'obsidian';
import { AIProvider, AIModelMap } from '../models/AIModels';
import { AIAdapter } from './AIAdapter';
import { SettingsService } from 'src/services/SettingsService';
import { JsonValidationService } from 'src/services/JsonValidationService';

export class OpenAIAdapter extends AIAdapter {
    constructor(
        public settingsService: SettingsService,
        public jsonValidationService: JsonValidationService
    ) {
        super(settingsService, jsonValidationService);
        const aiProviderSettings = this.settingsService.getSetting('aiProvider');
        this.apiKey = aiProviderSettings.apiKeys[AIProvider.OpenAI] || '';
        this.models = AIModelMap[AIProvider.OpenAI];
    }

    protected async makeApiRequest(params: {
        model: string;
        prompt: string;
        temperature: number;
        maxTokens: number;
        rawResponse?: boolean;
    }): Promise<RequestUrlResponse> {
        return await requestUrl({
            url: 'https://api.openai.com/v1/chat/completions',
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
    }

    protected extractContentFromResponse(response: RequestUrlResponse): string {
        if (!response.json?.choices?.[0]?.message?.content) {
            throw new Error('Invalid response format from OpenAI API');
        }
        return response.json.choices[0].message.content;
    }

    public getProviderType(): AIProvider {
        return AIProvider.OpenAI;
    }
}