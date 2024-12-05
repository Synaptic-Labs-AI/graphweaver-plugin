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
        try {
            const body = {
                model: params.model,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful assistant that responds in valid JSON format.'
                    },
                    { 
                        role: 'user', 
                        content: params.prompt 
                    }
                ],
                temperature: params.temperature,
                max_tokens: params.maxTokens,
                stream: false
            };

            console.debug('OpenRouter API Request:', body);

            const response = await requestUrl({
                url: 'https://openrouter.ai/api/v1/chat/completions',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': window.location.href,
                    'X-Title': 'Obsidian GraphWeaver Plugin'
                },
                body: JSON.stringify(body)
            });

            return response;
        } catch (error) {
            console.error('OpenRouter API error:', error);
            const errorMessage = error.message || 'Unknown error';
            if (errorMessage.includes('context length')) {
                throw new Error('Input is too long for the selected model. Please reduce the amount of files or context provided.');
            }
            throw new Error(`API request failed: ${errorMessage}`);
        }
    }

    protected extractContentFromResponse(response: RequestUrlResponse): string {
        try {
            if (!response?.json) {
                console.error('No JSON in response:', response);
                throw new Error('No JSON content in response');
            }

            if (!response.json.choices?.[0]?.message?.content) {
                console.error('Unexpected response structure:', response.json);
                throw new Error('Invalid response structure');
            }

            const content = response.json.choices[0].message.content;
            console.debug('Extracted content:', content);
            return content;

        } catch (error) {
            console.error('Error extracting content from response:', error);
            console.error('Raw response:', response);
            throw new Error(`Invalid response format from OpenRouter API: ${error.message}`);
        }
    }

    public getProviderType(): AIProvider {
        return AIProvider.OpenRouter;
    }
}
