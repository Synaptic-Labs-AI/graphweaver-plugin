import { TFile, App, Notice } from 'obsidian';
import { BaseGenerator } from './BaseGenerator';
import { AIAdapter } from '../adapters/AIAdapter';
import { SettingsService } from '../services/SettingsService';
import { JsonSchemaGenerator } from './JsonSchemaGenerator';
import { JsonValidationService } from '../services/JsonValidationService';

export interface KnowledgeBloomInput {
    sourceFile: TFile;
    userPrompt?: string;
}

export interface KnowledgeBloomResult {
    generatedNotes: { title: string; content: string }[];
}

export class KnowledgeBloomGenerator extends BaseGenerator {
    private jsonSchemaGenerator: JsonSchemaGenerator;
    private jsonValidationService: JsonValidationService;

    constructor(
        aiAdapter: AIAdapter,
        settingsService: SettingsService,
        public app: App
    ) {
        super(aiAdapter, settingsService);
        this.jsonSchemaGenerator = new JsonSchemaGenerator(this.settingsService);
        this.jsonValidationService = this.settingsService.getJsonValidationService();
    }

    public async generate(input: KnowledgeBloomInput): Promise<KnowledgeBloomResult> {
        console.log('KnowledgeBloomGenerator: Starting Knowledge Bloom generation');
        const { sourceFile, userPrompt } = input;

        if (!this.validateInput(input)) {
            console.error('KnowledgeBloomGenerator: Invalid input for Knowledge Bloom generation');
            throw new Error('Invalid input for Knowledge Bloom generation');
        }

        try {
            const wikilinks = await this.extractWikilinks(sourceFile);
            console.log(`KnowledgeBloomGenerator: Found ${wikilinks.length} wikilinks`);
            if (wikilinks.length === 0) {
                throw new Error('No wikilinks found in the source file.');
            }

            const generatedNotes = await this.generateNotesForWikilinks(wikilinks, userPrompt);
            console.log('KnowledgeBloomGenerator: Successfully generated notes for all wikilinks');
            return { generatedNotes };
        } catch (error) {
            this.handleError(error);
        }
    }

    protected async extractWikilinks(file: TFile): Promise<string[]> {
        console.log(`KnowledgeBloomGenerator: Extracting wikilinks from ${file.path}`);
        const content = await this.app.vault.read(file);
        const wikilinks = content.match(/\[\[([^\]]+)\]\]/g) || [];
        const links = wikilinks.map((link: string) => link.slice(2, -2));
        console.log(`KnowledgeBloomGenerator: Extracted wikilinks: ${links.join(', ')}`);
        return links;
    }

    protected async generateNotesForWikilinks(wikilinks: string[], userPrompt?: string): Promise<{ title: string; content: string }[]> {
        const generatedNotes = [];

        for (const link of wikilinks) {
            console.log(`KnowledgeBloomGenerator: Generating note for wikilink "${link}"`);
            try {
                // Dynamically generate schema based on the wikilink/topic
                const schema = this.jsonSchemaGenerator.generateSchemaForTopic(link);
                console.log(`KnowledgeBloomGenerator: Generated JSON schema for "${link}": ${JSON.stringify(schema, null, 2)}`);

                // Prepare prompt with schema
                const prompt = this.preparePrompt(link, schema, userPrompt);
                console.log(`KnowledgeBloomGenerator: Prepared AI prompt for "${link}"`);

                // Generate AI response
                console.log(`KnowledgeBloomGenerator: Sending request to AI for "${link}"`);
                const aiResponse = await this.aiAdapter.generateResponse(prompt, this.getCurrentModel());
                console.log(`KnowledgeBloomGenerator: Received AI response for "${link}": ${JSON.stringify(aiResponse, null, 2)}`);

                if (!aiResponse.success || !aiResponse.data) {
                    console.error(`KnowledgeBloomGenerator: AI failed to generate response for "${link}": ${aiResponse.error || 'Unknown error'}`);
                    throw new Error(`AI failed to generate response for "${link}": ${aiResponse.error || 'Unknown error'}`);
                }

                // Validate the JSON response
                const isValid = this.jsonValidationService.validate(aiResponse.data, schema);
                if (!isValid) {
                    console.error(`KnowledgeBloomGenerator: AI response for "${link}" does not conform to the expected schema.`);
                    throw new Error(`AI response for "${link}" does not conform to the expected schema.`);
                }
                console.log(`KnowledgeBloomGenerator: AI response for "${link}" is valid`);

                // Convert JSON to Markdown
                const markdownContent = this.convertJsonToMarkdown(aiResponse.data);
                console.log(`KnowledgeBloomGenerator: Converted JSON to Markdown for "${link}"`);

                generatedNotes.push({ title: link, content: markdownContent });
            } catch (error) {
                console.error(`KnowledgeBloomGenerator: Error generating note for "${link}": ${(error as Error).message}`);
                // Continue processing other wikilinks instead of throwing
                new Notice(`Failed to generate note for "${link}": ${(error as Error).message}`);
            }
        }

        console.log(`KnowledgeBloomGenerator: Generated ${generatedNotes.length} notes out of ${wikilinks.length} wikilinks`);
        return generatedNotes;
    }

    /**
     * Prepares the prompt for the AI, including the JSON schema.
     * @param wikilink The wikilink/topic for which to generate the note.
     * @param schema The JSON schema the AI should adhere to.
     * @param userPrompt Optional additional context from the user.
     * @returns The prepared prompt string.
     */
    protected preparePrompt(wikilink: string, schema: object, userPrompt?: string): string {
        console.log(`KnowledgeBloomGenerator: Preparing AI prompt for "${wikilink}"`);
        return `
You are an AI assistant that helps generate structured notes.

Please generate a JSON object that adheres to the following schema:
${JSON.stringify(schema, null, 2)}

Ensure that the JSON is well-formed and follows the schema precisely.

Topic: "${wikilink}"
${userPrompt ? `Additional Context: ${userPrompt}` : ''}

Response:
`;
    }

    /**
     * Converts validated JSON data into Markdown format with front matter.
     * @param data The validated JSON data.
     * @returns The Markdown string.
     */
    protected convertJsonToMarkdown(data: any): string {
        console.log("KnowledgeBloomGenerator: Converting JSON to Markdown");
        let markdown = '';

        // Convert front matter
        markdown += '---\n';
        Object.keys(data).forEach(key => {
            if (key !== 'content') { // Exclude content field
                if (Array.isArray(data[key])) {
                    markdown += `${key}: [${data[key].map((item: string) => `"${item}"`).join(', ')}]\n`;
                } else {
                    markdown += `${key}: ${data[key]}\n`;
                }
            }
        });
        markdown += '---\n\n';

        // Add main content
        if (data.content) {
            markdown += data.content;
        }

        console.log("KnowledgeBloomGenerator: Conversion complete");
        return markdown;
    }

    /**
     * Implements the abstract method from BaseGenerator to format the AI response.
     * @param input An object containing the AI response and additional data.
     * @returns The formatted Markdown string.
     */
    protected formatOutput(input: any): string {
        // Not used in this context as we're directly handling formatting in generateNotesForWikilinks
        return '';
    }

    protected validateInput(input: KnowledgeBloomInput): boolean {
        const isValid = input.sourceFile instanceof TFile;
        console.log(`KnowledgeBloomGenerator: Input validation result: ${isValid}`);
        return isValid;
    }

    public getCurrentModel(): string {
        const settings = this.getSettings();
        const selectedModel = settings.knowledgeBloom?.selectedModel;

        if (!selectedModel) {
            console.error('KnowledgeBloomGenerator: No model selected for Knowledge Bloom.');
            throw new Error(`No model selected for Knowledge Bloom.`);
        }

        console.log(`KnowledgeBloomGenerator: Current model for Knowledge Bloom: ${selectedModel}`);
        return selectedModel;
    }

    protected handleError(error: Error): never {
        console.error(`KnowledgeBloomGenerator: Knowledge Bloom generation error: ${error.message}`, error);
        new Notice(`Knowledge Bloom generation failed: ${error.message}`);
        throw new Error(`Knowledge Bloom generation failed: ${error.message}`);
    }
}
