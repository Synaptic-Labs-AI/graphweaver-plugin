// src/generators/WikilinkGenerator.ts

import { BaseGenerator, BaseGeneratorInput, BaseGeneratorOutput } from './BaseGenerator';
import { AIAdapter, AIProvider } from 'src/models/AIModels';
import { SettingsService } from '../services/SettingsService';
import { WikilinkTextProcessor } from '../services/WikilinkTextProcessor';
import { ServiceError } from '../services/core/ServiceError';

/**
 * Input interface for wikilink generation
 */
interface WikilinkInput extends BaseGeneratorInput {
    content: string;           // Content to process
    existingPages: string[];   // List of existing page names
}

/**
 * Output interface for wikilink generation
 */
export interface WikilinkOutput extends BaseGeneratorOutput {
    content: string;          // Processed content with wikilinks
}

/**
 * Interface for the AI suggestions response
 */
interface AISuggestionsResponse {
    suggestions: string[];
}

/**
 * Interface for the data property in the AI response
 */
interface AIResponseData {
    value: AISuggestionsResponse;
    valid: boolean;
    fixes?: any;
}

/**
 * Interface for the main AI response
 */
interface AIResponse {
    success: boolean;
    data: AIResponseData;
}

/**
 * Enhanced generator for managing wikilinks in markdown content.
 * Delegates text processing to WikilinkTextProcessor service.
 */
export class WikilinkGenerator extends BaseGenerator<WikilinkInput, WikilinkOutput> {
    private textProcessor: WikilinkTextProcessor;

    constructor(
        aiAdapter: AIAdapter,
        settingsService: SettingsService,
    ) {
        super(aiAdapter, settingsService);
        this.textProcessor = new WikilinkTextProcessor();
    }

    /**
     * Initialize required services
     */
    public async initialize(): Promise<void> {
        await this.textProcessor.initialize();
        console.log('WikilinkGenerator: Initialized.');
    }

    /**
     * Clean up resources
     */
    public async destroy(): Promise<void> {
        this.textProcessor.destroy();
        console.log('WikilinkGenerator: Destroyed.');
    }

    /**
     * Generate wikilinks for the provided content
     */
    public async generate(input: WikilinkInput): Promise<WikilinkOutput> {
        try {
            console.log('WikilinkGenerator: Starting generation for input.');
            if (!this.validateInput(input)) {
                throw new Error('Invalid input for wikilink generation');
            }

            // Prepare prompt and get AI response
            const prompt = this.preparePrompt(input);
            console.log('WikilinkGenerator: Prepared prompt:', prompt);
            const model = await this.getCurrentModel();
            console.log('WikilinkGenerator: Using model:', model);
            const aiResponse = await this.aiAdapter.generateResponse(prompt, model) as AIResponse;
            console.log('WikilinkGenerator: Received AI response:', aiResponse);

            // Extract the actual AI response value
            let aiResponseValue: AISuggestionsResponse;
            if (aiResponse && aiResponse.success && aiResponse.data && aiResponse.data.value) {
                aiResponseValue = aiResponse.data.value;
            } else {
                throw new Error('Invalid AI response format');
            }

            // Format output using text processor
            const output = this.formatOutput(aiResponseValue, input);
            console.log('WikilinkGenerator: Formatted output:', output);
            return output;
        } catch (error) {
            console.error('WikilinkGenerator: Error during generation:', error);
            throw new ServiceError(
                'WikilinkGenerator',
                'Failed to generate wikilinks',
                error instanceof Error ? error : undefined
            );
        }
    }

    /**
     * Prepare AI prompt with custom tags and context
     */
    protected preparePrompt(input: WikilinkInput): string {
        const settings = this.getSettings();
        const customTags = settings.tags.customTags
            .map((tag: { name: string }) => tag.name)
            .join(', ') || '';

        return `
# MISSION
Act as an expert in recommending wikilinks for potential future research notes.
Analyze the following content and suggest key phrases, proper nouns, people, places, events, and concepts that would make for a relevant and practical note.
Consider the existing pages in the vault and prioritize linking to them. Ignore all tags and front matter when generating.

# CONTENT
${input.content}

# EXISTING PAGES
${input.existingPages.join(', ')}

Provide your suggestions as a JSON array of strings, omitting all characters before or after, including backticks.
        `;
    }

    /**
     * Format AI response into wikilink output using text processor
     */
    protected formatOutput(aiResponse: AISuggestionsResponse, originalInput: WikilinkInput): WikilinkOutput {
        // Parse suggested links from AI response
        const suggestedLinks = this.parseSuggestedLinks(aiResponse);
        console.log('WikilinkGenerator: Suggested Links:', suggestedLinks);

        // Get existing wikilinks from content
        const existingLinks = this.extractExistingWikilinks(originalInput.content);
        console.log('WikilinkGenerator: Existing Wikilinks:', Array.from(existingLinks));

        // Process content using text processor
        let processedContent = originalInput.content;
        processedContent = this.textProcessor.addWikilinks(
            processedContent,
            suggestedLinks,
            existingLinks
        );
        processedContent = this.textProcessor.cleanNestedWikilinks(processedContent);

        return { content: processedContent };
    }

    /**
     * Parse suggested links from AI response
     */
    protected parseSuggestedLinks(aiResponse: AISuggestionsResponse): string[] {
        if (aiResponse && Array.isArray(aiResponse.suggestions)) {
            return aiResponse.suggestions.filter((item: any): item is string => typeof item === 'string');
        }

        console.error('WikilinkGenerator: Unexpected AI response format:', aiResponse);
        return [];
    }

    /**
     * Validate input structure
     */
    protected validateInput(input: WikilinkInput): boolean {
        return typeof input.content === 'string' && 
               input.content.trim().length > 0 && 
               Array.isArray(input.existingPages) &&
               input.existingPages.every(page => typeof page === 'string');
    }

    /**
     * Get current AI model based on settings
     */
    protected async getCurrentModel(): Promise<string> {
        const settings = this.getSettings();
        const providerType: AIProvider = this.aiAdapter.getProviderType();
        const selectedModel = settings.aiProvider?.selectedModels?.[providerType];

        if (!selectedModel) {
            throw new ServiceError(
                'WikilinkGenerator',
                `No model selected for provider type: ${providerType}`
            );
        }

        return selectedModel;
    }

    /**
     * Extract existing wikilinks from content
     */
    private extractExistingWikilinks(content: string): Set<string> {
        const regex = /\[\[([^\]]+)\]\]/g;
        const existingLinks = new Set<string>();
        let match: RegExpExecArray | null;

        while ((match = regex.exec(content)) !== null) {
            const link = match[1].split('|')[0].trim().toLowerCase();
            existingLinks.add(link);
        }

        return existingLinks;
    }
}
