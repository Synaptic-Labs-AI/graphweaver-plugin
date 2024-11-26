import { App, Setting, ToggleComponent, ButtonComponent } from "obsidian";
import { BaseAccordion } from "./BaseAccordion";
import { AIService } from "../../services/AIService";
import { SettingsService } from "../../services/SettingsService";
import { BatchProcessorModal } from "../modals/BatchProcessorModal";

export class BatchProcessorAccordion extends BaseAccordion {
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
            "🔄 Batch Processor",
            "Process multiple files to generate front matter and wikilinks."
        );
        this.createAutoGenerateToggle(contentEl);
        this.createRunBatchProcessorButton(contentEl);
    }

    public createAutoGenerateToggle(containerEl: HTMLElement): void {
        new Setting(containerEl)
            .setName("Auto-generate Front Matter")
            .setDesc("Automatically generate front matter for new or unprocessed notes when you open your vault.")
            .addToggle(toggle => this.setupAutoGenerateToggle(toggle));
    }

    public setupAutoGenerateToggle(toggle: ToggleComponent): void {
        const settings = this.settingsService.getSettings();
        toggle
            .setValue(settings.frontMatter.autoGenerate)
            .onChange(async (value: boolean) => {
                await this.settingsService.updateNestedSetting('frontMatter', 'autoGenerate', value);
            });
    }

    public createRunBatchProcessorButton(containerEl: HTMLElement): void {
        new Setting(containerEl)
            .setName("Run Batch Processor")
            .setDesc("Manually process multiple files to generate front matter and wikilinks.")
            .addButton(button => this.setupRunBatchProcessorButton(button));
    }

    public setupRunBatchProcessorButton(button: ButtonComponent): void {
        button
            .setButtonText("Run Batch Processor")
            .setCta()
            .onClick(() => {
                const modal = new BatchProcessorModal(this.app, this.aiService, this.settingsService);
                modal.open();
            });
    }
}