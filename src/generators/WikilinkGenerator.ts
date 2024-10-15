import { BaseGenerator } from './BaseGenerator';
import { AIAdapter } from '../adapters/AIAdapter';
import { SettingsService } from '../services/SettingsService';
import { PluginSettings } from '../models/Settings';

interface WikilinkInput {
    content: string;
    existingPages: string[];
}

export class WikilinkGenerator extends BaseGenerator {
    public readonly WIKILINK_REGEX = /\[\[([^\]]+)\]\]/g;

    constructor(aiAdapter: AIAdapter, settingsService: SettingsService) {
        super(aiAdapter, settingsService);
    }

    public async generate(input: WikilinkInput): Promise<string> {
        if (!this.validateInput(input)) {
            throw new Error('Invalid input for wikilink generation');
        }

        try {
            const prompt = this.preparePrompt(input);
            const aiResponse = await this.aiAdapter.generateResponse(prompt, this.getCurrentModel());
            return this.formatOutput(aiResponse.data, input);
        } catch (error) {
            this.handleError(error);
        }
    }

    protected preparePrompt(input: WikilinkInput): string {
        const settings = this.getSettings();
        const customTags = settings.tags.customTags.map((tag: { name: string }) => tag.name).join(', ') || '';

        return `
            Analyze the following content and suggest key phrases that could be turned into wikilinks.
            Consider the existing pages in the vault and prioritize linking to them.
            Also consider the following custom tags used in this knowledge base: ${customTags}

            Content:
            ${input.content}

            Existing pages:
            ${input.existingPages.join(', ')}

            Provide your suggestions as a JSON array of strings.
        `;
    }

    protected formatOutput(aiResponse: any, originalInput: WikilinkInput): string {
        const suggestedLinks = this.parseSuggestedLinks(aiResponse);
        let content = originalInput.content;
        const existingWikilinks = this.extractExistingWikilinks(content);
        
        // Sort suggested links by length (descending) to prioritize longer phrases
        suggestedLinks.sort((a, b) => b.length - a.length);

        suggestedLinks.forEach(phrase => {
            if (!existingWikilinks.includes(phrase.toLowerCase())) {
                const regex = new RegExp(`\\b${this.escapeRegExp(phrase)}\\b`, 'gi');
                content = content.replace(regex, (match) => {
                    // Check if the match is already part of a wikilink
                    const prevChar = content[content.indexOf(match) - 1];
                    const nextChar = content[content.indexOf(match) + match.length];
                    if (prevChar === '[' && nextChar === ']') {
                        return match; // It's already a wikilink, don't modify
                    }
                    return `[[${match}]]`;
                });
            }
        });

        return content;
    }

    public extractExistingWikilinks(content: string): string[] {
        const matches = content.match(this.WIKILINK_REGEX) || [];
        return matches.map(match => match.slice(2, -2).toLowerCase());
    }

    public parseSuggestedLinks(aiResponse: unknown): string[] {
        console.log('AI Response:', JSON.stringify(aiResponse, null, 2));
    
        if (typeof aiResponse === 'string') {
            try {
                aiResponse = JSON.parse(aiResponse);
            } catch (error) {
                console.error('Failed to parse AI response as JSON:', error);
                return [];
            }
        }
    
        if (Array.isArray(aiResponse)) {
            return aiResponse.filter((item): item is string => typeof item === 'string');
        }
    
        if (typeof aiResponse === 'object' && aiResponse !== null) {
            const arrayValues = Object.values(aiResponse).find(Array.isArray);
            if (arrayValues) {
                return arrayValues.filter((item): item is string => typeof item === 'string');
            }
        }
    
        console.error('Unexpected AI response format:', aiResponse);
        return [];
    }

    protected validateInput(input: WikilinkInput): boolean {
        return typeof input.content === 'string' && 
               input.content.trim().length > 0 && 
               Array.isArray(input.existingPages);
    }

    public getCurrentModel(): string {
        const settings = this.getSettings();
        const providerType = this.aiAdapter.getProviderType();
        const selectedModel = settings.aiProvider?.selectedModels?.[providerType];

        if (!selectedModel) {
            throw new Error(`No model selected for provider type: ${providerType}`);
        }

        return selectedModel;
    }

    public escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    protected handleError(error: Error): never {
        console.error(`Wikilink generation error: ${error.message}`);
        throw new Error(`Wikilink generation failed: ${error.message}`);
    }
}