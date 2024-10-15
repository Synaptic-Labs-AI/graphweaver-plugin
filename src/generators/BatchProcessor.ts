import { BaseGenerator } from './BaseGenerator';
import { AIAdapter } from '../adapters/AIAdapter';
import { SettingsService } from '../services/SettingsService';
import { FrontMatterGenerator } from './FrontMatterGenerator';
import { WikilinkGenerator } from './WikilinkGenerator';
import { App, TFile } from 'obsidian';

export interface BatchProcessorResult {
    fileResults: {
        file: TFile;
        success: boolean;
        error?: string;
        frontMatterGenerated: boolean;
        wikilinksGenerated: boolean;
    }[];
}

interface BatchProcessorInput {
    files: TFile[];
    generateFrontMatter: boolean;
    generateWikilinks: boolean;
}

export class BatchProcessor extends BaseGenerator {
    public frontMatterGenerator: FrontMatterGenerator;
    public wikilinkGenerator: WikilinkGenerator;
    public app: App;

    constructor(
        aiAdapter: AIAdapter, 
        settingsService: SettingsService,
        frontMatterGenerator: FrontMatterGenerator,
        wikilinkGenerator: WikilinkGenerator,
        app: App
    ) {
        super(aiAdapter, settingsService);
        this.frontMatterGenerator = frontMatterGenerator;
        this.wikilinkGenerator = wikilinkGenerator;
        this.app = app;
        console.log('BatchProcessor: Initialized with:', 
            {
                aiAdapter: aiAdapter.constructor.name,
                settingsService: settingsService.constructor.name,
                frontMatterGenerator: frontMatterGenerator.constructor.name,
                wikilinkGenerator: wikilinkGenerator.constructor.name
            }
        );
    }

    public async generate(input: BatchProcessorInput): Promise<BatchProcessorResult> {
        console.log('BatchProcessor: Starting batch processing with input:', input);
        if (!this.validateInput(input)) {
            console.error('BatchProcessor: Invalid input for batch processing');
            throw new Error('Invalid input for batch processing');
        }
    
        const results: BatchProcessorResult = { fileResults: [] };
    
        for (const file of input.files) {
            console.log(`BatchProcessor: Processing file: ${file.path}`);
            let content = await this.app.vault.read(file);
            console.log(`BatchProcessor: Original content length: ${content.length}`);
            let frontMatterGenerated = false;
            let wikilinksGenerated = false;
    
            try {
                if (input.generateFrontMatter) {
                    console.log('BatchProcessor: Attempting to generate front matter');
                    console.log('BatchProcessor: FrontMatterGenerator instance:', this.frontMatterGenerator);
                    const frontMatterResult = await this.frontMatterGenerator.generate(content);
                    console.log('BatchProcessor: Front matter generation result length:', frontMatterResult.length);
                    if (frontMatterResult !== content) {
                        content = frontMatterResult;
                        frontMatterGenerated = true;
                        console.log('BatchProcessor: Front matter successfully generated');
                    } else {
                        console.log('BatchProcessor: No new front matter generated');
                    }
                } else {
                    console.log('BatchProcessor: Front matter generation skipped');
                }
    
                if (input.generateWikilinks) {
                    console.log('BatchProcessor: Generating wikilinks');
                    const existingPages = this.getExistingPages();
                    const wikilinksResult = await this.wikilinkGenerator.generate({ content, existingPages });
                    console.log('BatchProcessor: Wikilinks generation result length:', wikilinksResult.length);
                    if (wikilinksResult !== content) {
                        content = wikilinksResult;
                        wikilinksGenerated = true;
                        console.log('BatchProcessor: Wikilinks successfully generated');
                    } else {
                        console.log('BatchProcessor: No new wikilinks generated');
                    }
                } else {
                    console.log('BatchProcessor: Wikilinks generation skipped');
                }
    
                console.log('BatchProcessor: Modifying file');
                await this.app.vault.modify(file, content);
    
                results.fileResults.push({ 
                    file, 
                    success: true, 
                    frontMatterGenerated, 
                    wikilinksGenerated 
                });
                console.log(`BatchProcessor: File processed successfully. Front matter generated: ${frontMatterGenerated}, Wikilinks generated: ${wikilinksGenerated}`);
            } catch (error) {
                console.error(`BatchProcessor: Error processing file ${file.path}:`, error);
                results.fileResults.push({ 
                    file, 
                    success: false, 
                    error: error.message, 
                    frontMatterGenerated, 
                    wikilinksGenerated 
                });
            }
        }
    
        console.log('BatchProcessor: Batch processing completed. Results:', results);
        return results;
    }

    protected validateInput(input: BatchProcessorInput): boolean {
        const isValid = Array.isArray(input.files) && 
               input.files.length > 0 && 
               typeof input.generateFrontMatter === 'boolean' &&
               typeof input.generateWikilinks === 'boolean';
        console.log('BatchProcessor: Input validation result:', isValid);
        return isValid;
    }

    public getExistingPages(): string[] {
        const pages = this.app.vault.getMarkdownFiles().map(file => file.basename);
        console.log('BatchProcessor: Existing pages:', pages);
        return pages;
    }

    // Implement the abstract methods from BaseGenerator
    protected preparePrompt(input: BatchProcessorInput): string {
        console.log('BatchProcessor: preparePrompt called, but not used in this class');
        return '';
    }

    protected formatOutput(aiResponse: any): any {
        console.log('BatchProcessor: formatOutput called, but not used in this class');
        return aiResponse;
    }
}