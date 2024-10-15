import { BaseGenerator } from './BaseGenerator';
import { AIAdapter } from '../adapters/AIAdapter';
import { SettingsService } from '../services/SettingsService';
import { TFile, TFolder } from 'obsidian';

export interface OntologyResult {
    suggestedTags: {
        name: string;
        description: string;
    }[];
}

interface OntologyInput {
    files: TFile[];
    folders: TFolder[];
    tags: string[];
}

export class OntologyGenerator extends BaseGenerator {
    constructor(aiAdapter: AIAdapter, settingsService: SettingsService) {
        super(aiAdapter, settingsService);
    }

    public async generate(input: OntologyInput): Promise<OntologyResult> {
        if (!this.validateInput(input)) {
            throw new Error('Invalid input for ontology generation');
        }

        try {
            const prompt = this.preparePrompt(input);
            const aiResponse = await this.aiAdapter.generateResponse(prompt, this.getCurrentModel());
            return this.formatOutput(aiResponse.data);
        } catch (error) {
            this.handleError(error);
        }
    }

    protected preparePrompt(input: OntologyInput): string {
        const fileNames = input.files.map(file => file.basename).join(', ');
        const folderNames = input.folders.map(folder => folder.name).join(', ');
        const tags = input.tags.join(', ');

        return `
            Analyze the following information about a knowledge base and synthesize an ontology.
            Based on the overall structure and content, suggest a set of tags that would create a cohesive and useful ontology for this knowledge base.

            Files: ${fileNames}
            Folders: ${folderNames}
            Existing Tags: ${tags}

            For each suggested tag in the ontology, provide:
            {
                "Name": {
                    "description": "a brief but robust instruction on what this tag represents"
                }
            }

            Consider the following when creating the ontology:
            1. Identify overarching themes and concepts present in the knowledge base.
            2. Suggest tags that would help categorize and connect information across different files and folders.
            3. Build upon existing tags, either by refining them or suggesting complementary tags.
            4. Aim for a balance between specificity and generality in the suggested tags.
            5. Consider the hierarchical structure implied by the folder organization.

            Provide your response as a JSON object where the keys are the tag names and the values are objects containing the description.
            Aim to suggest between 10 to 20 tags that would form a comprehensive ontology for this knowledge base.
        `;
    }

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
    
        const suggestedTags = Object.entries(parsedResponse)
            .map(([name, value]): { name: string; description: string } | null => {
                if (typeof value === 'object' && value !== null && 'description' in value) {
                    return {
                        name: String(name).trim(),
                        description: String((value as any).description).trim()
                    };
                } else {
                    console.warn(`Unexpected format for tag ${name}:`, value);
                    return null;
                }
            })
            .filter((tag): tag is { name: string; description: string } => 
                tag !== null && typeof tag.name === 'string' && tag.name.length > 0 && 
                typeof tag.description === 'string' && tag.description.length > 0
            );
    
        if (suggestedTags.length === 0) {
            throw new Error('No valid tags found in AI response');
        }
    
        return { suggestedTags };
    }

    private fixIncompleteJson(json: string): string {
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

    protected validateInput(input: OntologyInput): boolean {
        return Array.isArray(input.files) && 
               Array.isArray(input.folders) && 
               Array.isArray(input.tags);
    }

    public getCurrentModel(): string {
        const settings = this.settingsService.getSettings();
        const providerType = this.aiAdapter.getProviderType();
        const selectedModel = settings.aiProvider?.selectedModels?.[providerType];

        if (!selectedModel) {
            throw new Error(`No model selected for provider type: ${providerType}`);
        }

        return selectedModel;
    }

    protected handleError(error: Error): never {
        console.error(`Ontology generation error: ${error.message}`, error);
        throw new Error(`Ontology generation failed: ${error.message}`);
    }
}