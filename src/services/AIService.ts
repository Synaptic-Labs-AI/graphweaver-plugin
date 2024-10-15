// src/services/AIService.ts

import { App, TFolder, TFile } from "obsidian";
import { AIProvider, AIResponse, AIAdapter } from "../models/AIModels";
import { OpenAIAdapter } from "../adapters/OpenAIAdapter";
import { AnthropicAdapter } from "../adapters/AnthropicAdapter";
import { GeminiAdapter } from "../adapters/GeminiAdapter";
import { GroqAdapter } from "../adapters/GroqAdapter";
import { OpenRouterAdapter } from "../adapters/OpenRouterAdapter";
import { LMStudioAdapter } from "../adapters/LMStudioAdapter";
import { SettingsService } from "./SettingsService";
import { FrontMatterGenerator } from "../generators/FrontMatterGenerator";
import { WikilinkGenerator } from "../generators/WikilinkGenerator";
import { OntologyGenerator, OntologyResult } from "../generators/OntologyGenerator";
import { BatchProcessor, BatchProcessorResult } from "../generators/BatchProcessor";
import { JsonSchemaGenerator } from "../generators/JsonSchemaGenerator";
import { PluginSettings } from "../models/Settings";
import { Tag } from "../models/PropertyTag";

export class AIService {
    public adapters: Map<AIProvider, AIAdapter>;
    public jsonSchemaGenerator: JsonSchemaGenerator;
    public frontMatterGenerator: FrontMatterGenerator;
    public wikilinkGenerator: WikilinkGenerator;
    public ontologyGenerator: OntologyGenerator;
    public batchProcessor: BatchProcessor;

    constructor(
        public app: App,
        public settingsService: SettingsService
    ) {
        this.jsonSchemaGenerator = new JsonSchemaGenerator(settingsService);
        this.initializeAdapters();
        this.initializeGenerators();
    }

    /**
     * Reinitializes adapters and generators, typically after settings change.
     */
    public reinitialize(): void {
        this.initializeAdapters();
        this.initializeGenerators();
    }

    /**
     * Initializes all AI adapters based on available providers.
     */
    public initializeAdapters(): void {
        this.adapters = new Map<AIProvider, AIAdapter>([
            [AIProvider.OpenAI, new OpenAIAdapter(this.settingsService)],
            [AIProvider.Anthropic, new AnthropicAdapter(this.settingsService)],
            [AIProvider.Google, new GeminiAdapter(this.settingsService)],
            [AIProvider.Groq, new GroqAdapter(this.settingsService)],
            [AIProvider.OpenRouter, new OpenRouterAdapter(this.settingsService)],
            [AIProvider.LMStudio, new LMStudioAdapter(this.settingsService)]
        ]);
    }

    /**
     * Initializes all generators using the current AI adapter.
     */
    public initializeGenerators(): void {
        const currentProvider = this.getCurrentProvider();
        const currentAdapter = this.getAdapterForProvider(currentProvider);
        this.frontMatterGenerator = new FrontMatterGenerator(currentAdapter, this.settingsService, this.jsonSchemaGenerator);
        this.wikilinkGenerator = new WikilinkGenerator(currentAdapter, this.settingsService);
        this.ontologyGenerator = new OntologyGenerator(currentAdapter, this.settingsService);
        this.batchProcessor = new BatchProcessor(currentAdapter, this.settingsService, this.frontMatterGenerator, this.wikilinkGenerator, this.app);
    }

    /**
     * Generates a response from the current AI provider.
     * @param prompt The input prompt.
     * @returns An AIResponse containing the API's response or an error message.
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
     * Retrieves a list of providers that have API keys set.
     * @returns An array of AIProvider enums.
     */
    public getProvidersWithApiKeys(): AIProvider[] {
        const aiProviderSettings = this.settingsService.getAIProviderSettings();
        return Object.entries(aiProviderSettings.apiKeys)
            .filter(([_, apiKey]) => apiKey && apiKey.trim() !== '')
            .map(([provider, _]) => provider as AIProvider);
    }
    
    /**
     * Generates front matter for the given content.
     * @param content The content to generate front matter for.
     * @returns The content with generated front matter.
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
     * @param content The content to generate wikilinks for.
     * @returns The content with generated wikilinks.
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
     * Generates ontology based on the provided input.
     * @param input The input data for ontology generation.
     * @returns An OntologyResult object.
     */
    public async generateOntology(input: { files: TFile[], folders: TFolder[], tags: string[] }): Promise<OntologyResult> {
        try {
            return await this.ontologyGenerator.generate(input);
        } catch (error) {
            console.error("Error generating ontology:", error);
            throw new Error(`Failed to generate ontology: ${(error as Error).message}`);
        }
    }

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
     * Processes a batch of files with specified options.
     * @param files The files to process.
     * @param options The processing options.
     * @returns A BatchProcessorResult object.
     */
    public async batchProcess(files: TFile[], options: { generateFrontMatter: boolean, generateWikilinks: boolean }): Promise<BatchProcessorResult> {
        try {
            return await this.batchProcessor.generate({ files, ...options });
        } catch (error) {
            console.error("Error in batch processing:", error);
            throw new Error(`Batch processing failed: ${(error as Error).message}`);
        }
    }

    /**
     * Retrieves the currently selected AI provider.
     * @returns The selected AIProvider enum.
     */
    public getCurrentProvider(): AIProvider {
        return this.settingsService.getAIProviderSettings().selected;
        return this.settingsService.getAIProviderSettings().selected;
    }

    /**
     * Retrieves the currently selected model's API name for a given provider.
     * @param provider The AIProvider enum.
     * @returns The selected model's API name.
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
     * Retrieves the default model's API name.
     * @returns The default model's API name.
     */
    public getDefaultModel(): string {
        const provider = this.getCurrentProvider();
        return this.getCurrentModel(provider);
    }

    /**
     * Sets the default model's API name for the current provider.
     * @param modelApiName The model's API name to set as default.
     */
    public async setDefaultModel(modelApiName: string): Promise<void> {
        const provider = this.getCurrentProvider();
        const aiProviderSettings = this.settingsService.getAIProviderSettings();
        aiProviderSettings.selectedModels[provider] = modelApiName;
        await this.settingsService.updateAIProviderSettings(provider, { selectedModels: aiProviderSettings.selectedModels });
    }

    /**
     * Retrieves available models' API names for a given provider.
     * @param provider The AIProvider enum.
     * @returns An array of available model API names.
     */
    public getAvailableModels(provider: AIProvider): string[] {
        const adapter = this.getAdapterForProvider(provider);
        return adapter.getAvailableModels();
    }

    /**
     * Retrieves a list of all supported AI providers.
     * @returns An array of AIProvider enums.
     */
    public getSupportedProviders(): AIProvider[] {
        return Array.from(this.adapters.keys());
    }

    /**
     * Retrieves the adapter for a specific AI provider.
     * @param provider The AIProvider enum.
     * @returns The corresponding AIAdapter.
     */
    public getAdapterForProvider(provider: AIProvider): AIAdapter {
        const adapter = this.adapters.get(provider);
        if (!adapter) {
            throw new Error(`No adapter found for provider: ${provider}`);
        }
        return adapter;
    }

    /**
     * Validates the API key for a specific provider.
     * @param provider The AIProvider enum.
     * @returns A boolean indicating whether the API key is valid.
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
     * Updates the plugin settings and reinitializes adapters and generators.
     * @param newSettings The new settings to apply.
     */
    public async updateSettings(newSettings: Partial<PluginSettings>): Promise<void> {
        await this.settingsService.updateSettings(newSettings);
        this.reinitialize();
        this.reinitialize();
    }

    /**
     * Retrieves the root folder of the vault.
     * @returns The root TFolder.
     */
    public getVaultRoot(): TFolder {
        return this.app.vault.getRoot();
    }

    /**
     * Retrieves a list of existing page names in the vault.
     * @returns An array of page names.
     */
    public getExistingPages(): string[] {
        return this.app.vault.getMarkdownFiles().map(file => file.basename);
    }

    /**
     * Tests the connection to a specific AI provider by validating the API key and making a test prompt.
     * @param provider The AIProvider enum.
     * @returns A boolean indicating whether the connection is successful.
     */
    public async testConnection(provider: AIProvider): Promise<boolean> {
        try {
            const adapter = this.getAdapterForProvider(provider);
            const isValid = await adapter.validateApiKey();
            if (!isValid) {
                throw new Error("Invalid API key");
            }
            
            const testPrompt = "This is a test prompt. Please respond with 'OK' if you receive this message.";
            const modelApiName = this.getCurrentModel(provider);
            const response = await adapter.generateResponse(testPrompt, modelApiName);
            
            if (response.success && response.data && typeof response.data === 'string' && response.data.includes('OK')) {
                return true;
            } else {
                throw new Error("Unexpected response from AI provider");
            }
        } catch (error) {
            console.error(`Error testing connection to ${provider}:`, error);
            return false;
        }
    }
}
