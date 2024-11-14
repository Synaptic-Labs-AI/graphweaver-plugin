// src/generators/BaseGenerator.ts

import { AIAdapter, AIProvider } from 'src/models/AIModels';
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
 * Interface for service lifecycle management
 */
export interface IService {
    /**
     * Initialize the service.
     */
    initialize(): Promise<void>;

    /**
     * Destroy the service and clean up resources.
     */
    destroy(): Promise<void>;
}

/**
 * Abstract base class for all generators
 * @template TInput Type of input the generator accepts
 * @template TOutput Type of output the generator produces
 */
export abstract class BaseGenerator<
    TInput extends BaseGeneratorInput = BaseGeneratorInput,
    TOutput extends BaseGeneratorOutput = BaseGeneratorOutput
> implements IService
{
    protected constructor(
        protected readonly aiAdapter: AIAdapter,
        protected readonly settingsService: SettingsService
    ) {}

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
     * Initialize the generator.
     * Derived classes can override this method if specific initialization is needed.
     */
    public async initialize(): Promise<void> {
        // Default implementation does nothing.
        // Derived classes can override this method to perform specific initialization tasks.
        console.log(`${this.constructor.name}: Initialization complete.`);
    }

    /**
     * Destroy the generator.
     * Derived classes can override this method to clean up resources.
     */
    public async destroy(): Promise<void> {
        // Default implementation does nothing.
        // Derived classes can override this method to perform specific cleanup tasks.
        console.log(`${this.constructor.name}: Destruction complete.`);
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
        const selectedModel = this.getSelectedModel(settings);

        if (!selectedModel) {
            throw new Error(`No model selected for ${this.constructor.name}`);
        }

        return selectedModel;
    }

    /**
     * Get the selected model from settings.
     * Can be overridden by subclasses to use specific model settings.
     */
    protected getSelectedModel(settings: PluginSettings): string | undefined {
        const provider: AIProvider = this.aiAdapter.getProviderType();
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
        return input !== null && input !== undefined;
    }

    /**
     * Handle errors that occur during generation.
     * @param error The error that occurred
     */
    protected handleError(error: Error): never {
        const errorMessage = `${this.constructor.name} error: ${error.message}`;
        console.error(errorMessage);
        throw new Error(errorMessage);
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
