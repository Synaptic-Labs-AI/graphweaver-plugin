// src/components/accordions/ModelHookupAccordion.ts

import { App, Setting, Notice, TextComponent, DropdownComponent, ButtonComponent } from "obsidian";
import { AIService } from "../../services/AIService";
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
        super(containerEl);
    }

    public render(): void {
        const contentEl = this.createAccordion(
            "🔌 Model Hookup",
            "Configure AI providers and models."
        );
        this.createProviderDropdown(contentEl);
        this.settingsContainer = contentEl.createDiv({ cls: "provider-settings" });
        this.renderProviderSettings();
    }

    public createProviderDropdown(containerEl: HTMLElement): void {
        const settings = this.settingsService.getSettings();
        new Setting(containerEl)
            .setName("AI Provider")
            .setDesc("Select the AI provider to use")
            .addDropdown(dropdown => {
                this.providerDropdown = dropdown;
                Object.values(AIProvider).forEach(provider => {
                    dropdown.addOption(provider, this.getFormattedProviderName(provider));
                });
                dropdown.setValue(settings.aiProvider.selected)
                    .onChange(async (value: AIProvider) => {
                        await this.settingsService.updateNestedSetting('aiProvider', 'selected', value);
                        this.aiService.reinitialize();
                        this.renderProviderSettings();
                    });
            });
    }

    public renderProviderSettings(): void {
        const provider = this.providerDropdown.getValue() as AIProvider;
        this.settingsContainer.empty();

        if (provider === AIProvider.LMStudio) {
            this.renderLocalSettings();
        } else {
            this.renderCloudSettings(provider);
            this.createModelDropdown(this.settingsContainer, provider);
        }

        this.createTestButton(this.settingsContainer, provider);
    }

    public renderCloudSettings(provider: AIProvider): void {
        this.createProviderLink(this.settingsContainer, provider);
        this.createApiKeyInput(this.settingsContainer, provider);
    }

    public renderLocalSettings(): void {
        this.createPortInput(this.settingsContainer);
        this.createModelNameInput(this.settingsContainer);
    }

    public createProviderLink(containerEl: HTMLElement, provider: AIProvider): void {
        const websiteUrl = this.getProviderWebsite(provider);
        const formattedName = this.getFormattedProviderName(provider);
        const linkEl = containerEl.createEl('a', { 
            text: formattedName, 
            href: websiteUrl,
            cls: "provider-link"
        });
        linkEl.setAttribute('target', '_blank');
    }

    public createApiKeyInput(containerEl: HTMLElement, provider: AIProvider): void {
        const settings = this.settingsService.getSettings();
        new Setting(containerEl)
            .setName("API Key")
            .setDesc(`Enter your API key for ${this.getFormattedProviderName(provider)}`)
            .addText(text => {
                text.setPlaceholder("Enter API Key")
                    .setValue(settings.aiProvider.apiKeys[provider] || "")
                    .onChange(async (value: string) => {
                        const currentApiKeys = this.settingsService.getNestedSetting('aiProvider', 'apiKeys');
                        const updatedApiKeys = { ...currentApiKeys, [provider]: value };
                        await this.settingsService.updateNestedSetting('aiProvider', 'apiKeys', updatedApiKeys);
                        this.aiService.reinitialize();
                    });
            });
    }

    public createPortInput(containerEl: HTMLElement): void {
        const settings = this.settingsService.getSettings();
        new Setting(containerEl)
            .setName("LM Studio Port")
            .setDesc("Enter the port number for your local LM Studio instance")
            .addText(text => {
                text.setPlaceholder("Enter port number")
                    .setValue(settings.localLMStudio.port.toString())
                    .onChange(async (value: string) => {
                        const port = parseInt(value, 10);
                        if (!isNaN(port)) {
                            await this.settingsService.updateNestedSetting('localLMStudio', 'port', port);
                            this.aiService.reinitialize();
                        }
                    });
            });
    }

    public createModelNameInput(containerEl: HTMLElement): void {
        const settings = this.settingsService.getSettings();
        new Setting(containerEl)
            .setName("Model Name")
            .setDesc("Enter the name of the local model you want to use")
            .addText(text => {
                text.setPlaceholder("Enter model name")
                    .setValue(settings.localLMStudio.modelName)
                    .onChange(async (value: string) => {
                        await this.settingsService.updateNestedSetting('localLMStudio', 'modelName', value);
                        await this.settingsService.updateNestedSetting('aiProvider', 'selectedModels', {
                            ...this.settingsService.getNestedSetting('aiProvider', 'selectedModels'),
                            [AIProvider.LMStudio]: value
                        });
                        this.aiService.reinitialize();
                    });
            });
    }

    public createModelDropdown(containerEl: HTMLElement, provider: AIProvider): void {
        const settings = this.settingsService.getSettings();
        const models = AIModelMap[provider];
        new Setting(containerEl)
            .setName("Model")
            .setDesc(`Select the AI model for ${this.getFormattedProviderName(provider)}`)
            .addDropdown(dropdown => {
                models.forEach((model: AIModel) => {
                    dropdown.addOption(model.apiName, model.name);
                });
                const currentModel = settings.aiProvider.selectedModels[provider] || (models[0]?.apiName || "");
                dropdown.setValue(currentModel)
                    .onChange(async (value: string) => {
                        const currentSelectedModels = this.settingsService.getNestedSetting('aiProvider', 'selectedModels');
                        const updatedSelectedModels = { ...currentSelectedModels, [provider]: value };
                        await this.settingsService.updateNestedSetting('aiProvider', 'selectedModels', updatedSelectedModels);
                    });
            });
    }

    public createTestButton(containerEl: HTMLElement, provider: AIProvider): void {
        new Setting(containerEl)
            .addButton((button: ButtonComponent) => {
                button
                    .setButtonText("Test Connection")
                    .onClick(async () => {
                        const result = await this.aiService.testConnection(provider);
                        if (result) {
                            new Notice(`Successfully connected to ${this.getFormattedProviderName(provider)}`);
                        } else {
                            new Notice(`Failed to connect to ${this.getFormattedProviderName(provider)}. Please check your settings and try again.`);
                        }
                    });
            });
    }

    public getProviderWebsite(provider: AIProvider): string {
        const websiteMap: Record<AIProvider, string> = {
            [AIProvider.OpenAI]: "https://openai.com",
            [AIProvider.Anthropic]: "https://www.anthropic.com",
            [AIProvider.Google]: "https://cloud.google.com/vertex-ai",
            [AIProvider.Groq]: "https://groq.com",
            [AIProvider.OpenRouter]: "https://openrouter.ai",
            [AIProvider.LMStudio]: "https://lmstudio.ai"
        };
        return websiteMap[provider] || "#";
    }

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
}