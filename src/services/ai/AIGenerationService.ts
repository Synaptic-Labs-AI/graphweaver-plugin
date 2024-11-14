import { TFile } from 'obsidian';
import { GeneratorFactory, GeneratorType } from './GeneratorFactory';
import { OntologyInput, OntologyResult } from '../../models/OntologyTypes';
import { AIServiceError } from './AIServiceError';

/**
 * Handles all AI generation operations including front matter, wikilinks, 
 * knowledge bloom, and ontology generation
 */
export class AIGenerationService {
    constructor(
        private generatorFactory: GeneratorFactory
    ) {}

    /**
     * Generate front matter content
     */
    public async generateFrontMatter(content: string): Promise<string> {
        try {
            const generator = await this.generatorFactory.getGenerator(GeneratorType.FrontMatter);
            const result = await generator.generate({ content });
            return result.content;
        } catch (error) {
            throw new AIServiceError('Failed to generate front matter', error);
        }
    }

    /**
     * Generate wikilinks for content
     */
    public async generateWikilinks(content: string, existingPages: string[]): Promise<string> {
        try {
            const generator = await this.generatorFactory.getGenerator(GeneratorType.Wikilink);
            const result = await generator.generate({ content, existingPages });
            return result.content;
        } catch (error) {
            throw new AIServiceError('Failed to generate wikilinks', error);
        }
    }

    /**
     * Generate Knowledge Bloom content
     */
    public async generateKnowledgeBloom(sourceFile: TFile, userPrompt?: string): Promise<any> {
        try {
            const generator = await this.generatorFactory.getGenerator(GeneratorType.KnowledgeBloom);
            return await generator.generate({ sourceFile, userPrompt });
        } catch (error) {
            throw new AIServiceError('Failed to generate Knowledge Bloom', error);
        }
    }

    /**
     * Generate ontology
     */
    public async generateOntology(input: OntologyInput): Promise<OntologyResult> {
        try {
            const generator = await this.generatorFactory.getGenerator(GeneratorType.Ontology);
            return await generator.generate(input);
        } catch (error) {
            throw new AIServiceError('Failed to generate ontology', error);
        }
    }
}