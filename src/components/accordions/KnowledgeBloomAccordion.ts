import { App, Setting, TextComponent, Notice, DropdownComponent } from "obsidian";
import { BaseAccordion } from "./BaseAccordion";
import { SettingsService } from "../../services/SettingsService";
import { AIService } from "../../services/AIService";

export class KnowledgeBloomAccordion extends BaseAccordion {
    private modelSelector: DropdownComponent;
    private templateFolderInput: TextComponent;

    constructor(
        protected app: App,
        containerEl: HTMLElement,
        protected settingsService: SettingsService,
        protected aiService: AIService
    ) {
        super(app, containerEl, settingsService, aiService);
    }

    public render(): void {
        const contentEl = this.createAccordion(
            "🌺 Knowledge Bloom",
            "Generate notes from wikilinks using templates."
        );
        this.createDescription(contentEl);
        this.createModelSelector(contentEl);
        this.createTemplateFolderSetting(contentEl);
    }

    private createDescription(containerEl: HTMLElement): void {
        const descEl = containerEl.createDiv({ cls: "knowledge-bloom-description" });
        descEl.createEl("p", { text: "Knowledge Bloom analyzes your notes, extracts wikilinks, and generates new notes using your templates." });
    }

    private createModelSelector(containerEl: HTMLElement): void {
        const selectorEl = containerEl.createDiv({ cls: "knowledge-bloom-model-selector" });
        new Setting(selectorEl)
            .setName("AI Model")
            .setDesc("Select the AI model to use for Knowledge Bloom")
            .addDropdown(dropdown => {
                this.modelSelector = dropdown;
                this.updateModelOptions();
                dropdown.onChange(async (value) => {
                    await this.settingsService.updateKnowledgeBloomSetting('selectedModel', value);
                    this.aiService.reinitialize(); // Reinitialize AIService with new model
                });
            });
    }

    public updateModelOptions(): void {
        const currentProvider = this.aiService.getCurrentProvider();
        const models = this.aiService.getAvailableModels(currentProvider);
        const currentModel = this.settingsService.getKnowledgeBloomSettings().selectedModel;

        // Clear existing options by setting innerHTML to empty
        this.modelSelector.selectEl.innerHTML = '';

        // Add new options
        models.forEach(model => {
            this.modelSelector.addOption(model, model);
        });

        // Set current value or default
        if (currentModel && models.includes(currentModel)) {
            this.modelSelector.setValue(currentModel);
        } else if (models.length > 0) {
            this.modelSelector.setValue(models[0]);
            // Update settings if no model was previously selected
            this.settingsService.updateKnowledgeBloomSetting('selectedModel', models[0]);
        }
    }

    private createTemplateFolderSetting(containerEl: HTMLElement): void {
        const knowledgeBloomSettings = this.settingsService.getKnowledgeBloomSettings();
        new Setting(containerEl)
            .setName("Templates Folder")
            .setDesc("Path to your templates folder (e.g., 'Templates' or 'Templates/Knowledge Bloom')")
            .addText(text => {
                this.templateFolderInput = text;
                text.setValue(knowledgeBloomSettings.templateFolder)
                    .onChange(async (value) => {
                        await this.settingsService.updateKnowledgeBloomSetting('templateFolder', value);
                        await this.settingsService.saveSettings();
                    });
            });
    }

    // Remove the createGenerateButton and openKnowledgeBloomModal methods as they're no longer needed
}
