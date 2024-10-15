// src/generators/BaseGenerator.ts

import { AIAdapter } from '../adapters/AIAdapter';
import { SettingsService } from '../services/SettingsService';
import { PluginSettings } from '../models/Settings';

export abstract class BaseGenerator {
    protected aiAdapter: AIAdapter;
    protected settingsService: SettingsService;

    constructor(aiAdapter: AIAdapter, settingsService: SettingsService) {
        this.aiAdapter = aiAdapter;
        this.settingsService = settingsService;
    }

    /**
     * Generate content based on input and settings.
     * @param input The input data for generation (e.g., note content, file metadata)
     * @returns A promise that resolves to the generated content
     */
    abstract generate(input: any): Promise<any>;

    /**
     * Prepare the prompt for AI generation.
     * @param input The input data for prompt preparation
     * @returns The prepared prompt string
     */
    protected abstract preparePrompt(input: any): string;

    /**
     * Format the AI response into the desired output format.
     * @param aiResponse The raw response from the AI adapter
     * @param originalInput The original input provided to the generate method
     * @returns The formatted output
     */
    protected abstract formatOutput(aiResponse: any, originalInput?: any): any;

    /**
     * Get the current settings for this generator.
     * @returns The relevant settings for this generator
     */
    protected getSettings(): PluginSettings {
        return this.settingsService.getSettings();
    }

    /**
     * Validate the input before generation.
     * @param input The input to validate
     * @returns True if the input is valid, false otherwise
     */
    protected validateInput(input: any): boolean {
        // Default implementation always returns true
        // Subclasses should override this method if they need specific validation
        return true;
    }

    /**
     * Handle errors that occur during generation.
     * @param error The error that occurred
     * @throws A custom error with additional context
     */
    protected handleError(error: Error): never {
        throw new Error(`Generation error in ${this.constructor.name}: ${error.message}`);
    }
}