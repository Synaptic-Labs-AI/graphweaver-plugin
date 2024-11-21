// src/generators/FrontMatterGenerator.ts

import { BaseGenerator, BaseGeneratorInput, BaseGeneratorOutput } from '@generators/BaseGenerator';
import { AIAdapter, AIProvider } from '@type/ai.types';
import { SettingsService } from '@services/SettingsService';
import { JsonSchemaGenerator } from '@generators/JsonSchemaGenerator';
import { PropertyTag } from '@type/metadata.types';

/**
 * Input interface for front matter generation
 */
export interface FrontMatterInput extends BaseGeneratorInput {
    content: string;                   
    customProperties?: PropertyTag[];  
    customTags?: string[];             
}

/**
 * Output interface for front matter generation
 */
export interface FrontMatterOutput extends BaseGeneratorOutput {
    content: string;                   
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
        
        try {
            const settings = this.getSettings();
            
            // Prepare complete input with settings
            const completeInput: FrontMatterInput = {
                ...input,
                customProperties: input.customProperties || settings.frontMatter.customProperties,
                customTags: input.customTags || settings.tags.customTags.map((tag: { name: string }) => tag.name)
            };

            const prompt = this.preparePrompt(completeInput);
            const model = await this.getCurrentModel();
            
            const aiResponse = await this.aiAdapter.generateResponse(prompt, model);

            if (!aiResponse.success || !aiResponse.data) {
                return { content: input.content }; 
            }

            return this.formatOutput(aiResponse.data, completeInput);
        } catch (error) {
            console.error('FrontMatterGenerator: Error during generation:', error);
            return { content: input.content };
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
Act as an expert analyzer and creator of metadata, with a specialization in ontological organization for Obsidian Vaults. Generate ONLY front matter fields based on the provided schema and available properties/tags.

# GUIDELINES
- You must ONLY use the properties provided in the schema
- Front matter fields will NOT include the note content itself
- Prioritize using available tags, but remain flexible in choosing additional relevant tags
- Return ONLY the formatted JSON object with front matter fields
- Do NOT include the content field in your response

## Custom Properties
${propertyPrompt}

## Available Tags
${tagPrompt}

## Note Content for Reference (OMIT FROM OUTPUT)
${input.content}

## JSON Schema for Front Matter Fields:
${JSON.stringify(schema, null, 2)}

Generate ONLY the front matter fields as JSON. Do not include any other text or the note content.
`;
    }

    /**
     * Formats AI response into proper front matter structure
     * @param aiResponse The AI response data
     * @param originalInput The original input parameters
     * @returns Formatted output with front matter
     */
    protected formatOutput(aiResponse: any, originalInput: FrontMatterInput): FrontMatterOutput {
    
        const parsedResponse = this.parseAIResponse(aiResponse);
        if (!parsedResponse) {
            console.error('FrontMatterGenerator: Failed to parse AI response');
            return { content: originalInput.content };
        }
    
        // Remove any content field that might have been included
        if ('content' in parsedResponse) {
            delete parsedResponse.content;
        }
    
        const frontMatter = this.convertToFrontMatter(parsedResponse);
        const finalContent = this.mergeFrontMatter(originalInput.content, frontMatter);
    
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
        const providerType: AIProvider = this.aiAdapter.getProviderType();
        const modelApiName = settings.aiProvider?.selectedModels?.[providerType];
        
        if (!modelApiName) {
            throw new Error(`No model selected for provider: ${providerType}`);
        }
        
        return modelApiName;
    }
}
