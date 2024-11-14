import { TFile, App, Notice } from 'obsidian';
import { BaseGenerator, BaseGeneratorInput, BaseGeneratorOutput } from './BaseGenerator';
import { AIAdapter, AIResponseOptions } from '../models/AIModels';
import { SettingsService } from '../services/SettingsService';
import { FrontMatterGenerator, FrontMatterInput } from './FrontMatterGenerator';
import { PropertyTag } from '../models/PropertyTag';
import { WikilinkTextProcessor } from '../services/WikilinkTextProcessor';

/**
 * Input interface for the Knowledge Bloom generator
 */
export interface KnowledgeBloomInput extends BaseGeneratorInput {
    sourceFile: TFile;            // The source file containing wikilinks
    userPrompt?: string;          // Optional user context for generation
    currentWikilink?: string;     // Current wikilink being processed
    currentNoteTitle?: string;    // Title of the current note
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
    public frontMatterGenerator: FrontMatterGenerator;
    public currentInput: KnowledgeBloomInput | null = null;
    private wikilinkProcessor: WikilinkTextProcessor;

    constructor(
        aiAdapter: AIAdapter,
        settingsService: SettingsService,
        public app: App,
        frontMatterGenerator: FrontMatterGenerator,
        wikilinkProcessor: WikilinkTextProcessor
    ) {
        super(aiAdapter, settingsService);
        this.frontMatterGenerator = frontMatterGenerator;
        this.wikilinkProcessor = wikilinkProcessor;
    }

    /**
     * Generate new notes from wikilinks in the source document
     * @param input The input parameters for generation
     * @returns Promise resolving to generated notes
     */
    public async generate(input: KnowledgeBloomInput): Promise<KnowledgeBloomOutput> {
        this.currentInput = input;
        console.log('🌸 KnowledgeBloomGenerator: Starting generation process');
        
        try {
            if (!this.validateInput(input)) {
                throw new Error('Invalid input for Knowledge Bloom generation');
            }

            // First, process and extract wikilinks
            const wikilinks = await this.extractWikilinks(input.sourceFile);
            console.log(`🌸 KnowledgeBloomGenerator: Found ${wikilinks.length} unique wikilinks`);

            if (wikilinks.length === 0) {
                throw new Error('No wikilinks found in the source file.');
            }

            // Setup output and process wikilinks
            const folderPath = this.getFolderPath(input.sourceFile);
            const output: KnowledgeBloomOutput = { generatedNotes: [] };

            // Process wikilinks concurrently with Promise.allSettled
            const generationPromises = wikilinks.map(link => 
                this.processWikilink(link, folderPath, input, output)
            );

            await Promise.allSettled(generationPromises);
            
            console.log(`🌸 KnowledgeBloomGenerator: Successfully generated ${output.generatedNotes.length} notes`);
            return output;
            
        } catch (error) {
            return this.handleError(error as Error);
        } finally {
            this.currentInput = null;
        }
    }

    /**
     * Extract and generate wikilinks from a file
     */
    public async extractWikilinks(file: TFile): Promise<string[]> {
        try {
            const content = await this.app.vault.read(file);
            console.log('🔍 KnowledgeBloomGenerator: Processing content for wikilinks');

            // First, process the content to generate wikilinks
            const existingWikilinks = new Set<string>();
            const suggestedLinks = await this.generateSuggestedLinks(content);
            
            // Use the processor to add wikilinks
            const processedContent = this.wikilinkProcessor.addWikilinks(
                content,
                suggestedLinks,
                existingWikilinks
            );

            // Extract the wikilinks using the processor's methods
            const links = this.wikilinkProcessor.extractExistingWikilinks(processedContent);
            console.log(`🔍 KnowledgeBloomGenerator: Found ${links.length} wikilinks`);
            
            // Update the source file with processed content
            await this.app.vault.modify(file, processedContent);
            
            return Array.from(new Set(links));
        } catch (error) {
            console.error('❌ Error extracting wikilinks:', error);
            throw new Error(`Failed to extract wikilinks: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Generate suggested links using AI
     */
    private async generateSuggestedLinks(content: string): Promise<string[]> {
        try {
            const prompt = `
Analyze the following content and identify key phrases, proper nouns, concepts, and terms that would make good wiki links. 
Focus on important concepts, technical terms, proper nouns, and significant phrases.
Return them as a simple array of strings.

Content:
${content}

Return ONLY the array of strings, nothing else.
`;
            
            const model = await this.getCurrentModel();
            const response = await this.aiAdapter.generateResponse(prompt, model);
            
            if (!response.success || !response.data) {
                throw new Error('Failed to generate suggested links');
            }

            // Parse the response to get an array of strings
            let suggestions: string[] = [];
            if (Array.isArray(response.data)) {
                suggestions = response.data.filter(item => typeof item === 'string');
            } else if (typeof response.data === 'object' && response.data !== null) {
                suggestions = Object.values(response.data)
                    .filter(item => typeof item === 'string');
            }

            console.log(`🎯 KnowledgeBloomGenerator: Generated ${suggestions.length} suggested links`);
            return suggestions;

        } catch (error) {
            console.error('❌ Error generating suggested links:', error);
            return [];
        }
    }

    /**
     * Process a single wikilink to generate a new note
     */
    public async processWikilink(
        link: string, 
        folderPath: string, 
        input: KnowledgeBloomInput, 
        output: KnowledgeBloomOutput
    ): Promise<void> {
        try {
            if (this.doesNoteExist(link, folderPath)) {
                console.log(`📝 KnowledgeBloomGenerator: Note for "${link}" already exists. Skipping.`);
                return;
            }

            // Generate the note content
            const markdownContent = await this.generateMarkdownContent(link, input);
            const finalContent = await this.addFrontMatter(markdownContent);

            // Create the new note
            const newFilePath = `${folderPath}/${link}.md`;
            await this.app.vault.create(newFilePath, finalContent);

            output.generatedNotes.push({ title: link, content: finalContent });
            console.log(`✨ KnowledgeBloomGenerator: Successfully generated note for "${link}".`);
        } catch (error) {
            console.error(`❌ Error processing wikilink "${link}":`, error);
            new Notice(`Failed to generate note for "${link}": ${(error as Error).message}`);
        }
    }

    /**
     * Generate markdown content for a single wikilink
     */
    public async generateMarkdownContent(link: string, input: KnowledgeBloomInput): Promise<string> {
        const prompt = this.preparePrompt({
            ...input,
            currentWikilink: link,
            currentNoteTitle: input.sourceFile.basename
        });

        const model = await this.getCurrentModel();
        const options: AIResponseOptions = { rawResponse: true };
        const response = await this.aiAdapter.generateResponse(prompt, model, options);

        if (!response.success || !response.data) {
            throw new Error(`Failed to generate content for "${link}": ${response.error || 'Unknown error'}`);
        }

        let content = response.data;
        
        // Handle different response types with proper type checking
        if (typeof content === 'object' && content !== null) {
            const contentObj = content as Record<string, unknown>;
            
            if ('content' in contentObj && typeof contentObj.content === 'string') {
                content = contentObj.content;
            } else if ('response' in contentObj && typeof contentObj.response === 'string') {
                content = contentObj.response;
            } else {
                content = JSON.stringify(content);
            }
        }

        // Clean the content
        const contentString = String(content).trim();
        return contentString.replace(/^---\n[\s\S]*?\n---\n*/g, '');
    }

    /**
     * Add front matter to the generated content
     */
    public async addFrontMatter(content: string): Promise<string> {
        const frontMatterInput: FrontMatterInput = {
            content,
            customProperties: this.extractCustomProperties(content),
            customTags: this.extractCustomTags(content)
        };

        const frontMatterResult = await this.frontMatterGenerator.generate(frontMatterInput);
        return frontMatterResult.content;
    }

    /**
     * Extract custom properties from content
     */
    protected extractCustomProperties(content: string): PropertyTag[] {
        try {
            return this.settingsService.getSettings().frontMatter.customProperties;
        } catch (error) {
            console.error('❌ Error extracting custom properties:', error);
            return [];
        }
    }

    /**
     * Extract custom tags from content
     */
    protected extractCustomTags(content: string): string[] {
        try {
            return this.settingsService.getSettings().tags.customTags.map(tag => tag.name);
        } catch (error) {
            console.error('❌ Error extracting custom tags:', error);
            return [];
        }
    }

    /**
     * Prepare the AI prompt for content generation
     */
    protected preparePrompt(input: KnowledgeBloomInput): string {
        if (!input.currentWikilink || !input.currentNoteTitle) {
            throw new Error('Missing required wikilink or note title');
        }

        return `
# MISSION
Act as an expert Research Assistant that specializes in writing structured notes that are accessible and practical based on a provided topic.

# GUIDELINES
- Write the note in Markdown format.
- Do NOT include any JSON objects or front matter.
- Ensure the content is well-structured and comprehensive.
- Include relevant wikilinks to other concepts where appropriate.
- Omit any words before or after the Markdown content.

# TOPIC
Write a detailed note about "${input.currentWikilink}" in relation to "${input.currentNoteTitle}".

${input.userPrompt ? `## Additional Context:\n${input.userPrompt}` : ''}
`;
    }

    /**
     * Check if a note exists at the given path
     */
    public doesNoteExist(title: string, folderPath: string): boolean {
        const filePath = `${folderPath}/${title}.md`;
        const file = this.app.vault.getAbstractFileByPath(filePath);
        return file instanceof TFile;
    }

    /**
     * Get the folder path for the new note
     */
    public getFolderPath(file: TFile): string {
        const pathSegments = file.path.split('/');
        pathSegments.pop();
        return pathSegments.join('/');
    }

    /**
     * Validate the input parameters
     */
    protected validateInput(input: KnowledgeBloomInput): boolean {
        const isValid = input?.sourceFile instanceof TFile;
        console.log(`🔍 KnowledgeBloomGenerator: Input validation result: ${isValid}`);
        return isValid;
    }

    /**
     * Get the current AI model
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
     * Handle generation errors
     */
    protected handleError(error: Error): never {
        console.error(`❌ KnowledgeBloomGenerator: Knowledge Bloom generation error: ${error.message}`, error);
        new Notice(`Knowledge Bloom generation failed: ${error.message}`);
        throw error;
    }

    /**
     * Format output (not used in this implementation)
     */
    protected formatOutput(_aiResponse: any, _originalInput: KnowledgeBloomInput): KnowledgeBloomOutput {
        throw new Error('Method not implemented - using custom generate method');
    }
}