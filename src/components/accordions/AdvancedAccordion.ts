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
        const settings = this.settingsService.getSettings();
        this.addToggle(
            "Generate Wikilinks",
            "Automatically generate wikilinks for your notes.",
            settings.advanced.generateWikilinks,
            async (value: boolean) => {
                await this.settingsService.updateNestedSetting('advanced', 'generateWikilinks', value);
            }
        );
    }

    public createAIParameterOverrides(containerEl: HTMLElement): void {
        const settings = this.settingsService.getSettings();

        this.addTextInput(
            "Temperature",
            "Set the temperature for AI responses (0.0 - 1.0).",
            "0.0 - 1.0",
            settings.advanced.temperature.toString(),
            async (value: string) => {
                const temp = parseFloat(value);
                if (!isNaN(temp) && temp >= 0 && temp <= 1) {
                    await this.settingsService.updateNestedSetting('advanced', 'temperature', temp);
                }
            }
        );

        this.addTextInput(
            "Max Tokens",
            "Set the maximum number of tokens for AI responses.",
            "Enter max tokens",
            settings.advanced.maxTokens.toString(),
            async (value: string) => {
                const tokens = parseInt(value);
                if (!isNaN(tokens) && tokens > 0) {
                    await this.settingsService.updateNestedSetting('advanced', 'maxTokens', tokens);
                }
            }
        );
    }
}
