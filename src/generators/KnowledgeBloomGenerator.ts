// KnowledgeBloomGenerator.ts

import { TFile, App, Notice } from 'obsidian';
import { BaseGenerator, BaseGeneratorInput, BaseGeneratorOutput } from './BaseGenerator';
import { AIAdapter } from '../adapters/AIAdapter';
import { SettingsService } from '../services/SettingsService';
import { JsonSchemaGenerator } from './JsonSchemaGenerator';
import { JsonValidationService } from '../services/JsonValidationService';
import { FrontMatterGenerator, FrontMatterInput, FrontMatterOutput } from './FrontMatterGenerator';
import { PropertyTag } from '../models/PropertyTag';

/**
 * Input interface for the Knowledge Bloom generator
 */
export interface KnowledgeBloomInput extends BaseGeneratorInput {
    sourceFile: TFile;            // The source file containing wikilinks
    userPrompt?: string;          // Optional user context for generation
    currentWikilink?: string;     // Current wikilink being processed
    schema?: object;              // JSON schema for the current generation
}

/**
 * Output interface for the Knowledge Bloom generator
 */
export interface KnowledgeBloomOutput extends BaseGeneratorOutput {
    generatedNotes: { 
        title: string;            // Title of the generated note
        content: string;          // Content of the generated note
    }[];
}

/**
 * Generator class that creates new notes from wikilinks in a source document.
 * Extends BaseGenerator with specific input/output types for Knowledge Bloom functionality.
 */
export class KnowledgeBloomGenerator extends BaseGenerator<KnowledgeBloomInput, KnowledgeBloomOutput> {
    public jsonSchemaGenerator: JsonSchemaGenerator;
    public jsonValidationService: JsonValidationService;
    public frontMatterGenerator: FrontMatterGenerator;
    public currentInput: KnowledgeBloomInput | null = null;

    constructor(
        aiAdapter: AIAdapter,
        settingsService: SettingsService,
        public app: App,
        frontMatterGenerator: FrontMatterGenerator // Inject FrontMatterGenerator
    ) {
        super(aiAdapter, settingsService);
        this.jsonSchemaGenerator = new JsonSchemaGenerator(this.settingsService);
        this.jsonValidationService = this.settingsService.getJsonValidationService();
        this.frontMatterGenerator = frontMatterGenerator;
    }

    /**
     * Override the generate method to handle multiple wikilinks
     * @param input The input parameters for generation
     * @returns Promise resolving to generated notes
     */
    public async generate(input: KnowledgeBloomInput): Promise<KnowledgeBloomOutput> {
        this.currentInput = input;
        console.log('KnowledgeBloomGenerator: Starting Knowledge Bloom generation');
        
        try {
            if (!this.validateInput(input)) {
                throw new Error('Invalid input for Knowledge Bloom generation');
            }

            const wikilinks = await this.extractWikilinks(input.sourceFile);
            console.log(`KnowledgeBloomGenerator: Found ${wikilinks.length} unique wikilinks`);

            if (wikilinks.length === 0) {
                throw new Error('No wikilinks found in the source file.');
            }

            // Initialize the output
            const output: KnowledgeBloomOutput = { generatedNotes: [] };

            // Process each wikilink
            for (const link of wikilinks) {
                try {
                    const schema = this.jsonSchemaGenerator.generateSchemaForTopic(link);
                    
                    const prompt = this.preparePrompt({
                        sourceFile: input.sourceFile,
                        userPrompt: input.userPrompt,
                        currentWikilink: link,
                        schema: schema
                    });

                    const model = await this.getCurrentModel();
                    const aiResponse = await this.aiAdapter.generateResponse(prompt, model);

                    if (!aiResponse.success || !aiResponse.data) {
                        throw new Error(`AI failed to generate response for "${link}": ${aiResponse.error || 'Unknown error'}`);
                    }

                    if (!this.jsonValidationService.validate(aiResponse.data)) {
                        throw new Error(`Invalid JSON response for "${link}"`);
                    }

                    // Extract content and properties from AI response
                    const content = aiResponse.data.content || '';
                    const customProperties: PropertyTag[] = this.extractCustomProperties(aiResponse.data);
                    const customTags: string[] = this.extractCustomTags(aiResponse.data);

                    // Use FrontMatterGenerator to generate front matter
                    const frontMatterInput: FrontMatterInput = {
                        content: content, 
                        customProperties: customProperties, 
                        customTags: customTags
                    };

                    const frontMatterResult: FrontMatterOutput = await this.frontMatterGenerator.generate(frontMatterInput);
                    const markdownContent = frontMatterResult.content;

                    output.generatedNotes.push({ title: link, content: markdownContent });
                    console.log(`KnowledgeBloomGenerator: Successfully generated note for "${link}".`);
                } catch (error) {
                    console.error(`Error generating note for "${link}":`, error);
                    new Notice(`Failed to generate note for "${link}": ${(error as Error).message}`);
                }
            }

            return output;
        } catch (error) {
            return this.handleError(error as Error);
        } finally {
            this.currentInput = null;
        }
    }

    /**
     * Implements the abstract formatOutput method from BaseGenerator
     * Processes the AI response and generates the KnowledgeBloomOutput
     * @param aiResponse AI response (not used in this overridden method)
     * @param originalInput Original input parameters (not used in this overridden method)
     * @returns KnowledgeBloomOutput with generated notes
     */
    protected formatOutput(aiResponse: any, originalInput: KnowledgeBloomInput): KnowledgeBloomOutput {
        // Since we've overridden generate, we don't use formatOutput here.
        // Alternatively, you can refactor the class to better utilize the base class.
        throw new Error('Method not implemented.');
    }

    /**
     * Extracts unique wikilinks from a file
     * @param file The file to extract wikilinks from
     * @returns Array of unique wikilink strings
     */
    protected async extractWikilinks(file: TFile): Promise<string[]> {
        console.log(`KnowledgeBloomGenerator: Extracting wikilinks from ${file.path}`);
        const content = await this.app.vault.read(file);
        const wikilinks = content.match(/\[\[([^\]]+)\]\]/g) || [];
        const links = wikilinks.map((link: string) => link.slice(2, -2));
        const uniqueLinks = Array.from(new Set(links.map(link => link.toLowerCase())));
        console.log(`KnowledgeBloomGenerator: Extracted ${uniqueLinks.length} unique wikilinks: ${uniqueLinks.join(', ')}`);
        return uniqueLinks;
    }

    /**
     * Prepares the AI prompt with schema and context
     * @param input The input containing wikilink and schema
     * @returns Formatted prompt string
     */
    protected preparePrompt(input: KnowledgeBloomInput): string {
        if (!input.currentWikilink || !input.schema) {
            throw new Error('Missing required wikilink or schema in input');
        }

        return `
You are an AI assistant that helps generate structured notes.

Please generate a JSON object that adheres to the following schema:
${JSON.stringify(input.schema, null, 2)}

Ensure that the JSON is well-formed and follows the schema precisely.

Topic: "${input.currentWikilink}"
${input.userPrompt ? `Additional Context: ${input.userPrompt}` : ''}

Response:
`;
    }

    /**
     * Extracts custom properties from AI response data based on schema
     * @param data AI response data
     * @returns Array of PropertyTag
     */
    public extractCustomProperties(data: any): PropertyTag[] {
        const settings = this.settingsService.getSettings();
        // Extract properties based on schema and AI response
        return settings.frontMatter.customProperties.map((property: PropertyTag) => ({
            name: property.name,
            description: property.description,
            type: property.type,
            required: property.required,
            multipleValues: property.multipleValues
        }));
    }

    /**
     * Extracts custom tags from AI response data based on settings
     * @param data AI response data
     * @returns Array of tags
     */
    public extractCustomTags(data: any): string[] {
        const settings = this.settingsService.getSettings();
        return settings.tags.customTags.map(tag => tag.name);
    }

    /**
     * Validate input parameters
     * @param input The input to validate
     * @returns True if input is valid
     */
    protected validateInput(input: KnowledgeBloomInput): boolean {
        const isValid = input?.sourceFile instanceof TFile;
        console.log(`KnowledgeBloomGenerator: Input validation result: ${isValid}`);
        return isValid;
    }

    /**
     * Gets current AI model for generation
     * @returns Promise resolving to model identifier
     */
    protected async getCurrentModel(): Promise<string> {
        const settings = this.getSettings();
        const selectedModel = settings.knowledgeBloom?.selectedModel;

        if (!selectedModel) {
            throw new Error('No model selected for Knowledge Bloom.');
        }

        return selectedModel;
    }

    /**
     * Custom error handler for Knowledge Bloom
     * @param error The error to handle
     */
    protected handleError(error: Error): never {
        console.error(`KnowledgeBloomGenerator: Knowledge Bloom generation error: ${error.message}`, error);
        new Notice(`Knowledge Bloom generation failed: ${error.message}`);
        throw new Error(`Knowledge Bloom generation failed: ${error.message}`);
    }
}
