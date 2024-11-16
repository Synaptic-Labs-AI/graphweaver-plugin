// src/components/accordions/ModelHookupAccordion.ts

import { App, Setting, Notice, DropdownComponent, ButtonComponent } from "obsidian";
import { AIService } from "../../services/ai/AIService";
import { SettingsService } from "../../services/SettingsService";
import { AIProvider, AIModelMap, AIModel } from "../../models/AIModels";
import { BaseAccordion } from "./BaseAccordion";

export class ModelHookupAccordion extends BaseAccordion {
    public providerDropdown: DropdownComponent;
    public settingsContainer: HTMLElement;

    constructor(
        public app: App,
        containerEl: HTMLElement,
        public settingsService: SettingsService,
        public aiService: AIService
    ) {
        super(containerEl, app);
    }

    public render(): void {
        const contentEl = this.createAccordion(
            "🔌 Model Hookup",
            "Configure AI providers and models."
        );
        this.createProviderDropdown();
        this.settingsContainer = contentEl.createDiv({ cls: "provider-settings" });
        this.renderProviderSettings();
    }

    /**
     * Create the AI Provider dropdown using BaseAccordion's addDropdown
     */
    public createProviderDropdown(): void {
        const settings = this.settingsService.getSettings();
        this.providerDropdown = this.addDropdown(
            "AI Provider",
            "Select the AI provider to use",
            this.getProviderOptions(),
            settings.aiProvider.selected,
            async (value: string) => {
                await this.handleProviderChange(value as AIProvider);
            }
        );
    }

    /**
     * Get options for AI Provider dropdown
     */
    private getProviderOptions(): Record<string, string> {
        const formattedNames: Record<AIProvider, string> = {
            [AIProvider.OpenAI]: "OpenAI",
            [AIProvider.Anthropic]: "Anthropic",
            [AIProvider.Google]: "Google Gemini",
            [AIProvider.Groq]: "Groq",
            [AIProvider.OpenRouter]: "OpenRouter",
            [AIProvider.LMStudio]: "LM Studio"
        };
        const options: Record<string, string> = {};
        Object.values(AIProvider).forEach(provider => {
            options[provider] = formattedNames[provider];
        });
        return options;
    }

    /**
     * Handle changes to the AI provider selection.
     * Updates the selected provider in settings and reinitializes the AI service.
     * @param value The new AI provider selected.
     */
    public async handleProviderChange(value: AIProvider): Promise<void> {
        await this.settingsService.updateNestedSetting('aiProvider', 'selected', value);
        try {
            await this.aiService.reinitialize();
            this.showNotice(`AI Service reinitialized with provider ${this.getFormattedProviderName(value)}.`);
            this.renderProviderSettings();
        } catch (error) {
            console.error('Failed to reinitialize AI Service:', error);
            this.showNotice(`Failed to reinitialize AI Service: ${(error as Error).message}`);
        }
    }

    /**
     * Render settings based on the selected AI provider
     */
    public renderProviderSettings(): void {
        const provider = this.providerDropdown.getValue() as AIProvider;
        this.settingsContainer.empty();

        if (provider === AIProvider.LMStudio) {
            this.renderLocalSettings();
        } else {
            this.renderCloudSettings(provider);
            this.createModelDropdown(provider);
        }

        this.createTestButton(provider);
    }

    /**
     * Render cloud provider settings
     * @param provider The selected AI provider
     */
    public renderCloudSettings(provider: AIProvider): void {
        this.createProviderLink(provider);
        this.createApiKeyInput(provider);
    }

    /**
     * Render local provider settings
     */
    public renderLocalSettings(): void {
        this.createPortInput();
        this.createModelNameInput();
    }

    /**
     * Create the API Key input using BaseAccordion's addTextInput
     * @param provider The selected AI provider
     */
    public createApiKeyInput(provider: AIProvider): void {
        const settings = this.settingsService.getSettings();
        this.addTextInput(
            "API Key",
            `Enter your API key for ${this.getFormattedProviderName(provider)}`,
            "Enter API Key",
            settings.aiProvider.apiKeys[provider] || "",
            async (value: string) => {
                const currentApiKeys = this.settingsService.getNestedSetting('aiProvider', 'apiKeys');
                const updatedApiKeys = { ...currentApiKeys, [provider]: value };
                await this.settingsService.updateNestedSetting('aiProvider', 'apiKeys', updatedApiKeys);
                await this.aiService.reinitialize();
            }
        );
    }

    /**
     * Create the Port input using BaseAccordion's addTextInput
     */
    public createPortInput(): void {
        const settings = this.settingsService.getSettings();
        this.addTextInput(
            "LM Studio Port",
            "Enter the port number for your local LM Studio instance",
            "Enter port number",
            settings.localLMStudio.port.toString(),
            async (value: string) => {
                const port = parseInt(value, 10);
                if (!isNaN(port)) {
                    await this.settingsService.updateNestedSetting('localLMStudio', 'port', port);
                    await this.aiService.reinitialize();
                }
            }
        );
    }

    /**
     * Create the Model Name input using BaseAccordion's addTextInput
     */
    public createModelNameInput(): void {
        const settings = this.settingsService.getSettings();
        this.addTextInput(
            "Model Name",
            "Enter the name of the local model you want to use",
            "Enter model name",
            settings.localLMStudio.modelName,
            async (value: string) => {
                await this.settingsService.updateNestedSetting('localLMStudio', 'modelName', value);
                await this.settingsService.updateNestedSetting('aiProvider', 'selectedModels', {
                    ...this.settingsService.getNestedSetting('aiProvider', 'selectedModels'),
                    [AIProvider.LMStudio]: value
                });
                await this.aiService.reinitialize();
            }
        );
    }

    /**
     * Create the Model dropdown using BaseAccordion's addDropdown
     * @param provider The selected AI provider
     */
    public createModelDropdown(provider: AIProvider): void {
        const settings = this.settingsService.getSettings();
        const models = AIModelMap[provider];
        const options: Record<string, string> = {};
        models.forEach((model: AIModel) => {
            options[model.apiName] = model.name;
        });

        const currentModel = settings.aiProvider.selectedModels[provider] || (models[0]?.apiName || "");

        this.addDropdown(
            "Model",
            `Select the AI model for ${this.getFormattedProviderName(provider)}`,
            options,
            currentModel,
            async (value: string) => {
                const currentSelectedModels = this.settingsService.getNestedSetting('aiProvider', 'selectedModels');
                const updatedSelectedModels = { ...currentSelectedModels, [provider]: value };
                await this.settingsService.updateNestedSetting('aiProvider', 'selectedModels', updatedSelectedModels);
            }
        );
    }

    /**
     * Create the Test Connection button using BaseAccordion's addButton
     * @param provider The selected AI provider
     */
    public createTestButton(provider: AIProvider): void {
        const button = this.addButton(
            "Test Connection",
            async () => {
                button.setDisabled(true);
                button.setButtonText("Testing...");
                const result = await this.aiService.testConnection(provider);
                button.setDisabled(false);
                button.setButtonText("Test Connection");
                if (result) {
                    this.showNotice(`Successfully connected to ${this.getFormattedProviderName(provider)}`);
                } else {
                    this.showNotice(`Failed to connect to ${this.getFormattedProviderName(provider)}. Please check your settings and try again.`);
                }
            },
            false
        );
    }

    /**
     * Create the provider link
     * @param provider The selected AI provider
     */
    public createProviderLink(provider: AIProvider): void {
        const websiteUrl = this.getProviderWebsite(provider);
        const linkText = provider === AIProvider.LMStudio ? "LM Studio Documentation" : "Get API Key";

        const linkEl = this.settingsContainer.createEl('a', { 
            text: linkText, 
            href: websiteUrl,
            cls: "provider-link"
        });
        linkEl.setAttribute('target', '_blank');

        // Add a label to show which provider the link is for
        this.settingsContainer.createEl('span', {
            text: ` for ${this.getFormattedProviderName(provider)}`,
            cls: "provider-label"
        });
    }

    /**
     * Get the website URL for the provider
     * @param provider The AI provider
     * @returns The website URL
     */
    public getProviderWebsite(provider: AIProvider): string {
        const websiteMap: Record<AIProvider, string> = {
            [AIProvider.OpenAI]: "https://platform.openai.com/api-keys",
            [AIProvider.Anthropic]: "https://console.anthropic.com/settings/keys",
            [AIProvider.Google]: "https://aistudio.google.com/apikey",
            [AIProvider.Groq]: "https://console.groq.com/keys",
            [AIProvider.OpenRouter]: "https://openrouter.ai/settings/keys",
            [AIProvider.LMStudio]: "https://lmstudio.ai/docs/basics/server"
        };
        return websiteMap[provider] || "#";
    }

    /**
     * Get the formatted name for the provider
     * @param provider The AI provider
     * @returns The formatted name
     */
    public getFormattedProviderName(provider: AIProvider): string {
        const formattedNames: Record<AIProvider, string> = {
            [AIProvider.OpenAI]: "OpenAI",
            [AIProvider.Anthropic]: "Anthropic",
            [AIProvider.Google]: "Google Gemini",
            [AIProvider.Groq]: "Groq",
            [AIProvider.OpenRouter]: "OpenRouter",
            [AIProvider.LMStudio]: "LM Studio"
        };
        return formattedNames[provider] || provider;
    }

    // Example usage of showNotice and handleError
    public async someMethod(): Promise<void> {
        try {
            const provider = this.providerDropdown.getValue() as AIProvider;
            // Some logic...
            this.showNotice(`Successfully connected to ${this.getFormattedProviderName(provider)}`);
        } catch (error) {
            this.handleError("Some Context", error);
        }
    }
}