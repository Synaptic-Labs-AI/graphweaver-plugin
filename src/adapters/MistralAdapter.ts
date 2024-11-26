import { RequestUrlResponse, requestUrl } from 'obsidian'; // Updated import
import { AIProvider } from '../models/AIModels';
import { AIAdapter } from './AIAdapter';

export class MistralAdapter extends AIAdapter { // Changed to extend AIAdapter
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
            const payload: any = {
                model: params.model,
                temperature: params.temperature,
                top_p: 1.0, // Default or retrieve from options if available
                max_tokens: params.maxTokens,
                messages: [ // Aligning payload structure with OpenAI's messages array
                    {
                        role: 'user',
                        content: params.prompt
                    }
                ],
                stream: false,
                stop: null,
                random_seed: 0,
                response_format: params.rawResponse ? undefined : { type: 'json_object' },
                tools: [],
                tool_choice: 'auto',
                presence_penalty: 0,
                frequency_penalty: 0,
                n: 1,
                safe_prompt: false
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
            return data.choices[0].text.trim(); // Ensure this aligns with Mistral's response structure
        } catch (error) {
            console.error(`MistralAdapter extractContentFromResponse error:`, error);
            throw new Error('Failed to parse response from Mistral API.');
        }
    }
}