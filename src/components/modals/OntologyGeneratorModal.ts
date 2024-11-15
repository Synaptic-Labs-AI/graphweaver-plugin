import { Modal, App, Setting, DropdownComponent, TextAreaComponent, Notice, ButtonComponent, TFile, TFolder, setIcon } from "obsidian";
import styles from 'styles.css';
import { AIService } from "../../services/ai/AIService";
import { AIGenerationService } from "../../services/ai/AIGenerationService"; 
import { TagManagementService } from "../../services/ai/AITagManagementService";
import { AdapterRegistry } from "../../services/ai/AdapterRegistry";
import { AIProvider, AIModel } from "../../models/AIModels";
import { OntologyInput, OntologyResult } from "../../models/OntologyTypes";

export class OntologyGeneratorModal extends Modal {
    private modelSelect: DropdownComponent;
    private generateButton: ButtonComponent;
    private loadingEl: HTMLElement;
    private vaultStats: {
        files: TFile[];
        folders: TFolder[];
        tags: string[];
    };
    private availableModels: {
        provider: AIProvider;
        model: AIModel;
    }[];
    private userContextInput: TextAreaComponent;
    private shadowRootEl: ShadowRoot;

    constructor(
        app: App,
        private aiService: AIService,
        private aiGenerationService: AIGenerationService,
        private tagManagementService: TagManagementService,
        private onGenerate: (ontology: OntologyResult) => void,
        private adapterRegistry: AdapterRegistry
    ) {
        super(app);
        this.vaultStats = { files: [], folders: [], tags: [] };
        this.availableModels = [];
    }

    public async onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        const modalContent = contentEl.createDiv({ cls: "modal-content" });
        const shadowContainer = modalContent.createDiv({ cls: "shadow-container" });
        this.shadowRootEl = shadowContainer.attachShadow({ mode: "open" });

        this.injectStyles(this.shadowRootEl);
        const shadowWrapper = this.shadowRootEl.createDiv({ cls: "shadow-wrapper" });
        this.createLoadingState(shadowWrapper);

        try {
            await this.loadVaultStats();
            this.availableModels = this.adapterRegistry.getAllAvailableModels();
            this.renderContent(shadowWrapper);
        } catch (error) {
            console.error("Error loading data:", error);
            this.showError(shadowWrapper, "An error occurred while retrieving data.");
        }
    }

    private injectStyles(shadowRoot: ShadowRoot) {
        const style = document.createElement("style");
        style.textContent = styles;
        shadowRoot.appendChild(style);
    }

    private async loadVaultStats() {
        this.vaultStats.files = this.app.vault.getMarkdownFiles();
        this.vaultStats.folders = this.app.vault
            .getAllLoadedFiles()
            .filter((file) => file instanceof TFolder) as TFolder[];
        this.vaultStats.tags = await this.getAllTags(this.vaultStats.files);
    }

    private async getAllTags(files: TFile[]): Promise<string[]> {
        const tagSet = new Set<string>();
        for (const file of files) {
            const content = await this.app.vault.read(file);
            const tags = content.match(/#[\w-]+/g);
            if (tags) {
                tags.forEach((tag) => tagSet.add(tag));
            }
        }
        return Array.from(tagSet);
    }

    private renderContent(containerEl: HTMLElement) {
        this.loadingEl.remove();
        this.renderVaultStats(containerEl);
        this.renderModelSelection(containerEl);
        this.renderUserContextInput(containerEl);
        this.renderGuidedQuestions(containerEl);
        this.renderButtons(containerEl);
    }

    private renderVaultStats(containerEl: HTMLElement) {
        // 📊 Create the stats container
        const statsEl = containerEl.createDiv({ cls: "status-summary" });
        const summaryGrid = statsEl.createDiv({ cls: "summary-grid" });
        
        // 🎯 Define stat items with their icons
        const items = [
            { label: "Files", value: this.vaultStats.files.length, icon: "file-text" },
            { label: "Folders", value: this.vaultStats.folders.length, icon: "folder" },
            { label: "Tags", value: this.vaultStats.tags.length, icon: "tag" }
        ];
        
        // 🎨 Render each stat card
        items.forEach((item) => {
            const itemEl = summaryGrid.createDiv({ cls: "summary-item" });
            
            const iconEl = itemEl.createDiv({ cls: "summary-icon" });
            setIcon(iconEl, item.icon);
            
            const valueEl = itemEl.createDiv({ cls: "summary-value" });
            valueEl.setText(item.value.toString());
            
            const labelEl = itemEl.createDiv({ cls: "summary-label" });
            labelEl.setText(item.label);
        });
    }

    private renderModelSelection(containerEl: HTMLElement) {
        const settingContainer = containerEl.createDiv({ cls: "gw-accordion" });
        
        new Setting(settingContainer)
            .setName("AI Model")
            .setDesc("Select the AI model to use for ontology generation")
            .addDropdown((dropdown) => {
                this.modelSelect = dropdown;
                dropdown.selectEl.classList.add("gw-dropdown");

                if (this.availableModels.length === 0) {
                    dropdown.setDisabled(true);
                    return;
                }

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

    private renderUserContextInput(containerEl: HTMLElement) {
        const settingContainer = containerEl.createDiv({ cls: "gw-accordion" });
        
        new Setting(settingContainer)
            .setName("Additional Context")
            .setDesc("Provide any additional context or information about your knowledge base.")
            .addTextArea((text) => {
                this.userContextInput = text;
                text.inputEl.classList.add("gw-textarea-input");
                text.inputEl.rows = 4;
                text.inputEl.cols = 50;
                return text;
            });
    }

    private renderGuidedQuestions(containerEl: HTMLElement) {
        const questionsEl = containerEl.createDiv({ cls: "gw-accordion" });
        const header = questionsEl.createDiv({ cls: "gw-accordion-header" });
        
        header.createEl("h4", {
            text: "Guided Questions",
            cls: "gw-accordion-title"
        });

        const content = questionsEl.createDiv({ cls: "gw-accordion-content" });
        
        content.createEl("p", {
            text: "Consider the following questions when providing additional context:"
        });

        const questionsList = content.createEl("ul", { cls: "gw-list" });
        
        [
            "What are the main themes or topics in your knowledge base?",
            "Are there any specific hierarchies or relationships between concepts that you want to emphasize?",
            "What are your goals for organizing your knowledge base?"
        ].forEach((question) => {
            questionsList.createEl("li", { text: question });
        });
    }

    private renderButtons(containerEl: HTMLElement) {
        new Setting(containerEl)
            .addButton((btn) => {
                this.generateButton = btn;
                btn.setButtonText("Generate Ontology")
                    .setCta()
                    .setClass("gw-button");
                btn.buttonEl.classList.add("gw-button-primary");
                btn.setDisabled(this.availableModels.length === 0)
                    .onClick(() => this.generateOntology());
                return btn;
            })
            .addButton((btn) => {
                btn.setButtonText("Cancel")
                    .setClass("gw-button");
                btn.buttonEl.classList.add("gw-button-secondary");
                btn.onClick(() => this.close());
                return btn;
            });

        containerEl.classList.add("gw-button-container");
    }

    private async generateOntology() {
        const modelValue = this.modelSelect.getValue();
        if (!modelValue) {
            new Notice("Please select an AI model first.");
            return;
        }

        const [provider, modelApiName] = modelValue.split(":");
        this.generateButton.setDisabled(true);
        const loadingEl = this.createGeneratingState();

        try {
            const input: OntologyInput = {
                files: this.vaultStats.files,
                folders: this.vaultStats.folders,
                tags: this.vaultStats.tags,
                provider: provider as AIProvider,
                modelApiName,
                userContext: this.userContextInput.getValue()
            };

            const ontology = await this.aiGenerationService.generateOntology(input);
            await this.tagManagementService.updateTags(ontology.suggestedTags);
            
            loadingEl.remove();
            new Notice("Ontology generated and tags updated successfully!");
            this.onGenerate(ontology);
            this.close();
        } catch (error) {
            console.error("Error generating ontology:", error);
            loadingEl.remove();
            this.showError(
                this.shadowRootEl.host as HTMLElement,
                `Failed to generate ontology: ${(error as Error).message}`
            );
        } finally {
            this.generateButton.setDisabled(false);
        }
    }

    private showError(containerEl: HTMLElement, message: string) {
        this.loadingEl.remove();
        const errorEl = containerEl.createDiv({ cls: "error-container status-error" });
        
        const iconEl = errorEl.createDiv({ cls: "gw-status-bar-icon" });
        setIcon(iconEl, "alert-circle");
        
        errorEl.createEl("p", {
            text: message,
            cls: "error-message"
        });
    }

    private createLoadingState(containerEl: HTMLElement): void {
        this.loadingEl = containerEl.createDiv({ cls: "loading-container status-running" });
        
        const spinner = this.loadingEl.createDiv({ cls: "gw-status-bar-icon" });
        setIcon(spinner, "loader");
        
        this.loadingEl.createEl("p", {
            text: "Retrieving vault statistics and available models...",
            cls: "loading-text"
        });
    }

    private createGeneratingState(): HTMLElement {
        const loadingEl = this.shadowRootEl.host.createDiv({ cls: "loading-container status-running" });
        
        const spinner = loadingEl.createDiv({ cls: "gw-status-bar-icon" });
        setIcon(spinner, "loader");
        
        loadingEl.createEl("p", {
            text: "Generating ontology...",
            cls: "loading-text"
        });
        
        return loadingEl;
    }

    onClose() {
        this.contentEl.empty();
    }
}