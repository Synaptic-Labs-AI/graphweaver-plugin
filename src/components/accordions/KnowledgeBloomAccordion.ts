// src/components/accordions/KnowledgeBloomAccordion.ts

import { App, TextAreaComponent, DropdownComponent, TFile } from "obsidian";
import { BaseAccordion } from "./BaseAccordion";
import { SettingsService } from "../../services/SettingsService"; 
import { AIService } from "../../services/ai/AIService";
import { AIModel, AIProvider } from "src/models/AIModels";

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
            this.showNotice('AI Service reinitialized with the new model.');
        } catch (error) {
            console.error('Failed to reinitialize AI Service:', error);
            this.handleError('Reinitialize AI Service', error);
        }
    }

    /**
     * Create the AI Model Selector dropdown.
     * @param containerEl The container element to append the dropdown to.
     */
    public createModelSelector(containerEl: HTMLElement): void {
        this.modelSelector = this.addDropdown(
            "AI Model",
            "Select the AI model to use for Knowledge Bloom",
            {
                // Example options, should be populated dynamically
            },
            this.settingsService.getSettings().knowledgeBloom?.selectedModel || '',
            async (value: string) => {
                await this.handleModelChange(value);
            }
        );
        this.updateModelOptions();
    }

    /**
     * Update the options in the AI Model Selector based on available models.
     */
    public updateModelOptions(): void {
        const models = this.aiService.getAdapterRegistry().getAllAvailableModels();
        const settings = this.settingsService.getSettings();
        const currentModel = settings.knowledgeBloom?.selectedModel;

        const options: Record<string, string> = {};
        models.forEach((modelInfo: { provider: AIProvider; model: AIModel }) => {
            options[modelInfo.model.apiName] = modelInfo.model.name;
        });

        // Clear existing options
        this.modelSelector.selectEl.innerHTML = '';

        // Add new options
        Object.entries(options).forEach(([key, label]) => {
            this.modelSelector.addOption(key, label);
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
        this.userPromptInput = this.addTextArea(
            "Additional Context",
            "Provide any additional context or instructions for note generation (optional)",
            "Enter your prompts here...",
            "",
            (value: string) => {
                // Handle prompt change if needed
            }
        );
        this.userPromptInput.inputEl.rows = 4;
        this.userPromptInput.inputEl.cols = 50;
    }

    /**
     * Create the generate button.
     * @param containerEl The container element to append the button to.
     */
    public createGenerateButton(containerEl: HTMLElement): void {
        const button = this.addButton(
            "Generate Knowledge Bloom",
            () => this.handleGenerateKnowledgeBloom(),
            true
        );
    }

    /**
     * Handle the generate button click event.
     */
    public async handleGenerateKnowledgeBloom(): Promise<void> {
        try {
            const activeFile = this.app.workspace.getActiveFile();
            if (!(activeFile instanceof TFile)) {
                this.showNotice('No active file found.');
                return;
            }

            const userPrompt = this.userPromptInput.getValue();

            const generationService = this.aiService.getGenerationService();
            const result = await generationService.generateKnowledgeBloom(activeFile, userPrompt);
            if (result && result.generatedNotes) {
                await this.createGeneratedNotes(result.generatedNotes);
                this.showNotice(`Generated ${result.generatedNotes.length} new notes!`);
            } else {
                this.showNotice('No notes were generated.');
            }
        } catch (error) {
            this.handleError("Generate Knowledge Bloom", error);
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