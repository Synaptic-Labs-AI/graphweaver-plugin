import { AIAdapter } from '../adapters/AIAdapter';
import { SettingsService } from '../services/SettingsService';
import { PluginSettings } from '../settings/Settings';

/**
 * Base interface for all generator inputs
 */
export interface BaseGeneratorInput {
    [key: string]: any;
}

/**
 * Base interface for all generator outputs
 */
export interface BaseGeneratorOutput {
    [key: string]: any;
}

/**
 * Interface for prompt preparation inputs
 */
export interface PreparePromptInput extends BaseGeneratorInput {
    content?: string;
    schema?: object;
    userPrompt?: string;
    [key: string]: any;
}

/**
 * Abstract base class for all generators
 * @template TInput Type of input the generator accepts
 * @template TOutput Type of output the generator produces
 */
export abstract class BaseGenerator<TInput extends BaseGeneratorInput = BaseGeneratorInput, TOutput extends BaseGeneratorOutput = BaseGeneratorOutput> {
    protected aiAdapter: AIAdapter;
    protected settingsService: SettingsService;

    constructor(aiAdapter: AIAdapter, settingsService: SettingsService) {
        this.aiAdapter = aiAdapter;
        this.settingsService = settingsService;
    }

    /**
     * Generate content based on input and settings.
     * @param input The input data for generation
     * @returns Promise resolving to the generated content
     */
    public async generate(input: TInput): Promise<TOutput> {
        try {
            if (!this.validateInput(input)) {
                throw new Error('Invalid input provided');
            }

            const prompt = this.preparePrompt(input);
            const model = await this.getCurrentModel();
            const aiResponse = await this.aiAdapter.generateResponse(prompt, model);

            if (!aiResponse.success || !aiResponse.data) {
                throw new Error(aiResponse.error || 'Failed to generate content');
            }

            return this.formatOutput(aiResponse.data, input);
        } catch (error) {
            return this.handleError(error as Error);
        }
    }

    /**
     * Prepare the prompt for AI generation.
     * @param input The input data for prompt preparation
     */
    protected abstract preparePrompt(input: TInput): string;

    /**
     * Format the AI response into the desired output format.
     * @param aiResponse The raw response from the AI adapter
     * @param originalInput The original input provided
     */
    protected abstract formatOutput(aiResponse: any, originalInput: TInput): TOutput;

    /**
     * Get the current model for this generator.
     * @returns The model identifier string
     */
    protected async getCurrentModel(): Promise<string> {
        const settings = this.getSettings();
        const providerType = this.aiAdapter.getProviderType();
        const modelApiName = settings.aiProvider?.selectedModels?.[providerType];

        if (!modelApiName) {
            throw new Error(`No model selected for provider: ${providerType}`);
        }

        return modelApiName;
    }

    /**
     * Get the selected model from settings.
     * Can be overridden by subclasses to use specific model settings.
     */
    protected getSelectedModel(settings: PluginSettings): string | undefined {
        const provider = this.aiAdapter.getProviderType();
        return settings.aiProvider?.selectedModels?.[provider];
    }

    /**
     * Get the current settings for this generator.
     */
    protected getSettings(): PluginSettings {
        return this.settingsService.getSettings();
    }

    /**
     * Validate the input before generation.
     * @param input The input to validate
     */
    protected validateInput(input: TInput): boolean {
        return input !== null && typeof input === 'object';
    }

    /**
     * Handle errors that occur during generation.
     * @param error The error that occurred
     */
    protected handleError(error: Error): never {
        console.error(`${this.constructor.name} error: ${error.message}`, error);
        throw error;
    }

    /**
     * Utility method to clean and format text content
     */
    protected cleanContent(content: string): string {
        return content.trim().replace(/\n{3,}/g, '\n\n');
    }

    /**
     * Utility method to validate JSON data
     */
    protected isValidJson(data: any): boolean {
        try {
            JSON.parse(JSON.stringify(data));
            return true;
        } catch {
            return false;
        }
    }
}