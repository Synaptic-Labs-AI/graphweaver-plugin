import { TFile, App, Notice } from 'obsidian';
import { BaseGenerator, BaseGeneratorInput, BaseGeneratorOutput } from './BaseGenerator';
import { AIResponseOptions } from '../models/AIModels';
import { SettingsService } from '../services/SettingsService';
import { FrontMatterGenerator, FrontMatterInput, FrontMatterOutput } from './FrontMatterGenerator';
import { PropertyTag } from '../models/PropertyTag';
import { AIAdapter } from 'src/adapters/AIAdapter';

/**
 * Input interface for the Knowledge Bloom generator
 */
export interface KnowledgeBloomInput extends BaseGeneratorInput {
    sourceFile: TFile;            
    userPrompt?: string;          
    template?: string;           // Add template parameter
    currentWikilink?: string;     
    currentNoteTitle?: string;    
}

/**
 * Output interface for the Knowledge Bloom generator
 */
export interface KnowledgeBloomOutput extends BaseGeneratorOutput {
    generatedNotes: { 
        title: string;            
        content: string;          
    }[];
}

/**
 * Generator class that creates new notes from wikilinks in a source document.
 * Extends BaseGenerator with specific input/output types for Knowledge Bloom functionality.
 */
export class KnowledgeBloomGenerator extends BaseGenerator<KnowledgeBloomInput, KnowledgeBloomOutput> {
    public frontMatterGenerator: FrontMatterGenerator;
    public currentInput: KnowledgeBloomInput | null = null;

    constructor(
        aiAdapter: AIAdapter,
        settingsService: SettingsService,
        public app: App,
        frontMatterGenerator: FrontMatterGenerator
    ) {
        super(aiAdapter, settingsService);
        this.frontMatterGenerator = frontMatterGenerator;
    }

    /**
     * Generate new notes from wikilinks in the source document
     * @param input The input parameters for generation
     * @returns Promise resolving to generated notes
     */
    public async generate(input: KnowledgeBloomInput): Promise<KnowledgeBloomOutput> {
        this.currentInput = input;
        console.log('KnowledgeBloomGenerator: Starting generation process');
        
        try {
            if (!this.validateInput(input)) {
                throw new Error('Invalid input for Knowledge Bloom generation');
            }

            const wikilinks = await this.extractWikilinks(input.sourceFile);
            console.log(`KnowledgeBloomGenerator: Found ${wikilinks.length} unique wikilinks`);

            if (wikilinks.length === 0) {
                throw new Error('No wikilinks found in the source file.');
            }

            const folderPath = this.getFolderPath(input.sourceFile);
            const output: KnowledgeBloomOutput = { generatedNotes: [] };

            const generationPromises = wikilinks.map(link => 
                this.processWikilink(link, folderPath, input, output)
            );

            await Promise.allSettled(generationPromises);
            return output;
            
        } catch (error) {
            return this.handleError(error as Error);
        } finally {
            this.currentInput = null;
        }
    }

    /**
     * Capitalize each word in a title
     */
    private capitalizeTitle(title: string): string {
        return title
            .split(/[\s-]/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    /**
     * Process a single wikilink to generate a new note
     */
    private async processWikilink(
        link: string, 
        folderPath: string, 
        input: KnowledgeBloomInput, 
        output: KnowledgeBloomOutput
    ): Promise<void> {
        try {
            const capitalizedLink = this.capitalizeTitle(link);
            
            if (this.doesNoteExist(capitalizedLink, folderPath)) {
                console.log(`KnowledgeBloomGenerator: Note for "${capitalizedLink}" already exists. Skipping.`);
                return;
            }

            // Generate the note content
            const markdownContent = await this.generateMarkdownContent(capitalizedLink, input);
            const finalContent = await this.addFrontMatter(markdownContent);

            // Create the new note using capitalized title
            const newFilePath = `${folderPath}/${capitalizedLink}.md`;
            await this.app.vault.create(newFilePath, finalContent);

            output.generatedNotes.push({ title: capitalizedLink, content: finalContent });
            console.log(`KnowledgeBloomGenerator: Successfully generated note for "${capitalizedLink}".`);
        } catch (error) {
            console.error(`Error processing wikilink "${link}":`, error);
            new Notice(`Failed to generate note for "${link}": ${(error as Error).message}`);
        }
    }

    /**
     * Generate markdown content for a single wikilink
     */
    private async generateMarkdownContent(link: string, input: KnowledgeBloomInput): Promise<string> {
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
            // Type assertion for accessing potential properties
            const contentObj = content as Record<string, unknown>;
            
            if ('content' in contentObj && typeof contentObj.content === 'string') {
                content = contentObj.content;
            } else if ('response' in contentObj && typeof contentObj.response === 'string') {
                content = contentObj.response;
            } else {
                content = JSON.stringify(content);
            }
        }

        // Ensure we have a string and clean it
        const contentString = String(content).trim();

        // Remove any accidentally included front matter
        return contentString.replace(/^---\n[\s\S]*?\n---\n*/g, '');
    }

    /**
     * Add front matter to the generated content
     */
    private async addFrontMatter(content: string): Promise<string> {
        const frontMatterInput: FrontMatterInput = {
            content,
            customProperties: this.extractCustomProperties(content),
            customTags: this.extractCustomTags(content)
        };

        const frontMatterResult = await this.frontMatterGenerator.generate(frontMatterInput);
        return frontMatterResult.content;
    }

    /**
     * Extract unique wikilinks from a file
     */
    private async extractWikilinks(file: TFile): Promise<string[]> {
        const content = await this.app.vault.read(file);
        const wikilinks = content.match(/\[\[([^\]]+)\]\]/g) || [];
        const links = wikilinks.map(link => link.slice(2, -2));
        return Array.from(new Set(links.map(link => link.toLowerCase())));
    }

    /**
     * Extract custom properties from content
     */
    protected extractCustomProperties(content: string): PropertyTag[] {
        try {
            return this.settingsService.getSettings().frontMatter.customProperties;
        } catch (error) {
            console.error('Error extracting custom properties:', error);
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
            console.error('Error extracting custom tags:', error);
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

        const basePrompt = input.template || `
# MISSION
Act as an expert Research Assistant that specializes in writing structured notes that are accessible and practical based on a provided topic.

# GUIDELINES
- Write the note in Markdown format.
- OMIT any JSON objects or front matter.
- Ensure the content is well-structured and comprehensive.
- OMIT any words before or after the Markdown content.
`;

        // Add relational context before the template content
        const relationContext = `
# CONTEXT
You are creating a new note about [[${input.currentWikilink}]] which was referenced in the note [[${input.currentNoteTitle}]].
Your task is to generate content that not only explains ${input.currentWikilink} but also considers its relationship to ${input.currentNoteTitle}.
`;

        // Combine all parts of the prompt
        const finalPrompt = `${relationContext}
${basePrompt}
${input.userPrompt ? `\n## Additional Context:\n${input.userPrompt}` : ''}`;

        return finalPrompt.trim();
    }

    /**
     * Check if a note exists at the given path
     */
    private doesNoteExist(title: string, folderPath: string): boolean {
        const filePath = `${folderPath}/${title}.md`;
        const file = this.app.vault.getAbstractFileByPath(filePath);
        return file instanceof TFile;
    }

    /**
     * Get the folder path for the new note
     */
    private getFolderPath(file: TFile): string {
        const pathSegments = file.path.split('/');
        pathSegments.pop();
        return pathSegments.join('/');
    }

    protected formatOutput(output: KnowledgeBloomOutput): KnowledgeBloomOutput {
        return output;
    }
}