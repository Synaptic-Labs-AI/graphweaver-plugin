// src/components/accordions/ModelHookupAccordion.ts

import { App, Setting, Notice, DropdownComponent, ButtonComponent } from "obsidian";
import { AIService } from "../../services/AIService";
import { SettingsService } from "../../services/SettingsService";
import { AIProvider, AIModelMap, AIModel, AIModelUtils } from "../../models/AIModels";
import { BaseAccordion } from "./BaseAccordion";

export class ModelHookupAccordion extends BaseAccordion {
    public providerDropdown: DropdownComponent;
    public settingsContainer: HTMLElement;

    constructor(
        protected app: App,
        protected containerEl: HTMLElement,
        protected settingsService: SettingsService,
        protected aiService: AIService
    ) {
        super(app, containerEl, settingsService, aiService);
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
        // Ensure settingsContainer is cleared before rendering new settings
    }

    public renderCloudSettings(provider: AIProvider): void {
        this.createProviderLink(this.settingsContainer, provider);
        this.createApiKeyInput(this.settingsContainer, provider);
    }

    public renderLocalSettings(): void {
        this.createPortInput(this.settingsContainer);
        this.createModelNameInput(this.settingsContainer);
    }

    public createApiKeyInput(containerEl: HTMLElement, provider: AIProvider): void {
        const settings = this.settingsService.getSettings();
        new Setting(containerEl)
            .setName("API Key")
            .setDesc(`Enter your API key for ${this.getFormattedProviderName(provider)}`)
            .addText(text => {
                text
                    .setPlaceholder("Enter API Key")
                    .setValue(settings.aiProvider.apiKeys[provider] || "")
                    .onChange(async (value: string) => {
                        const currentApiKeys = this.settingsService.getNestedSetting('aiProvider', 'apiKeys');
                        const updatedApiKeys = { ...currentApiKeys, [provider]: value };
                        await this.settingsService.updateNestedSetting('aiProvider', 'apiKeys', updatedApiKeys);
                        this.aiService.reinitialize();
                    });
                
                // Set input type to password directly on the HTML element
                text.inputEl.type = "password";
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
                        this.renderModelSettings(modelSettingsContainer, value);
                    });

                // Create a separate container for model settings
                const modelSettingsContainer = containerEl.createDiv({ cls: "model-settings" });

                // Render initial model settings
                this.renderModelSettings(modelSettingsContainer, currentModel);
            });
    }

    private renderModelSettings(containerEl: HTMLElement, modelApiName: string): void {
        containerEl.empty(); // Clear only the model settings container

        const settings = this.settingsService.getSettings();
        const model = AIModelUtils.getModelByApiName(modelApiName);
        const modelConfigs = settings.aiProvider.modelConfigs as Record<string, { temperature: number; maxTokens: number; }>;
        const modelConfig = (modelConfigs || {})[modelApiName] || {
            temperature: 0.7,
            maxTokens: model?.capabilities?.maxTokens || 4096
        };

        // Temperature Setting
        new Setting(containerEl)
            .setName("Temperature")
            .setDesc("Controls randomness in responses (0.0-1.0)")
            .addSlider(slider => {
                slider.setLimits(0, 1, 0.1)
                    .setValue(modelConfig.temperature)
                    .onChange(async (value) => {
                        await this.updateModelConfig(modelApiName, 'temperature', value);
                    });
            })
            .addText(text => {
                text.setPlaceholder("0.0-1.0")
                    .setValue(modelConfig.temperature.toString())
                    .onChange(async (value) => {
                        const temp = parseFloat(value);
                        if (!isNaN(temp) && temp >= 0 && temp <= 1) {
                            await this.updateModelConfig(modelApiName, 'temperature', temp);
                        }
                    });
            });

        // Max Tokens Setting
        new Setting(containerEl)
            .setName("Max Tokens")
            .setDesc(`Maximum response length (max: ${model?.capabilities?.maxTokens || 'unknown'})`)
            .addText(text => {
                text.setPlaceholder("Enter max tokens")
                    .setValue(modelConfig.maxTokens.toString())
                    .onChange(async (value) => {
                        const tokens = parseInt(value);
                        if (!isNaN(tokens) && tokens > 0) {
                            await this.updateModelConfig(modelApiName, 'maxTokens', tokens);
                        }
                    });
            });
    }

    private async updateModelConfig(modelApiName: string, key: 'temperature' | 'maxTokens', value: number): Promise<void> {
        const settings = this.settingsService.getSettings();
        const modelConfigs = settings.aiProvider.modelConfigs as Record<string, { temperature: number; maxTokens: number; }>;
        const currentConfigs = modelConfigs || {};
        const modelConfig = currentConfigs[modelApiName] || { temperature: 0.7, maxTokens: 4096 };
        
        const updatedConfigs = {
            ...currentConfigs,
            [modelApiName]: {
                ...modelConfig,
                [key]: value
            }
        };
        
        await this.settingsService.updateNestedSetting('aiProvider', 'modelConfigs', updatedConfigs);
    }

    public createTestButton(containerEl: HTMLElement, provider: AIProvider): void {
        new Setting(containerEl)
            .addButton((button: ButtonComponent) => {
                button
                    .setButtonText("Test Connection")
                    .onClick(async () => {
                        button.setDisabled(true);
                        button.setButtonText("Testing...");
                        const result = await this.aiService.testConnection(provider);
                        button.setDisabled(false);
                        button.setButtonText("Test Connection");
                        if (result) {
                            new Notice(`Successfully connected to ${this.getFormattedProviderName(provider)}`);
                        } else {
                            new Notice(`Failed to connect to ${this.getFormattedProviderName(provider)}. Please check your settings and try again.`);
                        }
                    });
            });
    }

    public createProviderLink(containerEl: HTMLElement, provider: AIProvider): void {
        const websiteUrl = this.getProviderWebsite(provider);
        const linkText = provider === AIProvider.LMStudio ? "LM Studio Documentation" : "Get API Key";
        
        const linkEl = containerEl.createEl('a', { 
            text: linkText, 
            href: websiteUrl,
            cls: "provider-link"
        });
        linkEl.setAttribute('target', '_blank');

        // Add a label to show which provider the link is for
        const providerLabel = containerEl.createEl('span', {
            text: ` for ${this.getFormattedProviderName(provider)}`,
            cls: "provider-label"
        });
    }

    public getProviderWebsite(provider: AIProvider): string {
        const websiteMap: Record<AIProvider, string> = {
            [AIProvider.OpenAI]: "https://platform.openai.com/api-keys",
            [AIProvider.Anthropic]: "https://console.anthropic.com/settings/keys",
            [AIProvider.Google]: "https://aistudio.google.com/apikey",
            [AIProvider.Groq]: "https://console.groq.com/keys",
            [AIProvider.OpenRouter]: "https://openrouter.ai/settings/keys",
            [AIProvider.LMStudio]: "https://lmstudio.ai/docs/basics/server",
            [AIProvider.Perplexity]: "https://docs.perplexity.ai/guides/getting-started",
            [AIProvider.Mistral]: "https://docs.mistral.ai/getting-started/quickstart/"
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
            [AIProvider.LMStudio]: "LM Studio",
            [AIProvider.Perplexity]: "Perplexity",
            [AIProvider.Mistral]: "Mistral"
        };
        return formattedNames[provider] || provider;
    }
}