import { BaseGenerator } from './BaseGenerator';
import { AIAdapter } from '../adapters/AIAdapter';
import { SettingsService } from '../services/SettingsService';
import { JsonSchemaGenerator } from './JsonSchemaGenerator';
import { PluginSettings } from '../models/Settings';
import { PropertyTag, Tag } from '../models/PropertyTag';

interface FrontMatterInput {
    noteContent: string;
    customProperties: PropertyTag[];
    customTags: Tag[];
}

export class FrontMatterGenerator extends BaseGenerator {
    public jsonSchemaGenerator: JsonSchemaGenerator;

    constructor(
        aiAdapter: AIAdapter, 
        settingsService: SettingsService, 
        jsonSchemaGenerator: JsonSchemaGenerator
    ) {
        super(aiAdapter, settingsService);
        this.jsonSchemaGenerator = jsonSchemaGenerator;
    }

    public async generate(noteContent: string): Promise<string> {
        console.log('FrontMatterGenerator: Starting generation');
        const settings = this.getSettings();
        const customProperties = settings.frontMatter.customProperties;
        const customTags = settings.tags.customTags;

        const input: FrontMatterInput = { noteContent, customProperties, customTags };
        const prompt = this.preparePrompt(input);
        const modelApiName = this.getCurrentModel();
        console.log('FrontMatterGenerator: Sending request to AI');
        const aiResponse = await this.aiAdapter.generateResponse(prompt, modelApiName);
        console.log('FrontMatterGenerator: Received AI response:', JSON.stringify(aiResponse, null, 2));

        if (!aiResponse.success || !aiResponse.data) {
            console.error('FrontMatterGenerator: AI response was unsuccessful or empty');
            return noteContent; // Return original content if AI generation fails
        }

        const formattedContent = this.formatOutput(aiResponse.data, noteContent);
        console.log('FrontMatterGenerator: Formatted output:', formattedContent);
        return formattedContent;
    }

    protected preparePrompt(input: FrontMatterInput): string {
        const schema = this.jsonSchemaGenerator.generateSchema();
        const propertyPrompt = input.customProperties.map(prop => 
            `${prop.name} (${prop.type}): ${prop.description}`
        ).join('\n');
        const tagPrompt = input.customTags.map(tag => tag.name).join(', ');

        return `
            Generate front matter for the following note content.
            Use the provided JSON schema to structure your response.
            Include relevant custom properties and tags.

            Custom Properties:
            ${propertyPrompt}

            Available Tags:
            ${tagPrompt}

            JSON Schema:
            ${JSON.stringify(schema, null, 2)}

            Note Content:
            ${input.noteContent}

            Provide the filled out JSON object as your response, with no additional text.
            Only include fields that are relevant to the content.
        `;
    }

    protected formatOutput(aiResponse: any, originalContent: string): string {
        console.log("Raw AI Response:", JSON.stringify(aiResponse, null, 2));
        
        let parsedResponse: any;
        
        // If aiResponse is already an object, use it directly
        if (typeof aiResponse === 'object' && aiResponse !== null) {
            parsedResponse = aiResponse;
        } else {
            // If aiResponse is a string, try to parse it
            try {
                parsedResponse = JSON.parse(aiResponse);
            } catch (error) {
                console.error("Error parsing AI response:", error);
                return originalContent; // Return original content if parsing fails
            }
        }
        
        console.log("Parsed AI Response:", JSON.stringify(parsedResponse, null, 2));

        if (typeof parsedResponse !== 'object' || parsedResponse === null) {
            console.error('Invalid AI response format: Not an object after parsing');
            return originalContent; // Return original content if response is invalid
        }

        // Check if the note already has frontmatter
        const hasFrontMatter = originalContent.trim().startsWith('---');

        // Convert parsedResponse to YAML-like format
        let newFrontMatter = Object.entries(parsedResponse).map(([key, value]) => {
            if (Array.isArray(value)) {
                return `${key}:\n  - ${value.join('\n  - ')}`;
            } else if (typeof value === 'object' && value !== null) {
                return `${key}: ${JSON.stringify(value)}`;
            } else {
                return `${key}: ${value}`;
            }
        }).join('\n');

        // Combine new frontmatter with content
        let result: string;
        if (hasFrontMatter) {
            // If frontmatter exists, append new frontmatter to it
            const [existingFrontMatter, ...contentParts] = originalContent.split('---');
            result = `---\n${existingFrontMatter.trim()}\n${newFrontMatter}\n---\n${contentParts.join('---').trim()}`;
        } else {
            // If no frontmatter, add new frontmatter at the beginning
            result = `---\n${newFrontMatter}\n---\n\n${originalContent.trim()}`;
        }

        console.log("Formatted output:", result);
        return result;
    }

    protected validateInput(input: any): boolean {
        return typeof input === 'string' && input.trim().length > 0;
    }

    public getCurrentModel(): string {
        const settings = this.getSettings();
        const providerType = this.aiAdapter.getProviderType();
        const modelApiName = settings.aiProvider?.selectedModels?.[providerType];
        if (!modelApiName) {
            throw new Error(`No model selected for provider: ${providerType}`);
        }
        return modelApiName;
    }
}