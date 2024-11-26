// src/services/AIService.ts

import { App, TFile, TFolder, Notice } from "obsidian";
import { 
    AIProvider,  
    AIResponse, 
    AIModel, 
    AIModelMap 
} from '../models/AIModels';

// Import Adapters
import { AIAdapter } from "../adapters";
import { 
    OpenAIAdapter, 
    AnthropicAdapter, 
    GeminiAdapter, 
    GroqAdapter, 
    OpenRouterAdapter, 
    LMStudioAdapter, 
    PerplexityAdapter, 
    MistralAdapter 
} from '../adapters';

// Import Services
import { SettingsService } from "./SettingsService";
import { JsonValidationService } from "./JsonValidationService";
import { DatabaseService } from "./DatabaseService";

// Import Generators
import { FrontMatterGenerator, FrontMatterInput, FrontMatterOutput } from '../generators/FrontMatterGenerator';
import { WikilinkGenerator, WikilinkOutput } from '../generators/WikilinkGenerator';
import { OntologyGenerator, OntologyInput, OntologyResult } from '../generators/OntologyGenerator';
import { BatchProcessor, BatchProcessorOutput } from '../generators/BatchProcessor';
import { JsonSchemaGenerator } from '../generators/JsonSchemaGenerator';
import { KnowledgeBloomGenerator, KnowledgeBloomOutput } from '../generators/KnowledgeBloomGenerator';

// Import Models
import { Tag, PropertyTag } from '../models/PropertyTag';
import { PluginSettings } from '../settings/Settings';
import { BaseService } from './BaseService';

export class AIService extends BaseService {
    public adapters: Map<AIProvider, AIAdapter>;
    public databaseService: DatabaseService;
    
    // Declare generator properties
    public jsonSchemaGenerator: JsonSchemaGenerator;
    public frontMatterGenerator: FrontMatterGenerator;
    public wikilinkGenerator: WikilinkGenerator;
    public ontologyGenerator: OntologyGenerator;
    public batchProcessor: BatchProcessor;
    public knowledgeBloomGenerator: KnowledgeBloomGenerator;

    constructor(
        public app: App,
        public settingsService: SettingsService,
        public jsonValidationService: JsonValidationService,
        databaseService: DatabaseService
    ) {
        super();
        this.databaseService = databaseService;
        this.adapters = new Map<AIProvider, AIAdapter>();
        this.initializeAdapters();
        this.initializeGenerators();
    }

    /**
     * Initializes all AI adapters based on supported providers.
     */
    public initializeAdapters(): void {
        this.adapters = new Map<AIProvider, AIAdapter>([
            [AIProvider.OpenAI, new OpenAIAdapter(this.settingsService, this.jsonValidationService)],
            [AIProvider.Anthropic, new AnthropicAdapter(this.settingsService, this.jsonValidationService)],
            [AIProvider.Google, new GeminiAdapter(this.settingsService, this.jsonValidationService)],
            [AIProvider.Groq, new GroqAdapter(this.settingsService, this.jsonValidationService)],
            [AIProvider.OpenRouter, new OpenRouterAdapter(this.settingsService, this.jsonValidationService)],
            [AIProvider.LMStudio, new LMStudioAdapter(this.settingsService, this.jsonValidationService)],
            [AIProvider.Perplexity, new PerplexityAdapter(this.settingsService, this.jsonValidationService)] // Initialize PerplexityAdapter
        ]);
    }

    public getCurrentAdapter(): AIAdapter {
        const provider = this.getCurrentProvider();
        return this.getAdapterForProvider(provider);
    }

    /**
     * Initializes all generators required for AI operations.
     */
    public initializeGenerators(): void {
        const currentProvider = this.getCurrentProvider();
        const currentAdapter = this.getAdapterForProvider(currentProvider);

        // Initialize JsonSchemaGenerator
        this.jsonSchemaGenerator = new JsonSchemaGenerator(this.settingsService);

        // Initialize FrontMatterGenerator
        this.frontMatterGenerator = new FrontMatterGenerator(currentAdapter, this.settingsService, this.jsonSchemaGenerator);

        // Initialize other generators
        this.wikilinkGenerator = new WikilinkGenerator(currentAdapter, this.settingsService);
        this.ontologyGenerator = new OntologyGenerator(currentAdapter, this.settingsService);
        this.batchProcessor = new BatchProcessor(
            currentAdapter,
            this.settingsService,
            this.frontMatterGenerator,
            this.wikilinkGenerator,
            this.databaseService,
            this.app // Add this parameter
        );

        // Initialize KnowledgeBloomGenerator with FrontMatterGenerator
        this.knowledgeBloomGenerator = new KnowledgeBloomGenerator(
            currentAdapter, 
            this.settingsService, 
            this.app, 
            this.frontMatterGenerator // Pass FrontMatterGenerator here
        );
    }

    /**
     * Reinitializes adapters and generators. Useful after updating settings.
     */
    public reinitialize(): void {
        this.initializeAdapters();
        this.initializeGenerators();
    }

    /**
     * Retrieves the current AI provider selected in settings.
     */
    public getCurrentProvider(): AIProvider {
        return this.settingsService.getAIProviderSettings().selected;
    }

    /**
     * Retrieves the current model API name for a given provider.
     * @param provider - The AI provider.
     */
    public getCurrentModel(provider: AIProvider): string {
        const aiProviderSettings = this.settingsService.getAIProviderSettings();
        const modelApiName = aiProviderSettings.selectedModels[provider];
        if (!modelApiName) {
            throw new Error(`No model selected for provider: ${provider}`);
        }
        return modelApiName;
    }

    /**
     * Retrieves the default model API name based on the current provider.
     */
    public getDefaultModel(): string {
        const provider = this.getCurrentProvider();
        return this.getCurrentModel(provider);
    }

    /**
     * Sets the default model API name for the current provider.
     * @param modelApiName - The model API name to set as default.
     */
    public async setDefaultModel(modelApiName: string): Promise<void> {
        const provider = this.getCurrentProvider();
        const aiProviderSettings = this.settingsService.getAIProviderSettings();
        aiProviderSettings.selectedModels[provider] = modelApiName;
        await this.settingsService.updateAIProviderSettings(provider, { selectedModels: aiProviderSettings.selectedModels });
        this.reinitialize();
    }

    /**
     * Retrieves all available models for a given provider.
     * @param provider - The AI provider.
     */
    public getAvailableModels(provider: AIProvider): string[] {
        const adapter = this.getAdapterForProvider(provider);
        return adapter.getAvailableModels();
    }

    /**
     * Retrieves all supported AI providers.
     */
    public getSupportedProviders(): AIProvider[] {
        return Array.from(this.adapters.keys());
    }

    /**
     * Retrieves the adapter corresponding to a given provider.
     * @param provider - The AI provider.
     */
    public getAdapterForProvider(provider: AIProvider): AIAdapter {
        switch(provider) {
            case AIProvider.OpenAI:
                return new OpenAIAdapter(this.settingsService, this.jsonValidationService);
            case AIProvider.Anthropic:
                return new AnthropicAdapter(this.settingsService, this.jsonValidationService);
            case AIProvider.Google:
                return new GeminiAdapter(this.settingsService, this.jsonValidationService);
            case AIProvider.Groq:
                return new GroqAdapter(this.settingsService, this.jsonValidationService);
            case AIProvider.OpenRouter:
                return new OpenRouterAdapter(this.settingsService, this.jsonValidationService);
            case AIProvider.LMStudio:
                return new LMStudioAdapter(this.settingsService, this.jsonValidationService);
            case AIProvider.Perplexity:
                return new PerplexityAdapter(this.settingsService, this.jsonValidationService);
            case AIProvider.Mistral:
                return new MistralAdapter(this.settingsService, this.jsonValidationService);
            default:
                throw new Error(`No adapter found for provider: ${provider}`);
        }
    }

    /**
     * Validates the API key for a given provider.
     * @param provider - The AI provider.
     */
    public async validateApiKey(provider: AIProvider): Promise<boolean> {
        const adapter = this.getAdapterForProvider(provider);
        try {
            return await adapter.validateApiKey();
        } catch (error) {
            console.error(`Error validating API key for ${provider}:`, error);
            return false;
        }
    }

    /**
     * Updates plugin settings and reinitializes services.
     * @param newSettings - Partial plugin settings to update.
     */
    public async updateSettings(newSettings: Partial<PluginSettings>): Promise<void> {
        await this.settingsService.updateSettings(newSettings);
        this.reinitialize();
    }

    /**
     * Retrieves the root folder of the vault.
     */
    public getVaultRoot(): TFolder {
        return this.app.vault.getRoot();
    }

    /**
     * Retrieves a list of existing markdown pages in the vault.
     */
    public getExistingPages(): string[] {
        return this.app.vault.getMarkdownFiles().map(file => file.basename);
    }

    /**
     * Tests the connection to a given AI provider by validating the API key and making a test request.
     * @param provider - The AI provider to test.
     */
    public async testConnection(provider: AIProvider): Promise<boolean> {
        try {
            const adapter = this.getAdapterForProvider(provider);
            const modelApiName = this.getCurrentModel(provider);
            const testPrompt = "This is a test prompt. Please respond with the word 'OK'.";
            
            return await adapter.testConnection(testPrompt, modelApiName);
        } catch (error) {
            console.error(`Error testing connection to ${provider}:`, error);
            return false;
        }
    }

    /**
     * Generates a response from the AI based on the provided prompt.
     * @param prompt - The input prompt for the AI.
     */
    public async generateResponse(prompt: string): Promise<AIResponse> {
        const provider = this.getCurrentProvider();
        const modelApiName = this.getCurrentModel(provider);
        const adapter = this.getAdapterForProvider(provider);
        try {
            return await adapter.generateResponse(prompt, modelApiName);
        } catch (error) {
            console.error("Error generating response:", error);
            throw new Error(`Failed to generate response: ${(error as Error).message}`);
        }
    }

    /**
     * Retrieves a list of AI providers that have valid API keys set.
     */
    public getProvidersWithApiKeys(): AIProvider[] {
        const aiProviderSettings = this.settingsService.getAIProviderSettings();
        return Object.entries(aiProviderSettings.apiKeys)
            .filter(([_, apiKey]) => apiKey && apiKey.trim() !== '')
            .map(([provider, _]) => provider as AIProvider);
    }

    /**
     * Generates front matter content using AI.
     * @param content - The content for which to generate front matter.
     * @returns Promise<FrontMatterOutput> - The generated front matter result
     */
    public async generateFrontMatter(content: string): Promise<FrontMatterOutput> {
        try {
            const input: FrontMatterInput = { 
                content, 
                customProperties: this.extractCustomProperties(content),
                customTags: this.extractCustomTags(content)
            };
            return await this.frontMatterGenerator.generate(input);
        } catch (error) {
            console.error("Error generating front matter:", error);
            throw new Error(`Failed to generate front matter: ${(error as Error).message}`);
        }
    }

    /**
     * Generates wikilinks for the given content using AI.
     * @param content - The content for which to generate wikilinks.
     * @returns Promise<WikilinkOutput> - The generated wikilinks result
     */
    public async generateWikilinks(content: string): Promise<WikilinkOutput> {
        try {
            const existingPages = this.getExistingPages();
            return await this.wikilinkGenerator.generate({ 
                content, 
                existingPages 
            });
        } catch (error) {
            console.error("Error generating wikilinks:", error);
            throw new Error(`Failed to generate wikilinks: ${(error as Error).message}`);
        }
    }

    /**
     * Generates ontology based on the provided input.
     * @param input - The input parameters for ontology generation.
     * @returns The generated ontology result.
     */
    public async generateOntology(input: OntologyInput): Promise<OntologyResult> {
        try {
            const ontologyResult = await this.ontologyGenerator.generate(input);
            return ontologyResult;
        } catch (error) {
            console.error("Error generating ontology:", error);
            throw new Error(`Failed to generate ontology: ${(error as Error).message}`);
        }
    }

    /**
     * Updates tags based on the suggested tags.
     * @param suggestedTags - Array of suggested tags to update.
     */
    public async updateTags(suggestedTags: Tag[]): Promise<void> {
        try {
            // Assuming that tags are managed via SettingsService
            // Fetch current settings
            const settings = this.settingsService.getSettings();

            // Merge suggested tags with existing tags, avoiding duplicates
            const existingTagNames = new Set(settings.tags.customTags.map(tag => tag.name));
            const newTags = suggestedTags.filter(tag => !existingTagNames.has(tag.name));

            if (newTags.length === 0) {
                new Notice('No new tags to add.');
                return;
            }

            // Append new tags to existing tags
            settings.tags.customTags.push(...newTags);

            // Update settings
            await this.settingsService.updateSettings({ tags: settings.tags });

            new Notice(`Added ${newTags.length} new tags successfully!`);
        } catch (error) {
            console.error("Error updating tags:", error);
            throw new Error(`Failed to update tags: ${(error as Error).message}`);
        }
    }

    /**
     * Retrieves all available AI models across all providers.
     */
    public getAllAvailableModels(): { provider: AIProvider; model: AIModel }[] {
        const availableModels: { provider: AIProvider; model: AIModel }[] = [];

        for (const provider of Object.values(AIProvider)) {
            try {
                const adapter = this.getAdapterForProvider(provider);
                if (adapter.isReady()) {
                    const models = this.getAvailableModels(provider);
                    models.forEach(modelName => {
                        const model = this.getModelDetails(provider, modelName);
                        if (model) {
                            availableModels.push({ provider, model });
                        }
                    });
                }
            } catch (error) {
                console.warn(`Skipping provider ${provider} due to error:`, error);
            }
        }

        // Include local model if set up
        const localLMStudioSettings = this.settingsService.getSettings().localLMStudio;
        if (localLMStudioSettings.enabled && localLMStudioSettings.modelName) {
            availableModels.push({
                provider: AIProvider.LMStudio,
                model: { name: localLMStudioSettings.modelName, apiName: 'custom' }
            });
        }

        return availableModels;
    }

    /**
     * Retrieves model details based on provider and model name.
     * @param provider - The AI provider.
     * @param modelName - The name of the model.
     */
    public getModelDetails(provider: AIProvider, modelName: string): AIModel | undefined {
        const models = AIModelMap[provider];
        return models.find(model => model.apiName === modelName);
    }

    /**
     * Generates Knowledge Bloom content using AI.
     * @param sourceFile - The file containing wikilinks to generate notes for.
     * @param userPrompt - Optional user-provided context for note generation.
     * @param template - Optional template for note generation.
     * @returns Promise<KnowledgeBloomOutput> - The generated notes and metadata
     */
    public async generateKnowledgeBloom(
        sourceFile: TFile, 
        userPrompt?: string,
        template?: string
    ): Promise<KnowledgeBloomOutput> {
        return this.knowledgeBloomGenerator.generate({
            sourceFile,
            userPrompt,
            template
        });
    }
    
    /**
     * Extracts custom properties from content based on settings.
     * @param content - The content to extract properties from.
     * @returns Array of PropertyTag.
     */
    public extractCustomProperties(content: string): PropertyTag[] {
        const settings = this.settingsService.getSettings();
        // Extract properties based on your logic or settings
        return settings.frontMatter.customProperties;
    }

    /**
     * Extracts custom tags from content based on settings.
     * @param content - The content to extract tags from.
     * @returns Array of tag names.
     */
    public extractCustomTags(content: string): string[] {
        const settings = this.settingsService.getSettings();
        // Extract tags based on your logic or settings
        return settings.tags.customTags.map(tag => tag.name);
    }
}
