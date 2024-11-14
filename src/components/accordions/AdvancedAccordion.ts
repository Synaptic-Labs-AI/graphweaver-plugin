import { App, Setting, ToggleComponent, TextComponent } from "obsidian";
import { BaseAccordion } from "./BaseAccordion";
import { SettingsService } from "../../services/SettingsService";
import { AIService } from "../../services/ai/AIService";

export class AdvancedAccordion extends BaseAccordion {
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
            "⚙️ Advanced",
            "Configuration options for the plugin."
        );
        this.createWikilinksToggle(contentEl);
        this.createAIParameterOverrides(contentEl);
    }

    public createWikilinksToggle(containerEl: HTMLElement): void {
        new Setting(containerEl)
            .setName("Generate Wikilinks")
            .addToggle(toggle => this.setupWikilinksToggle(toggle));
    }

    public createAIParameterOverrides(containerEl: HTMLElement): void {
        new Setting(containerEl)
            .setName("Temperature")
            .addText(text => this.setupTemperatureOverride(text));

        new Setting(containerEl)
            .setName("Max Tokens")
            .addText(text => this.setupMaxTokensOverride(text));
    }

    public setupWikilinksToggle(toggle: ToggleComponent): void {
        const settings = this.settingsService.getSettings();
        toggle
            .setValue(settings.advanced.generateWikilinks)
            .onChange(async (value) => {
                await this.settingsService.updateNestedSetting('advanced', 'generateWikilinks', value);
            });
    }

    public setupTemperatureOverride(text: TextComponent): void {
        const settings = this.settingsService.getSettings();
        text
            .setPlaceholder("0.0 - 1.0")
            .setValue(settings.advanced.temperature.toString())
            .onChange(async (value) => {
                const temp = parseFloat(value);
                if (!isNaN(temp) && temp >= 0 && temp <= 1) {
                    await this.settingsService.updateNestedSetting('advanced', 'temperature', temp);
                }
            });
    }

    public setupMaxTokensOverride(text: TextComponent): void {
        const settings = this.settingsService.getSettings();
        text
            .setPlaceholder("Enter max tokens")
            .setValue(settings.advanced.maxTokens.toString())
            .onChange(async (value) => {
                const tokens = parseInt(value);
                if (!isNaN(tokens) && tokens > 0) {
                    await this.settingsService.updateNestedSetting('advanced', 'maxTokens', tokens);
                }
            });
    }
}
