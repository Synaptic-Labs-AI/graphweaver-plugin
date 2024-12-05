import { App, Setting, DropdownComponent, TextAreaComponent, Notice, ButtonComponent, TFile, TFolder } from "obsidian";
import { AIService } from "../../services/AIService";
import { OntologyResult } from "../../generators/OntologyGenerator";
import { AIProvider, AIModel } from "../../models/AIModels";
import { OntologyInput } from "../../generators/OntologyGenerator";
import { BaseModal } from "./BaseModal";

export class OntologyGeneratorModal extends BaseModal<OntologyResult> {
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

    protected getTitle(): string {
        return "Generate Ontology";
    }

    protected renderContent(): void {
        this.loadingEl.hide();
        this.contentEl.empty();

        this.contentEl.createEl("h2", { text: "Generate Ontology" });
        this.renderVaultStats();
        this.renderModelSelection();
        this.renderGuidedQuestions();  // Moved before user context input
        this.renderUserContextInput(); // Now after guided questions
        this.renderButtons();
    }

    protected async handleSubmit(data: OntologyResult): Promise<void> {
        this.onGenerate(data);
        this.close();
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
        this.addStyles();
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
        const container = this.contentEl.createDiv("user-context-container");
        
        container.createEl("h4", { 
            text: "Additional Context",
            cls: "user-context-header"
        });
        
        container.createEl("p", { 
            text: "Based on the questions above, provide any additional context that might help in generating a more accurate ontology.",
            cls: "user-context-description"
        });

        const textAreaContainer = container.createDiv("text-area-container");
        const textArea = new TextAreaComponent(textAreaContainer)
            .setPlaceholder("Enter your context here...")
            .onChange(value => {
                this.userContextInput = textArea;
            });

        textArea.inputEl.rows = 6;  // Increased rows
        textArea.inputEl.style.width = "100%";
        this.userContextInput = textArea;
    }

    public renderGuidedQuestions() {
        const questionsEl = this.contentEl.createDiv({
            cls: "guided-questions-container"
        });

        questionsEl.createEl("h4", { 
            text: "Consider These Questions",
            cls: "guided-questions-header" 
        });

        const questionsList = questionsEl.createEl("ul", {
            cls: "guided-questions-list"
        });

        [
            "What are the main themes or topics in your knowledge base?",
            "Are there any specific hierarchies or relationships between concepts you want to emphasize?",
            "What are your goals for organizing your knowledge base?",
            "Are there any particular aspects of your notes you want the tags to focus on?"
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
            .onClick(() => this.handleOntologyGeneration());

        new ButtonComponent(buttonContainer)
            .setButtonText("Cancel")
            .onClick(() => this.close());
    }

    public async handleOntologyGeneration() {
        const modelValue = this.modelSelect.getValue();
        if (!modelValue) {
            new Notice("Please select an AI model first.");
            return;
        }

        const [provider, modelApiName] = modelValue.split(':');
        this.generateButton.setDisabled(true);
        const loadingNotice = new Notice("Generating Ontology (this may take a while for large vaults)...", 0);

        try {
            const input: OntologyInput = {
                ...this.vaultStats,
                provider: provider as AIProvider,
                modelApiName,
                userContext: this.userContextInput.getValue()
            };
            // Use chunked generation instead of regular generation
            const ontology = await this.aiService.generateChunkedOntology(input);
            await this.aiService.updateTags(ontology.suggestedTags);
            loadingNotice.hide();
            new Notice(`Ontology generated successfully! Created ${ontology.suggestedTags.length} tags.`, 5000);
            this.onGenerate(ontology);
            this.close();
        } catch (error) {
            loadingNotice.hide();
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            new Notice(`Generation failed: ${errorMessage}`, 10000);
            console.error('Ontology generation error:', error);
        } finally {
            this.generateButton.setDisabled(false);
        }
    }

    public showError(message: string) {
        super.showError(message);
    }

    public onClose() {
        this.contentEl.empty();
    }

    // Add some CSS styles
    private addStyles() {
        document.head.appendChild(createElement('style', {
            attr: { type: 'text/css' },
            text: `
                .ontology-generator-modal .guided-questions-container {
                    margin: 1rem 0;
                    padding: 1rem;
                    background-color: var(--background-secondary);
                    border-radius: 5px;
                }
                
                .ontology-generator-modal .guided-questions-header {
                    margin: 0 0 0.5rem 0;
                    color: var(--text-accent);
                }
                
                .ontology-generator-modal .guided-questions-list {
                    margin: 0.5rem 0;
                    padding-left: 1.5rem;
                }
                
                .ontology-generator-modal .user-context-container {
                    margin: 1rem 0;
                }
                
                .ontology-generator-modal .user-context-header {
                    margin: 0 0 0.5rem 0;
                    color: var(--text-accent);
                }
                
                .ontology-generator-modal .user-context-description {
                    margin: 0 0 1rem 0;
                    color: var(--text-muted);
                }
                
                .ontology-generator-modal .text-area-container {
                    width: 100%;
                    margin-bottom: 1rem;
                }
                
                .ontology-generator-modal .text-area-container textarea {
                    width: 100%;
                    min-height: 120px;
                    padding: 8px;
                    border-radius: 4px;
                    background-color: var(--background-primary);
                    border: 1px solid var(--background-modifier-border);
                }
            `
        }));
    }
}