import { App, TFolder, TFile } from "obsidian";
import { AIProvider, AIResponse, AIAdapter, AIModel, AIModelMap } from "../models/AIModels";
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
import { OntologyInput } from "../models/OntologyTypes";

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

    public reinitialize(): void {
        this.initializeAdapters();
        this.initializeGenerators();
    }

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

    public initializeGenerators(): void {
        const currentProvider = this.getCurrentProvider();
        const currentAdapter = this.getAdapterForProvider(currentProvider);
        this.frontMatterGenerator = new FrontMatterGenerator(currentAdapter, this.settingsService, this.jsonSchemaGenerator);
        this.wikilinkGenerator = new WikilinkGenerator(currentAdapter, this.settingsService);
        this.ontologyGenerator = new OntologyGenerator(currentAdapter, this.settingsService);
        this.batchProcessor = new BatchProcessor(currentAdapter, this.settingsService, this.frontMatterGenerator, this.wikilinkGenerator, this.app);
    }

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

    public getProvidersWithApiKeys(): AIProvider[] {
        const aiProviderSettings = this.settingsService.getAIProviderSettings();
        return Object.entries(aiProviderSettings.apiKeys)
            .filter(([_, apiKey]) => apiKey && apiKey.trim() !== '')
            .map(([provider, _]) => provider as AIProvider);
    }
    
    public async generateFrontMatter(content: string): Promise<string> {
        try {
            return await this.frontMatterGenerator.generate(content);
        } catch (error) {
            console.error("Error generating front matter:", error);
            throw new Error(`Failed to generate front matter: ${(error as Error).message}`);
        }
    }

    public async generateWikilinks(content: string): Promise<string> {
        const existingPages = this.getExistingPages();
        try {
            return await this.wikilinkGenerator.generate({ content, existingPages });
        } catch (error) {
            console.error("Error generating wikilinks:", error);
            throw new Error(`Failed to generate wikilinks: ${(error as Error).message}`);
        }
    }

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
    
    public async batchProcess(files: TFile[], options: { generateFrontMatter: boolean, generateWikilinks: boolean }): Promise<BatchProcessorResult> {
        try {
            return await this.batchProcessor.generate({ files, ...options });
        } catch (error) {
            console.error("Error in batch processing:", error);
            throw new Error(`Batch processing failed: ${(error as Error).message}`);
        }
    }

    public getCurrentProvider(): AIProvider {
        return this.settingsService.getAIProviderSettings().selected;
    }

    public getCurrentModel(provider: AIProvider): string {
        const aiProviderSettings = this.settingsService.getAIProviderSettings();
        const modelApiName = aiProviderSettings.selectedModels[provider];
        if (!modelApiName) {
            throw new Error(`No model selected for provider: ${provider}`);
        }
        return modelApiName;
    }

    public getDefaultModel(): string {
        const provider = this.getCurrentProvider();
        return this.getCurrentModel(provider);
    }

    public async setDefaultModel(modelApiName: string): Promise<void> {
        const provider = this.getCurrentProvider();
        const aiProviderSettings = this.settingsService.getAIProviderSettings();
        aiProviderSettings.selectedModels[provider] = modelApiName;
        await this.settingsService.updateAIProviderSettings(provider, { selectedModels: aiProviderSettings.selectedModels });
    }

    public getAvailableModels(provider: AIProvider): string[] {
        const adapter = this.getAdapterForProvider(provider);
        return adapter.getAvailableModels();
    }

    public getSupportedProviders(): AIProvider[] {
        return Array.from(this.adapters.keys());
    }

    public getAdapterForProvider(provider: AIProvider): AIAdapter {
        const adapter = this.adapters.get(provider);
        if (!adapter) {
            throw new Error(`No adapter found for provider: ${provider}`);
        }
        return adapter;
    }

    public async validateApiKey(provider: AIProvider): Promise<boolean> {
        const adapter = this.getAdapterForProvider(provider);
        try {
            return await adapter.validateApiKey();
        } catch (error) {
            console.error(`Error validating API key for ${provider}:`, error);
            return false;
        }
    }

    public async updateSettings(newSettings: Partial<PluginSettings>): Promise<void> {
        await this.settingsService.updateSettings(newSettings);
        this.reinitialize();
    }

    public getVaultRoot(): TFolder {
        return this.app.vault.getRoot();
    }

    public getExistingPages(): string[] {
        return this.app.vault.getMarkdownFiles().map(file => file.basename);
    }

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

    private getModelDetails(provider: AIProvider, modelName: string): AIModel | undefined {
        const models = AIModelMap[provider];
        return models.find(model => model.apiName === modelName);
    }
}