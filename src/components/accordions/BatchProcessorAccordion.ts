import { App, Setting, Notice } from "obsidian";
import { BaseAccordion } from "./BaseAccordion";
import { AIService } from "../../services/ai/AIService";
import { SettingsService } from "../../services/SettingsService";
import { BatchProcessorModal } from "../modals/BatchProcessorModal";

interface AccordionDependencies {
    app: App;
    settingsService: SettingsService;
    aiService: AIService;
}

/**
 * Accordion component for batch processing functionality
 */
export class BatchProcessorAccordion extends BaseAccordion {
    constructor(
        private dependencies: AccordionDependencies,
        containerEl: HTMLElement
    ) {
        super(containerEl, dependencies.app);
    }

    public render(): void {
        const contentEl = this.createAccordion(
            "🔄 Batch Processor",
            "Process multiple files to generate front matter and wikilinks."
        );
        
        this.createAutoGenerateToggle(contentEl);
        this.createBatchProcessorButton(contentEl);
    }

    /**
     * Create toggle for auto-generate setting
     */
    private createAutoGenerateToggle(containerEl: HTMLElement): void {
        this.addToggle(
            "Auto-generate Front Matter",
            "Automatically generate front matter for new or unprocessed notes when you open your vault.",
            this.dependencies.settingsService.getSettings().frontMatter.autoGenerate,
            async (value: boolean) => {
                try {
                    await this.dependencies.settingsService.updateNestedSetting(
                        'frontMatter', 
                        'autoGenerate', 
                        value
                    );
                    new Notice("Auto-generate Front Matter updated.");
                } catch (error) {
                    console.error('Error updating auto-generate setting:', error);
                    new Notice(`Failed to update setting: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }
        );
    }

    /**
     * Create button to run batch processor
     */
    private createBatchProcessorButton(containerEl: HTMLElement): void {
        this.addButton(
            "Run Batch Processor",
            () => {
                try {
                    const modal = new BatchProcessorModal(
                        this.appInstance,
                        this.dependencies.aiService,
                        this.dependencies.settingsService
                    );
                    modal.open();
                } catch (error) {
                    console.error('Error opening batch processor:', error);
                    new Notice(`Failed to open batch processor: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            },
            true
        );
    }
}