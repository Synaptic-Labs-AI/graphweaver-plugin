// src/components/accordions/KnowledgeBloomAccordion.ts

import { App, Setting, TextAreaComponent, ButtonComponent, Notice, DropdownComponent, TFile } from "obsidian";
import { BaseAccordion } from "./BaseAccordion";
import { SettingsService } from "../../services/SettingsService"; 
import { AIService } from "../../services/ai/AIService";
import { AIModel, AIProvider } from "src/models/AIModels";
import { KnowledgeBloomSettings } from "src/settings/Settings";

// Add type for response
interface KnowledgeBloomResponse {
    generatedNotes: Array<{
        title: string;
        content: string;
    }>;
}

export class KnowledgeBloomAccordion extends BaseAccordion {
    public userPromptInput: TextAreaComponent;
    public modelSelector: DropdownComponent;

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

    /**
     * Handle changes to the AI model selection.
     * Updates the selected model in settings and reinitializes the AI service.
     * @param value The new AI model selected.
     */
    public async handleModelChange(value: string): Promise<void> {
        await this.settingsService.updateKnowledgeBloomSettings({ selectedModel: value });
        try {
            await this.aiService.reinitialize(); // Reinitialize AIService with new model
            new Notice('AI Service reinitialized with the new model.');
        } catch (error) {
            console.error('Failed to reinitialize AI Service:', error);
            new Notice(`Failed to reinitialize AI Service: ${(error as Error).message}`);
        }
    }

    /**
     * Create the AI Model Selector dropdown.
     * @param containerEl The container element to append the dropdown to.
     */
    public createModelSelector(containerEl: HTMLElement): void {
        const selectorEl = containerEl.createDiv({ cls: "knowledge-bloom-model-selector" });
        new Setting(selectorEl)
            .setName("AI Model")
            .setDesc("Select the AI model to use for Knowledge Bloom")
            .addDropdown(dropdown => {
                this.modelSelector = dropdown;
                this.updateModelOptions();
                dropdown.onChange(async (value) => {
                    await this.handleModelChange(value);
                });
            });
    }

    /**
     * Update the options in the AI Model Selector based on available models.
     * Fixed to use correct method and type annotations
     */
    public updateModelOptions(): void {
        const currentProvider = this.aiService.getCurrentProvider();
        // Use getAvailableModels instead
        const models = this.aiService.getAdapterRegistry().getAllAvailableModels();
        const settings = this.settingsService.getSettings();
        const currentModel = settings.knowledgeBloom?.selectedModel;
    
        // Clear existing options
        this.modelSelector.selectEl.innerHTML = '';
    
        // Add new options with proper type annotation
        models.forEach((modelInfo: { provider: AIProvider; model: AIModel }) => {
            this.modelSelector.addOption(modelInfo.model.apiName, modelInfo.model.name);
        });
    
        // Set current value or default
        if (currentModel && models.some((modelInfo) => modelInfo.model.apiName === currentModel)) {
            this.modelSelector.setValue(currentModel);
        } else if (models.length > 0) {
            const defaultModelApiName = models[0].model.apiName;
            this.modelSelector.setValue(defaultModelApiName);
            this.settingsService.updateSettings({
                knowledgeBloom: {
                    ...settings.knowledgeBloom,
                    selectedModel: defaultModelApiName
                }
            });
        }
    }

    /**
     * Create the user prompt input area.
     * @param containerEl The container element to append the input to.
     */
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

    /**
     * Create the generate button.
     * @param containerEl The container element to append the button to.
     */
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

    /**
     * Handle the generate button click event.
     * Updated to use correct parameter passing
     */
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
            // Get the generation service from AIService and use it
            const generationService = this.aiService.getGenerationService();
            const result = await generationService.generateKnowledgeBloom(activeFile, userPrompt);
            
            if (result.generatedNotes.length > 0) {
                await this.createGeneratedNotes(result.generatedNotes);
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
    
    /**
     * Helper method to create or update generated notes
     */
    private async createGeneratedNotes(notes: Array<{title: string; content: string}>): Promise<void> {
        for (const note of notes) {
            const filePath = `${note.title}.md`;
            const existingFile = this.app.vault.getAbstractFileByPath(filePath);
            if (existingFile instanceof TFile) {
                await this.app.vault.modify(existingFile, note.content);
            } else {
                await this.app.vault.create(filePath, note.content);
            }
            }
        }
    }
