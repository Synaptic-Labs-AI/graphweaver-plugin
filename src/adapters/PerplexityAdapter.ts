import { requestUrl, RequestUrlResponse } from 'obsidian';
import { AIProvider, AIModelMap } from '../models/AIModels';
import { AIAdapter } from './AIAdapter';
import { SettingsService } from 'src/services/SettingsService';
import { JsonValidationService } from 'src/services/JsonValidationService';

export class PerplexityAdapter extends AIAdapter {
    constructor(
        public settingsService: SettingsService,
        public jsonValidationService: JsonValidationService
    ) {
        super(settingsService, jsonValidationService);
        const aiProviderSettings = this.settingsService.getSetting('aiProvider');
        this.apiKey = aiProviderSettings.apiKeys[AIProvider.Perplexity] || '';
        this.models = AIModelMap[AIProvider.Perplexity];
    }

    protected async makeApiRequest(params: {
        model: string;
        prompt: string;
        temperature: number;
        maxTokens: number;
        rawResponse?: boolean;
    }): Promise<RequestUrlResponse> {
        try {
            const response = await requestUrl({
                url: 'https://api.perplexity.ai/chat/completions',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    model: params.model,
                    messages: [
                        {
                            role: 'system',
                            content: 'Be precise and concise.'
                        },
                        {
                            role: 'user',
                            content: params.prompt
                        }
                    ],
                    temperature: params.temperature,
                    max_tokens: params.maxTokens
                })
            });

            if (response.status !== 200) {
                console.error(`Perplexity API Error: Status ${response.status}`);
                console.error('Response Body:', response.text); // Log the response body for more details
            }

            return response;
        } catch (error) {
            console.error('PerplexityAdapter makeApiRequest encountered an error:', error);
            throw error;
        }
    }

    protected extractContentFromResponse(response: RequestUrlResponse): string {
        if (!response.json?.choices?.[0]?.message?.content) {
            throw new Error('Invalid response format from Perplexity API');
        }
        return response.json.choices[0].message.content;
    }

    public getProviderType(): AIProvider {
        return AIProvider.Perplexity;
    }
}