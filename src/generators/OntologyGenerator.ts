// src/generators/OntologyGenerator.ts

import { BaseGenerator } from '@generators/BaseGenerator';
import { AIAdapter } from '@type/ai.types';
import { SettingsService } from '@services/SettingsService';
import { Tag } from '@type/metadata.types';
import { OntologyInput, OntologyResult } from '@type/component.types';

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

        try {
            const prompt = this.preparePrompt(input);
            const aiResponse = await this.aiAdapter.generateResponse(prompt, input.modelApiName);
            return this.formatOutput(aiResponse.data);
        } catch (error) {
            this.handleError(error as Error);
            throw error; // Ensure the error is re-thrown after handling
        }
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

**Files:**
${fileNames}

**Folders:** 
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
        let parsedResponse: any;

        // If aiResponse is a string, try to parse it as JSON
        if (typeof aiResponse === 'string') {
            try {
                // Attempt to fix incomplete JSON
                const fixedJson = this.fixIncompleteJson(aiResponse);
                parsedResponse = JSON.parse(fixedJson);
            } catch (error) {
                console.error('Failed to parse AI response as JSON:', error);
                throw new Error('Invalid AI response: unable to parse as JSON');
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
                        type: 'string',
                        required: false,
                        multipleValues: false
                    };
                }
                return null;
            })
            .filter((tag): tag is Tag => tag !== null);

        if (suggestedTags.length === 0) {
            throw new Error('No valid tags found in AI response');
        }

        // Return both tags and empty properties array to match OntologyResult interface
        return { 
            tags: suggestedTags,
            properties: [] 
        };
    }

    /**
     * Attempts to fix incomplete JSON strings.
     * @param json - Raw JSON string.
     * @returns Fixed JSON string.
     */
    public fixIncompleteJson(json: string): string {
        // Attempt to fix common JSON issues
        let fixedJson = json.trim();
        
        // If the JSON is cut off, try to close it properly
        if (!fixedJson.endsWith('}')) {
            fixedJson += '}}';
        }

        // Remove any trailing commas
        fixedJson = fixedJson.replace(/,\s*}$/, '}');

        return fixedJson;
    }

    /**
     * Validates the input parameters for ontology generation.
     * @param input - Input parameters.
     * @returns Boolean indicating validity.
     */
    protected validateInput(input: OntologyInput): boolean {
        return Array.isArray(input.files) && 
               Array.isArray(input.folders) && 
               Array.isArray(input.tags) &&
               typeof input.provider === 'string' &&
               typeof input.modelApiName === 'string' &&
               (!input.userContext || typeof input.userContext === 'string');
    }

    /**
     * Handles errors during ontology generation.
     * @param error - The error encountered.
     */
    protected handleError(error: Error): never {
        console.error(`Ontology generation error: ${error.message}`, error);
        throw new Error(`Ontology generation failed: ${error.message}`);
    }
}
