import { App, Setting, ToggleComponent, ButtonComponent } from "obsidian";
import { BaseAccordion } from "./BaseAccordion";
import { AIService } from "../../services/AIService";
import { SettingsService } from "../../services/SettingsService";
import { BatchProcessorModal } from "../modals/BatchProcessorModal";
import { PluginSettings } from "../../settings/Settings";

export class BatchProcessorAccordion extends BaseAccordion {
    constructor(app: App, containerEl: HTMLElement, settingsService: SettingsService, aiService: AIService) {
        super(app, containerEl, settingsService, aiService);
    }

    public render(): void {
        const contentEl = this.createAccordion(
            "🔄 Batch Processor",
            "Process multiple files to generate front matter and wikilinks."
        );
        this.createAutoGenerateToggle(contentEl);
        this.createRunBatchProcessorButton(contentEl);
    }

    private createAutoGenerateToggle(containerEl: HTMLElement): void {
        const settings = this.settingsService.getSettings();
        this.createToggleSetting<'frontMatter', 'autoGenerate'>(
            "Auto-generate Front Matter",
            "Automatically generate front matter for new or unprocessed notes when you open your vault.",
            settings.frontMatter.autoGenerate,
            { 
                section: 'frontMatter', 
                key: 'autoGenerate',
                value: settings.frontMatter.autoGenerate
            }
        );
    }

    private createRunBatchProcessorButton(containerEl: HTMLElement): void {
        this.createButton(
            "Run Batch Processor",
            "Manually process multiple files to generate front matter and wikilinks.",
            "Run Batch Processor",
            () => {
                const modal = new BatchProcessorModal(this.app, this.aiService, this.settingsService);
                modal.open();
            },
            true
        );
    }
}