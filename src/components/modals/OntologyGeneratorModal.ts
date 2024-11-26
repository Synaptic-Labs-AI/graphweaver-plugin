import { Modal, App, Setting, DropdownComponent, TextAreaComponent, Notice, ButtonComponent, TFile, TFolder } from "obsidian";
import { AIService } from "../../services/AIService";
import { OntologyResult } from "../../generators/OntologyGenerator";
import { AIProvider, AIModel } from "../../models/AIModels";
import { OntologyInput } from "../../models/OntologyTypes";

export class OntologyGeneratorModal extends Modal {
    public modelSelect: DropdownComponent;
    public generateButton: ButtonComponent;
    public loadingEl: HTMLElement;
    public vaultStats: { files: TFile[], folders: TFolder[], tags: string[] };
    public availableModels: { provider: AIProvider; model: AIModel }[];
    public userContextInput: TextAreaComponent;

    constructor(
        app: App,
        public aiService: AIService,
        public onGenerate: (ontology: OntologyResult) => void
    ) {
        super(app);
        this.vaultStats = { files: [], folders: [], tags: [] };
        this.availableModels = [];
    }

    public async onOpen() {
        this.contentEl.empty();
        this.contentEl.addClass("ontology-generator-modal");

        this.loadingEl = this.contentEl.createDiv("loading-container");
        this.loadingEl.innerHTML = '<div class="spinner"></div><p>Retrieving vault statistics and available models...</p>';

        try {
            await this.loadVaultStats();
            this.availableModels = this.aiService.getAllAvailableModels();
            this.renderContent();
        } catch (error) {
            console.error("Error loading data:", error);
            this.showError("An error occurred while retrieving data.");
        }
    }

    public async loadVaultStats() {
        this.vaultStats.files = this.app.vault.getMarkdownFiles();
        this.vaultStats.folders = this.app.vault.getAllLoadedFiles().filter(file => file instanceof TFolder) as TFolder[];
        this.vaultStats.tags = await this.getAllTags(this.vaultStats.files);
    }

    public async getAllTags(files: TFile[]): Promise<string[]> {
        const tagSet = new Set<string>();
        for (const file of files) {
            const content = await this.app.vault.read(file);
            const tags = content.match(/#[\w-]+/g);
            if (tags) {
                tags.forEach(tag => tagSet.add(tag));
            }
        }
        return Array.from(tagSet);
    }

    public renderContent() {
        this.loadingEl.hide();
        this.contentEl.empty();

        this.contentEl.createEl("h2", { text: "Generate Ontology" });
        this.renderVaultStats();
        this.renderModelSelection();
        this.renderUserContextInput();
        this.renderGuidedQuestions();
        this.renderButtons();
    }

    public renderVaultStats() {
        const statsEl = this.contentEl.createDiv("vault-stats");
        statsEl.createEl("h3", { text: "Vault Statistics" });
        const listEl = statsEl.createEl("ul");
        listEl.createEl("li", { text: `Files: ${this.vaultStats.files.length}` });
        listEl.createEl("li", { text: `Folders: ${this.vaultStats.folders.length}` });
        listEl.createEl("li", { text: `Tags: ${this.vaultStats.tags.length}` });
    }

    public renderModelSelection() {
        const modelSetting = new Setting(this.contentEl)
            .setName("AI Model")
            .setDesc("Select the AI model to use for ontology generation");

        if (this.availableModels.length === 0) {
            modelSetting.setDesc("No AI models available. Please add API keys in the API Integration settings.");
            return;
        }

        modelSetting.addDropdown(dropdown => {
            this.modelSelect = dropdown;
            this.availableModels.forEach(({ provider, model }) => {
                const optionText = `${provider} - ${model.name}`;
                dropdown.addOption(`${provider}:${model.apiName}`, optionText);
            });
            if (this.availableModels.length > 0) {
                const firstModel = this.availableModels[0];
                dropdown.setValue(`${firstModel.provider}:${firstModel.model.apiName}`);
            }
        });
    }

    public renderUserContextInput() {
        const contextSetting = new Setting(this.contentEl)
            .setName("Additional Context")
            .setDesc("Provide any additional context or information about your knowledge base that might help in generating a more accurate ontology.")
            .addTextArea(text => {
                this.userContextInput = text; // Store the TextAreaComponent
                text.inputEl.rows = 4;
                text.inputEl.cols = 50;
                return text;
            });
    }

    public renderGuidedQuestions() {
        const questionsEl = this.contentEl.createDiv("guided-questions");
        questionsEl.createEl("h4", { text: "Guided Questions" });
        questionsEl.createEl("p", { text: "Consider the following questions when providing additional context:" });
        const questionsList = questionsEl.createEl("ul");
        [
            "What are the main themes or topics in your knowledge base?",
            "Are there any specific hierarchies or relationships between concepts that you want to emphasize?",
            "What are your goals for organizing your knowledge base?"
        ].forEach(question => {
            questionsList.createEl("li", { text: question });
        });
    }

    public renderButtons() {
        const buttonContainer = this.contentEl.createDiv("button-container");
        
        this.generateButton = new ButtonComponent(buttonContainer)
            .setButtonText("Generate Ontology")
            .setCta()
            .setDisabled(this.availableModels.length === 0)
            .onClick(() => this.generateOntology());

        new ButtonComponent(buttonContainer)
            .setButtonText("Cancel")
            .onClick(() => this.close());
    }

    public async generateOntology() {
        const modelValue = this.modelSelect.getValue();
        if (!modelValue) {
            new Notice("Please select an AI model first.");
            return;
        }

        const [provider, modelApiName] = modelValue.split(':');
        this.generateButton.setDisabled(true);
        const loadingNotice = new Notice("Generating ontology...", 0);

        try {
            const input: OntologyInput = {
                ...this.vaultStats,
                provider: provider as AIProvider,
                modelApiName,
                userContext: this.userContextInput.getValue()
            };
            const ontology = await this.aiService.generateOntology(input);
            await this.aiService.updateTags(ontology.suggestedTags);
            loadingNotice.hide();
            new Notice("Ontology generated and tags updated successfully!", 3000);
            this.onGenerate(ontology);
            this.close();
        } catch (error) {
            console.error("Error generating ontology:", error);
            loadingNotice.hide();
            new Notice(`Failed to generate ontology: ${(error as Error).message}`, 5000);
        } finally {
            this.generateButton.setDisabled(false);
        }
    }

    public showError(message: string) {
        this.loadingEl.hide();
        this.contentEl.empty();
        this.contentEl.createEl("p", { text: message, cls: "error-message" });
    }

    public onClose() {
        this.contentEl.empty();
    }
}