// src/services/AIService.ts

import { App, TFile, TFolder } from "obsidian";
import { 
    AIProvider, 
    AIAdapter, 
    AIResponse, 
    AIModel, 
    AIModelMap 
} from '../models/AIModels';
import { OpenAIAdapter } from "../adapters/OpenAIAdapter";
import { AnthropicAdapter } from "../adapters/AnthropicAdapter";
import { GeminiAdapter } from "../adapters/GeminiAdapter";
import { GroqAdapter } from "../adapters/GroqAdapter";
import { OpenRouterAdapter } from "../adapters/OpenRouterAdapter";
import { LMStudioAdapter } from "../adapters/LMStudioAdapter";
import { SettingsService } from "./SettingsService";
import { JsonValidationService } from "./JsonValidationService";

// Import Generators
import { FrontMatterGenerator } from '../generators/FrontMatterGenerator';
import { WikilinkGenerator } from '../generators/WikilinkGenerator';
import { OntologyGenerator, OntologyInput, OntologyResult } from '../generators/OntologyGenerator';
import { BatchProcessor, BatchProcessorResult } from '../generators/BatchProcessor';
import { JsonSchemaGenerator } from '../generators/JsonSchemaGenerator';

// Import Models
import { Tag } from '../models/PropertyTag';
import { PluginSettings } from '../models/Settings';

export class AIService {
    public adapters: Map<AIProvider, AIAdapter>;

    // Declare missing properties
    public frontMatterGenerator: FrontMatterGenerator;
    public wikilinkGenerator: WikilinkGenerator;
    public ontologyGenerator: OntologyGenerator;
    public batchProcessor: BatchProcessor;
    public jsonSchemaGenerator: JsonSchemaGenerator;

    constructor(
        public app: App,
        public settingsService: SettingsService,
        public jsonValidationService: JsonValidationService
    ) {
        this.initializeAdapters();
        this.initializeGenerators();
    }

    public initializeAdapters(): void {
        this.adapters = new Map<AIProvider, AIAdapter>([
            [AIProvider.OpenAI, new OpenAIAdapter(this.settingsService, this.jsonValidationService)],
            [AIProvider.Anthropic, new AnthropicAdapter(this.settingsService, this.jsonValidationService)],
            [AIProvider.Google, new GeminiAdapter(this.settingsService, this.jsonValidationService)],
            [AIProvider.Groq, new GroqAdapter(this.settingsService, this.jsonValidationService)],
            [AIProvider.OpenRouter, new OpenRouterAdapter(this.settingsService, this.jsonValidationService)],
            [AIProvider.LMStudio, new LMStudioAdapter(this.settingsService, this.jsonValidationService)]
        ]);
    }

    /**
     * Initializes all generators required for AI operations.
     */
    public initializeGenerators(): void {
        const currentProvider = this.getCurrentProvider();
        const currentAdapter = this.getAdapterForProvider(currentProvider);

        // Initialize JSON Schema Generator
        this.jsonSchemaGenerator = new JsonSchemaGenerator(this.settingsService);

        // Initialize other generators
        this.frontMatterGenerator = new FrontMatterGenerator(currentAdapter, this.settingsService, this.jsonSchemaGenerator);
        this.wikilinkGenerator = new WikilinkGenerator(currentAdapter, this.settingsService);
        this.ontologyGenerator = new OntologyGenerator(currentAdapter, this.settingsService);
        this.batchProcessor = new BatchProcessor(
            currentAdapter, 
            this.settingsService, 
            this.frontMatterGenerator, 
            this.wikilinkGenerator, 
            this.app
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
        const adapter = this.adapters.get(provider);
        if (!adapter) {
            throw new Error(`No adapter found for provider: ${provider}`);
        }
        return adapter;
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
     * Generates front matter for the given content.
     * @param content - The content for which to generate front matter.
     */
    public async generateFrontMatter(content: string): Promise<string> {
        try {
            return await this.frontMatterGenerator.generate(content);
        } catch (error) {
            console.error("Error generating front matter:", error);
            throw new Error(`Failed to generate front matter: ${(error as Error).message}`);
        }
    }

    /**
     * Generates wikilinks for the given content.
     * @param content - The content for which to generate wikilinks.
     */
    public async generateWikilinks(content: string): Promise<string> {
        const existingPages = this.getExistingPages();
        try {
            return await this.wikilinkGenerator.generate({ content, existingPages });
        } catch (error) {
            console.error("Error generating wikilinks:", error);
            throw new Error(`Failed to generate wikilinks: ${(error as Error).message}`);
        }
    }

    /**
     * Generates an ontology based on the provided input.
     * @param input - The input parameters for ontology generation.
     */
    public async generateOntology(input: OntologyInput): Promise<OntologyResult> {
        try {
            const adapter = this.getAdapterForProvider(input.provider);
            const generator = new OntologyGenerator(adapter, this.settingsService);
            return await generator.generate(input);
        } catch (error) {
            console.error("Error generating ontology:", error);
            throw new Error(`Failed to generate ontology: ${(error as Error).message}`);
        }
    }

    /**
     * Updates tags based on suggested tags.
     * @param suggestedTags - An array of suggested tags with name and description.
     */
    public async updateTags(suggestedTags: { name: string; description: string }[]): Promise<void> {
        try {
            const newTags: Tag[] = suggestedTags.map(tag => ({
                name: tag.name,
                description: tag.description,
                type: 'string',
                required: false,
                multipleValues: false
            }));

            await this.settingsService.updateTags(newTags);
        } catch (error) {
            console.error("Error updating tags:", error);
            throw new Error(`Failed to update tags: ${(error as Error).message}`);
        }
    }
    
    /**
     * Processes a batch of files based on the provided options.
     * @param files - An array of files to process.
     * @param options - Options specifying which generators to run.
     */
    public async batchProcess(
        files: TFile[], 
        options: { generateFrontMatter: boolean, generateWikilinks: boolean }
    ): Promise<BatchProcessorResult> {
        try {
            return await this.batchProcessor.generate({ files, ...options });
        } catch (error) {
            console.error("Error in batch processing:", error);
            throw new Error(`Batch processing failed: ${(error as Error).message}`);
        }
    }

    /**
     * Retrieves all available AI models across all providers.
     */
    public getAllAvailableModels(): { provider: AIProvider; model: AIModel }[] {
        const availableModels: { provider: AIProvider; model: AIModel }[] = [];

        for (const provider of Object.values(AIProvider)) {
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
        }

        // Include local model if set up
        const localLMStudioSettings = this.settingsService.getLocalLMStudioSettings();
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
}
