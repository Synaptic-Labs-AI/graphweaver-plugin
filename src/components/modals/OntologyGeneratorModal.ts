import { Modal, Setting, DropdownComponent, Notice, App, ButtonComponent, TFile, TFolder } from "obsidian";
import { AIService } from "../../services/AIService";
import { OntologyResult } from "../../generators/OntologyGenerator";
import { AIProvider } from "../../models/AIModels";

export class OntologyGeneratorModal extends Modal {
    public modelSelect: DropdownComponent;
    public generateButton: ButtonComponent;
    public loadingEl: HTMLElement;
    public contentEl: HTMLElement;
    public vaultStats: { files: TFile[], folders: TFolder[], tags: string[] };

    constructor(
        public app: App,
        public aiService: AIService,
        public onGenerate: (ontology: OntologyResult) => void
    ) {
        super(app);
        this.vaultStats = { files: [], folders: [], tags: [] };
    }

    public async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("ontology-generator-modal");

        this.loadingEl = contentEl.createDiv("loading-container");
        this.loadingEl.innerHTML = '<div class="spinner"></div><p>Retrieving vault statistics...</p>';

        this.contentEl = contentEl.createDiv("content-container");
        this.contentEl.hide();

        try {
            await this.loadVaultStats();
            this.renderContent();
        } catch (error) {
            console.error("Error loading vault stats:", error);
            this.showError("An error occurred while retrieving vault statistics.");
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
        this.contentEl.show();
        this.contentEl.empty();

        this.contentEl.createEl("h2", { text: "Generate Ontology" });
        this.renderVaultStats();
        this.renderModelSelection();
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

        const availableModels = this.getAvailableModels();
        
        if (availableModels.length === 0) {
            modelSetting.setDesc("No AI models available. Please add API keys in the API Integration settings.");
            return;
        }

        modelSetting.addDropdown(dropdown => {
            this.modelSelect = dropdown;
            availableModels.forEach(model => dropdown.addOption(model.apiName, model.name));
            if (availableModels.length > 0) {
                dropdown.setValue(availableModels[0].apiName);
            }
        });
    }

    public getAvailableModels(): { name: string, apiName: string }[] {
        const providersWithKeys = this.aiService.getProvidersWithApiKeys();
        return providersWithKeys.flatMap(provider => 
            this.aiService.getAvailableModels(provider).map(model => ({
                name: `${provider} - ${model}`,
                apiName: model
            }))
        );
    }

    public renderButtons() {
        const buttonContainer = this.contentEl.createDiv("button-container");
        
        const availableModels = this.getAvailableModels();
        
        this.generateButton = new ButtonComponent(buttonContainer)
            .setButtonText("Generate Ontology")
            .setCta()
            .setDisabled(availableModels.length === 0)
            .onClick(() => this.generateOntology());

        new ButtonComponent(buttonContainer)
            .setButtonText("Cancel")
            .onClick(() => this.close());
    }

    public async generateOntology() {
        const model = this.modelSelect.getValue();
        if (!model) {
            new Notice("Please select an AI model first.");
            return;
        }

        this.generateButton.setDisabled(true);
        const loadingNotice = new Notice("Generating ontology...", 0);

        try {
            const ontology = await this.aiService.generateOntology(this.vaultStats);
            await this.aiService.updateTags(ontology.suggestedTags);
            loadingNotice.hide();
            new Notice("Ontology generated and tags updated successfully!", 3000);
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
        this.contentEl.show();
        this.contentEl.empty();
        this.contentEl.createEl("p", { text: message, cls: "error-message" });
    }

    public onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}