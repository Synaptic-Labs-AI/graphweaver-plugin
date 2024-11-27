// src/adapters/OpenRouterAdapter.ts

import { requestUrl, RequestUrlResponse } from 'obsidian';
import { AIProvider, AIModelMap } from '../models/AIModels';
import { SettingsService } from '../services/SettingsService';
import { JsonValidationService } from '../services/JsonValidationService';
import { AIAdapter } from './AIAdapter';

/**
 * OpenRouter AI service adapter implementation
 * Handles communication with OpenRouter's API for various AI models
 */
export class OpenRouterAdapter extends AIAdapter {
    constructor(
        public settingsService: SettingsService,
        public jsonValidationService: JsonValidationService
    ) {
        super(settingsService, jsonValidationService);
        const aiProviderSettings = this.settingsService.getSetting('aiProvider');
        this.apiKey = aiProviderSettings.apiKeys[AIProvider.OpenRouter] || '';
        this.models = AIModelMap[AIProvider.OpenRouter];
    }

    protected async makeApiRequest(params: {
        model: string;
        prompt: string;
        temperature: number;
        maxTokens: number;
        rawResponse?: boolean;
    }): Promise<RequestUrlResponse> {
        return await requestUrl({
            url: 'https://openrouter.ai/api/v1/chat/completions',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': window.location.href,
                'X-Title': 'Obsidian GraphWeaver Plugin'
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
            throw new Error('Invalid response format from OpenRouter API');
        }
        return response.json.choices[0].message.content;
    }

    public getProviderType(): AIProvider {
        return AIProvider.OpenRouter;
    }
}
