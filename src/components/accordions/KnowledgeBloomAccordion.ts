import { App, Setting, TextAreaComponent, ButtonComponent, Notice, DropdownComponent, TFile } from "obsidian";
import { BaseAccordion } from "./BaseAccordion";
import { SettingsService } from "../../services/SettingsService";
import { AIService } from "../../services/AIService";

export class KnowledgeBloomAccordion extends BaseAccordion {
    public userPromptInput: TextAreaComponent;
    public modelSelector: DropdownComponent;

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
            "🌺 Knowledge Bloom",
            "Generate notes from wikilinks in your current note."
        );
        this.createDescription(contentEl);
        this.createModelSelector(contentEl);
        this.createUserPromptInput(contentEl);
        this.createGenerateButton(contentEl);
    }

    public createDescription(containerEl: HTMLElement): void {
        const descEl = containerEl.createDiv({ cls: "knowledge-bloom-description" });
        descEl.createEl("p", { text: "Knowledge Bloom analyzes the current note, extracts wikilinks, and generates new notes for each link. This helps expand your knowledge base and create connections between ideas." });
        
        descEl.createEl("p", { text: "For best results, we recommend using Perplexity models as they can search online for up-to-date information." });

        const listEl = descEl.createEl("ul");
        [
            "Automatically creates notes for missing links",
            "Generates content based on the context of your note",
            "Helps build a more comprehensive knowledge graph",
            "Saves time on manual note creation and research"
        ].forEach(item => {
            listEl.createEl("li", { text: item });
        });
    }

    public createModelSelector(containerEl: HTMLElement): void {
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

    public createUserPromptInput(containerEl: HTMLElement): void {
        const promptEl = containerEl.createDiv({ cls: "knowledge-bloom-prompt" });
        new Setting(promptEl)
            .setName("Additional Context")
            .setDesc("Provide any additional context or instructions for note generation (optional)")
            .addTextArea(text => {
                this.userPromptInput = text;
                text.inputEl.rows = 4;
                text.inputEl.cols = 50;
                return text;
            });
    }

    public createGenerateButton(containerEl: HTMLElement): void {
        const buttonEl = containerEl.createDiv({ cls: "knowledge-bloom-generate-button" });
        new Setting(buttonEl)
            .addButton((button: ButtonComponent) => {
                button
                    .setButtonText("Generate Knowledge Bloom")
                    .setCta()
                    .onClick(() => this.handleGenerateKnowledgeBloom(button));
            });
    }

    public async handleGenerateKnowledgeBloom(button: ButtonComponent): Promise<void> {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice("No active file. Please open a file to generate Knowledge Bloom.");
            return;
        }
        
        button.setDisabled(true);
        button.setButtonText("Generating...");
        
        try {
            const userPrompt = this.userPromptInput.getValue();
            const result = await this.aiService.generateKnowledgeBloom(activeFile, userPrompt);
            
            if (result.generatedNotes.length > 0) {
                // Create or update the generated notes in Obsidian
                for (const note of result.generatedNotes) {
                    const filePath = `${note.title}.md`;
                    const existingFile = this.app.vault.getAbstractFileByPath(filePath);
                    if (existingFile && existingFile instanceof TFile) {
                        await this.app.vault.modify(existingFile, note.content);
                    } else {
                        await this.app.vault.create(filePath, note.content);
                    }
                }
                new Notice(`Generated ${result.generatedNotes.length} new notes!`);
            } else {
                new Notice("No new notes were generated.");
            }
        } catch (error) {
            console.error("Error generating Knowledge Bloom:", error);
            new Notice(`Failed to generate Knowledge Bloom: ${(error as Error).message}`);
        } finally {
            button.setDisabled(false);
            button.setButtonText("Generate Knowledge Bloom");
        }
    }
}
