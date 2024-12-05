// src/generators/OntologyGenerator.ts

import { BaseGenerator } from './BaseGenerator';
import { AIAdapter } from '../adapters/AIAdapter';
import { SettingsService } from '../services/SettingsService';
import { TFile, TFolder } from 'obsidian';
import { AIProvider } from '../models/AIModels';
import { Tag } from '../models/PropertyTag';

/**
 * Input interface for ontology generation.
 */
export interface OntologyInput {
    files: TFile[];
    folders: TFolder[];
    tags: string[];
    provider: AIProvider;
    modelApiName: string;
    userContext?: string;
}

/**
 * Output interface for ontology generation.
 */
export interface OntologyResult {
    suggestedTags: Tag[];
}

/**
 * Generator class responsible for creating ontologies based on provided input.
 */
export class OntologyGenerator extends BaseGenerator<OntologyInput, OntologyResult> {
    constructor(aiAdapter: AIAdapter, settingsService: SettingsService) {
        super(aiAdapter, settingsService);
    }

    /**
     * Main method to generate ontology.
     * @param input - Input parameters for ontology generation.
     * @returns Promise resolving to the generated ontology.
     */
    public async generate(input: OntologyInput): Promise<OntologyResult> {
        if (!this.validateInput(input)) {
            throw new Error('Invalid input for ontology generation');
        }

        // Process each category independently and in parallel
        const [fileTags, folderTags, existingTags] = await Promise.all([
            this.processFilesInChunks(input.files, input.modelApiName),
            this.processFoldersInChunks(input.folders, input.modelApiName),
            this.processExistingTagsInChunks(input.tags, input.modelApiName)
        ]);

        // Combine and deduplicate all tags
        const combinedTags = this.combineTags([fileTags, folderTags, existingTags]);
        
        return { suggestedTags: combinedTags };
    }

    /**
     * Generates ontology in chunks to handle large vaults
     */
    public async generateChunked(input: OntologyInput): Promise<OntologyResult> {
        if (!this.validateInput(input)) {
            throw new Error('Invalid input for ontology generation');
        }

        const model = this.aiAdapter.getModels().find(m => m.apiName === input.modelApiName);
        if (!model?.capabilities?.contextWindow) {
            return this.generate(input); // Fallback to regular generation if no context window info
        }

        try {
            // Process each data type separately
            const [fileTags, folderTags, existingTags] = await Promise.all([
                this.processFiles(input.files, input.modelApiName, model.capabilities.contextWindow),
                this.processFolders(input.folders, input.modelApiName),
                this.processExistingTags(input.tags, input.modelApiName)
            ]);

            // Combine and deduplicate results
            const combinedTags = this.combineTags([fileTags, folderTags, existingTags]);

            return { suggestedTags: combinedTags };
        } catch (error) {
            console.error('Error in chunked generation:', error);
            throw new Error(`Chunked generation failed: ${error.message}`);
        }
    }

    protected async processFilesInChunks(files: TFile[], modelApiName: string): Promise<Tag[]> {
        const model = this.aiAdapter.getModels().find(m => m.apiName === modelApiName);
        const chunkSize = this.calculateChunkSize(model?.capabilities?.contextWindow || 4000);
        const chunks = this.chunkArray(files, chunkSize);
        const results = await Promise.all(chunks.map(chunk => {
            const prompt = this.prepareChunkPrompt('files', chunk.map(f => f.basename));
            return this.processChunk(prompt, modelApiName);
        }));
        return this.mergeTags(results.flat());
    }

    protected async processFoldersInChunks(folders: TFolder[], modelApiName: string): Promise<Tag[]> {
        const model = this.aiAdapter.getModels().find(m => m.apiName === modelApiName);
        const chunkSize = this.calculateChunkSize(model?.capabilities?.contextWindow || 4000);
        const chunks = this.chunkArray(folders, chunkSize);
        const results = await Promise.all(chunks.map(chunk => {
            const prompt = this.prepareChunkPrompt('folders', chunk.map(f => f.name));
            return this.processChunk(prompt, modelApiName);
        }));
        return this.mergeTags(results.flat());
    }

    protected async processExistingTagsInChunks(tags: string[], modelApiName: string): Promise<Tag[]> {
        const model = this.aiAdapter.getModels().find(m => m.apiName === modelApiName);
        const chunkSize = this.calculateChunkSize(model?.capabilities?.contextWindow || 4000);
        const chunks = this.chunkArray(tags, chunkSize);
        const results = await Promise.all(chunks.map(chunk => {
            const prompt = this.prepareChunkPrompt('tags', chunk);
            return this.processChunk(prompt, modelApiName);
        }));
        return this.mergeTags(results.flat());
    }

    protected async processChunk(prompt: string, modelApiName: string): Promise<Tag[]> {
        const response = await this.aiAdapter.generateResponse(prompt, modelApiName);
        if (!response.success || !response.data) {
            console.warn('Failed to process chunk:', response.error);
            return [];
        }
        return this.formatOutput(response.data).suggestedTags;
    }

    protected async processFiles(files: TFile[], modelApiName: string, contextWindow: number): Promise<Tag[]> {
        console.debug(`Processing ${files.length} files with context window ${contextWindow}`);
        const chunkSize = this.calculateChunkSize(contextWindow);
        const chunks = this.chunkArray(files, chunkSize);
        console.debug(`Split into ${chunks.length} chunks of size ${chunkSize}`);

        const results: Tag[][] = [];
        
        for (let i = 0; i < chunks.length; i++) {
            console.debug(`Processing chunk ${i + 1}/${chunks.length} with ${chunks[i].length} files`);
            const prompt = this.prepareChunkPrompt('files', chunks[i].map(f => f.basename));
            const response = await this.aiAdapter.generateResponse(prompt, modelApiName);
            
            if (response.success && response.data) {
                const chunkTags = this.formatOutput(response.data).suggestedTags;
                console.debug(`Chunk ${i + 1} generated ${chunkTags.length} tags`);
                results.push(chunkTags);
            }
        }

        return this.mergeTags(results.flat());
    }

    protected async processFolders(folders: TFolder[], modelApiName: string): Promise<Tag[]> {
        const model = this.aiAdapter.getModels().find(m => m.apiName === modelApiName);
        if (!model?.capabilities?.contextWindow) {
            return this.processSingle(folders, 'folders', modelApiName);
        }

        const chunkSize = this.calculateChunkSize(model.capabilities.contextWindow);
        const chunks = this.chunkArray(folders, chunkSize);
        const results = await Promise.all(
            chunks.map(chunk => this.processSingle(chunk, 'folders', modelApiName))
        );

        return this.mergeTags(results.flat());
    }

    protected async processExistingTags(tags: string[], modelApiName: string): Promise<Tag[]> {
        const model = this.aiAdapter.getModels().find(m => m.apiName === modelApiName);
        if (!model?.capabilities?.contextWindow) {
            return this.processSingle(tags, 'tags', modelApiName);
        }

        const chunkSize = this.calculateChunkSize(model.capabilities.contextWindow);
        const chunks = this.chunkArray(tags, chunkSize);
        const results = await Promise.all(
            chunks.map(chunk => this.processSingle(chunk, 'tags', modelApiName))
        );

        return this.mergeTags(results.flat());
    }

    protected async processSingle(items: any[], type: 'files' | 'folders' | 'tags', modelApiName: string): Promise<Tag[]> {
        const prompt = this.prepareChunkPrompt(type, items.map(item => 
            type === 'files' ? item.basename : 
            type === 'folders' ? item.name : 
            item
        ));
        
        const response = await this.aiAdapter.generateResponse(prompt, modelApiName);
        return response.success ? this.formatOutput(response.data).suggestedTags : [];
    }

    protected prepareChunkPrompt(type: 'files' | 'folders' | 'tags', items: string[]): string {
        return `
# MISSION
Analyze these ${type} and suggest tags for an Obsidian vault ontology.
Create tags that connect and categorize the information effectively.

**${type.charAt(0).toUpperCase() + type.slice(1)}:**
${items.join(', ')}

Provide a JSON response with suggested tags:
{
    "TagName": {
        "description": "what this tag represents and when to use it"
    }
}

Guidelines:
1. Identify key themes and concepts
2. Remove spaces from tag names (use CamelCase)
3. Be specific but not too granular
4. Consider hierarchical relationships
5. Build upon patterns in the ${type}
`;
    }

    protected combineTags(tagSets: Tag[][]): Tag[] {
        const tagMap = new Map<string, Tag>();

        // Merge all tags, keeping the most detailed description
        for (const tags of tagSets) {
            for (const tag of tags) {
                const existing = tagMap.get(tag.name);
                if (!existing || tag.description.length > existing.description.length) {
                    tagMap.set(tag.name, tag);
                }
            }
        }

        return Array.from(tagMap.values());
    }

    protected calculateChunkSize(contextWindow: number): number {
        const WORDS_PER_TOKEN = 0.75; // Conservative estimate: 1 token = 3/4 of a word
        const AVG_WORDS_PER_ITEM = 3;  // Conservative estimate for file/folder/tag names
        const PROMPT_OVERHEAD = 500;    // Tokens reserved for prompt template and system message
        const RESPONSE_RESERVE = 2000;  // Tokens reserved for model response
        
        // Calculate available tokens for content
        const availableTokens = contextWindow - PROMPT_OVERHEAD - RESPONSE_RESERVE;
        
        // Convert tokens to number of items
        const maxWordsPerChunk = availableTokens * WORDS_PER_TOKEN;
        const itemsPerChunk = Math.floor(maxWordsPerChunk / AVG_WORDS_PER_ITEM);
        
        // Set a reasonable minimum and maximum
        return Math.max(10, Math.min(itemsPerChunk, 1000));
    }

    protected chunkArray<T>(array: T[], chunkSize: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }

    protected mergeTags(tags: Tag[]): Tag[] {
        const merged = new Map<string, Tag>();
        for (const tag of tags) {
            if (!merged.has(tag.name)) {
                merged.set(tag.name, tag);
            }
        }
        return Array.from(merged.values());
    }

    /**
     * Prepares the AI prompt based on the input.
     * @param input - Input parameters for ontology generation.
     * @returns Formatted prompt string.
     */
    protected preparePrompt(input: OntologyInput): string {
        const fileNames = input.files.map(file => file.basename).join(', ');
        const folderNames = input.folders.map(folder => folder.name).join(', ');
        const tags = input.tags.join(', ');

        return `
# MISSION
Act as an expert in Ontological Science, specializing in taking unstructured information from an Obsidian vault, and creating tags to create a means of connecting the information.
Analyze the following information about a knowledge base and synthesize an ontology.
Based on the overall structure and content, suggest a set of tags that would create a cohesive and useful ontology for this knowledge base.

**File Names:**
${fileNames}

**Folder Names:** 
${folderNames}

**Existing Tags:** 
${tags}

${input.userContext ? `**Additional Context:** ${input.userContext}` : ''}

For each suggested tag in the ontology, provide:
{
    "Name": {
        "description": "a brief but robust instruction on what this tag represents, and when it should be applied",
    }
}

Consider the following when creating the ontology:
1. Identify overarching themes and concepts present in the knowledge base.
2. Suggest tags that would help categorize and connect information across different files and folders.
3. Build upon existing tags, either by refining them or suggesting complementary tags.
4. Aim for a balance between specificity and generality in the suggested tags.
5. Consider the hierarchical structure implied by the folder organization.
6. Omit all spaces from tags names (e.g. AlbertEinstein instead of Albert Einstein)

Provide your response as a JSON object where the keys are the tag names and the values are objects containing the description.
Suggest enough tags to form a comprehensive ontology for this knowledge base.
        `;
    }

    /**
     * Formats the AI response into the OntologyResult structure.
     * @param aiResponse - Raw AI response data.
     * @returns OntologyResult containing suggested tags.
     */
    protected formatOutput(aiResponse: any): OntologyResult {
        console.debug('Raw AI response:', aiResponse); // Debug log

        let parsedResponse: any;

        // If aiResponse is a string, try to parse it as JSON
        if (typeof aiResponse === 'string') {
            try {
                // Try to extract JSON from the string if it's wrapped in text
                const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
                const jsonStr = jsonMatch ? jsonMatch[0] : aiResponse;
                const fixedJson = this.fixIncompleteJson(jsonStr);
                parsedResponse = JSON.parse(fixedJson);
            } catch (error) {
                console.error('Failed to parse AI response as JSON:', error);
                // Attempt to create a simple tag structure if JSON parsing fails
                parsedResponse = {
                    "DefaultTag": {
                        "description": "Automatically created tag from unstructured response",
                        "type": "string"
                    }
                };
            }
        } else if (typeof aiResponse === 'object' && aiResponse !== null) {
            parsedResponse = aiResponse;
        } else {
            console.error('Unexpected AI response format:', aiResponse);
            throw new Error('Invalid AI response format: expected an object or valid JSON string');
        }

        if (typeof parsedResponse !== 'object' || parsedResponse === null) {
            throw new Error('Invalid AI response format: expected an object after parsing');
        }

        const suggestedTags: Tag[] = Object.entries(parsedResponse)
            .map(([name, value]): Tag | null => {
                if (typeof value === 'object' && value !== null && 'description' in value) {
                    return {
                        name: String(name).trim(),
                        description: String((value as any).description).trim(),
                        type: (value as any).type || 'string', // Default to 'string' if type not provided
                    };
                } else {
                    console.warn(`Unexpected format for tag ${name}:`, value);
                    return null;
                }
            })
            .filter((tag): tag is Tag => 
                tag !== null && typeof tag.name === 'string' && tag.name.length > 0 && 
                typeof tag.description === 'string' && tag.description.length > 0 &&
                typeof tag.type === 'string'
            );

        if (suggestedTags.length === 0) {
            throw new Error('No valid tags found in AI response');
        }

        return { suggestedTags };
    }

    /**
     * Attempts to fix incomplete JSON strings.
     * @param json - Raw JSON string.
     * @returns Fixed JSON string.
     */
    protected fixIncompleteJson(json: string): string {
        let fixedJson = json.trim();
        
        // Remove any leading or trailing non-JSON text
        const startBrace = fixedJson.indexOf('{');
        const endBrace = fixedJson.lastIndexOf('}');
        
        if (startBrace !== -1 && endBrace !== -1) {
            fixedJson = fixedJson.substring(startBrace, endBrace + 1);
        }

        // Fix trailing commas
        fixedJson = fixedJson.replace(/,(\s*[}\]])/g, '$1');
        
        // Add missing closing braces if needed
        const openBraces = (fixedJson.match(/\{/g) || []).length;
        const closeBraces = (fixedJson.match(/\}/g) || []).length;
        
        if (openBraces > closeBraces) {
            fixedJson += '}'.repeat(openBraces - closeBraces);
        }

        return fixedJson;
    }
}
