// src/generators/FrontMatterGenerator.ts

import { BaseGenerator, BaseGeneratorInput, BaseGeneratorOutput } from './BaseGenerator';
import { AIAdapter } from '../adapters/AIAdapter';
import { SettingsService } from '../services/SettingsService';
import { JsonSchemaGenerator } from './JsonSchemaGenerator';
import { PropertyTag } from '../models/PropertyTag';

/**
 * Input interface for front matter generation
 */
export interface FrontMatterInput extends BaseGeneratorInput {
    content: string;                   // The note content to generate front matter for
    customProperties?: PropertyTag[];  // Optional custom properties
    customTags?: string[];             // Optional custom tags
}

/**
 * Output interface for front matter generation
 */
export interface FrontMatterOutput extends BaseGeneratorOutput {
    content: string;                   // The content with generated front matter
}

/**
 * Generator class that creates and manages front matter content.
 * Extends BaseGenerator with specific input/output types for front matter.
 */
export class FrontMatterGenerator extends BaseGenerator<FrontMatterInput, FrontMatterOutput> {
    public jsonSchemaGenerator: JsonSchemaGenerator;

    constructor(
        aiAdapter: AIAdapter, 
        settingsService: SettingsService, 
        jsonSchemaGenerator: JsonSchemaGenerator
    ) {
        super(aiAdapter, settingsService);
        this.jsonSchemaGenerator = jsonSchemaGenerator;
    }

    /**
     * Generates front matter for the provided content
     * @param input The input containing content and optional properties
     * @returns Promise resolving to content with front matter
     */
    public async generate(input: FrontMatterInput): Promise<FrontMatterOutput> {
        console.log('FrontMatterGenerator: Starting generation');
        
        try {
            const settings = this.getSettings();
            
            // Prepare complete input with settings
            const completeInput: FrontMatterInput = {
                ...input,
                customProperties: input.customProperties || settings.frontMatter.customProperties,
                customTags: input.customTags || settings.tags.customTags.map(tag => tag.name)
            };

            console.log('FrontMatterGenerator: Complete input prepared:', completeInput);

            const prompt = this.preparePrompt(completeInput);
            const model = await this.getCurrentModel();
            
            console.log('FrontMatterGenerator: Sending request to AI');
            const aiResponse = await this.aiAdapter.generateResponse(prompt, model);
            
            console.log('FrontMatterGenerator: AI response received:', aiResponse);

            if (!aiResponse.success || !aiResponse.data) {
                console.error('FrontMatterGenerator: AI response was unsuccessful or empty');
                return { content: input.content }; // Return original content if AI generation fails
            }

            return this.formatOutput(aiResponse.data, completeInput);
        } catch (error) {
            console.error('FrontMatterGenerator: Error during generation:', error);
            return { content: input.content }; // Return original content on error
        }
    }

    /**
     * Prepares the AI prompt with schema and context
     * @param input The input containing content and properties
     * @returns Formatted prompt string
     */
    protected preparePrompt(input: FrontMatterInput): string {
        const schema = this.jsonSchemaGenerator.generateBaseSchema();
        const propertyPrompt = input.customProperties?.map(prop => 
            `${prop.name} (${prop.type}): ${prop.description}`
        ).join('\n') || '';
        
        const tagPrompt = input.customTags?.join(', ') || '';

        return `
# MISSION
Act as an expert analyzer and creator of metadata, with a specialization in ontological organization. Use the custom properties and available tags below to generate JSON formatted text based on the provided schema, using the note content for reference.

# GUIDELINES
- You must ONLY use the properties provided, taking the description of the property as guidance for generation.
- Prioritize use of the available tags, but remain flexible in choosing additional tags that would be useful in labelling the note content.
- Omit all other text including words before or after or backticks, returning ONLY the formatted JSON.

## Custom Properties
${propertyPrompt}

## Available Tags
${tagPrompt}

## Note Content
Below is the content of the note you can use to generate completed JSON schema. Omit it from your generation.
${input.content}

## JSON Schema:
${JSON.stringify(schema, null, 2)}

Remember, return only the properly formatted JSON with no words before or after, or backticks.
`;
    }

    /**
     * Formats AI response into proper front matter structure
     * @param aiResponse The AI response data
     * @param originalInput The original input parameters
     * @returns Formatted output with front matter
     */
    protected formatOutput(aiResponse: any, originalInput: FrontMatterInput): FrontMatterOutput {
        console.log('FrontMatterGenerator: Formatting AI response into front matter');

        const parsedResponse = this.parseAIResponse(aiResponse);
        if (!parsedResponse) {
            console.error('FrontMatterGenerator: Failed to parse AI response');
            return { content: originalInput.content };
        }

        const frontMatter = this.convertToFrontMatter(parsedResponse);
        const finalContent = this.mergeFrontMatter(originalInput.content, frontMatter);

        console.log('FrontMatterGenerator: Front matter generated successfully');

        return { content: finalContent };
    }

    /**
     * Parses and validates AI response
     */
    public parseAIResponse(data: any): any {
        if (typeof data === 'object' && data !== null) {
            return data;
        }

        try {
            const parsed = JSON.parse(data);
            if (typeof parsed === 'object' && parsed !== null) {
                return parsed;
            }
        } catch (error) {
            console.error("FrontMatterGenerator: Error parsing AI response as JSON:", error);
        }

        return null;
    }

    /**
     * Converts parsed response to YAML front matter format
     */
    public convertToFrontMatter(data: any): string {
        return Object.entries(data)
            .map(([key, value]) => {
                if (Array.isArray(value)) {
                    return `${key}:\n${value.map((item: string) => `  - ${item}`).join('\n')}`;
                } else if (typeof value === 'object' && value !== null) {
                    return `${key}: ${JSON.stringify(value)}`;
                } else {
                    return `${key}: ${value}`;
                }
            })
            .join('\n');
    }

    /**
     * Merges front matter with original content
     */
    public mergeFrontMatter(content: string, frontMatter: string): string {
        const hasFrontMatter = content.trim().startsWith('---');

        if (!hasFrontMatter) {
            return `---\n${frontMatter}\n---\n\n${content.trim()}`;
        }

        const parts = content.split('---');
        if (parts.length >= 3) {
            const existingFrontMatter = parts[1].trim();
            const contentParts = parts.slice(2).join('---').trim();
            return `---\n${frontMatter}\n---\n${contentParts}`;
        }

        return `---\n${frontMatter}\n---\n\n${content.trim()}`;
    }

    /**
     * Validates input parameters
     */
    protected validateInput(input: FrontMatterInput): boolean {
        return typeof input.content === 'string' && input.content.trim().length > 0;
    }

    /**
     * Gets the current AI model
     */
    protected async getCurrentModel(): Promise<string> {
        const settings = this.getSettings();
        const providerType = this.aiAdapter.getProviderType();
        const modelApiName = settings.aiProvider?.selectedModels?.[providerType];
        
        if (!modelApiName) {
            throw new Error(`No model selected for provider: ${providerType}`);
        }
        
        return modelApiName;
    }
}
