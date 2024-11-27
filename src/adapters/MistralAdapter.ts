import { RequestUrlResponse, requestUrl } from 'obsidian';
import { AIProvider } from '../models/AIModels';
import { AIAdapter } from './AIAdapter';

export class MistralAdapter extends AIAdapter {
    private apiEndpoint = 'https://api.mistral.ai/v1/chat/completions';

    getProviderType(): AIProvider {
        return AIProvider.Mistral;
    }

    protected async makeApiRequest(params: {
        model: string;
        prompt: string;
        temperature: number;
        maxTokens: number;
        rawResponse?: boolean;
    }): Promise<RequestUrlResponse> {
        try {
            const payload = {
                model: params.model,
                messages: [
                    {
                        role: 'user',
                        content: params.prompt
                    }
                ],
                temperature: params.temperature,
                max_tokens: params.maxTokens,
                top_p: 1.0,
                stream: false,
                response_format: params.rawResponse ? undefined : { type: "json_object" }
            };

            const response = await requestUrl({
                url: this.apiEndpoint,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify(payload)
            });

            return response;
        } catch (error) {
            console.error(`MistralAdapter makeApiRequest error:`, error);
            throw error;
        }
    }

    protected extractContentFromResponse(response: RequestUrlResponse): string {
        try {
            const data = response.json;
            return data.choices[0].message.content;
        } catch (error) {
            console.error(`MistralAdapter extractContentFromResponse error:`, error);
            throw new Error('Failed to parse response from Mistral API.');
        }
    }
}