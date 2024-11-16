import { App, Modal, Setting, Notice, ButtonComponent, DropdownComponent, TextAreaComponent, TFolder, TFile } from 'obsidian';
import { AIAdapter } from 'src/models/AIModels';
import { AIGenerationService } from 'src/services/ai/AIGenerationService';
import { TagManagementService } from 'src/services/ai/AITagManagementService';
import { AdapterRegistry } from 'src/services/ai/AdapterRegistry';
import { OntologyResult, OntologyInput } from 'src/models/OntologyTypes';
import { AIModelUtils } from 'src/models/AIModels';

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
        provider: string;
        model: string;
    }[];
    private userContextInput: TextAreaComponent;

    constructor(
        app: App,
        private aiAdapter: AIAdapter,
        private aiGenerationService: AIGenerationService,
        private tagManagementService: TagManagementService,
        private onGenerate: (ontology: OntologyResult) => void,
        private adapterRegistry: AdapterRegistry
    ) {
        super(app);
        this.vaultStats = { files: [], folders: [], tags: [] };
        this.availableModels = [];
        this.containerEl.addClass('graphweaver-modal');
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        const modalContent = contentEl.createDiv({ cls: 'modal-content' });
        this.createHeader(modalContent);

        await this.loadVaultStats();

        this.renderVaultStats(modalContent);
        this.renderModelSelection(modalContent);
        this.renderUserContextInput(modalContent);
        this.renderGuidedQuestions(modalContent);
        this.renderButtons(modalContent);
    }

    private createHeader(containerEl: HTMLElement): void {
        const header = containerEl.createDiv({ cls: 'modal-header' });
        header.createEl('h2', { 
            text: 'Generate Ontology',
            cls: 'modal-header-title'
        });
    }

    private async loadVaultStats() {
        this.vaultStats.files = this.app.vault.getMarkdownFiles();
        this.vaultStats.folders = this.app.vault.getAllLoadedFiles().filter(file => file instanceof TFolder) as TFolder[];
        this.vaultStats.tags = await this.getAllTags(this.vaultStats.files);
        this.availableModels = AIModelUtils.getModelsForProvider(this.aiAdapter.getProviderType()).map(model => ({
            provider: this.aiAdapter.getProviderType(),
            model: model.name
        }));
    }

    private async getAllTags(files: TFile[]): Promise<string[]> {
        const tagSet = new Set<string>();
        for (const file of files) {
            const content = await this.app.vault.read(file);
            const tags = this.extractTags(content);
            tags.forEach(tag => tagSet.add(tag));
        }
        return Array.from(tagSet);
    }

    private extractTags(content: string): string[] {
        const tagRegex = /#(\w+)/g;
        const tags = [];
        let match;
        while ((match = tagRegex.exec(content)) !== null) {
            tags.push(match[1]);
        }
        return tags;
    }

    private renderVaultStats(containerEl: HTMLElement) {
        const statsContainer = containerEl.createDiv({ cls: 'stats-container' });

        const stats = [
            { label: "Files", count: this.vaultStats.files.length, icon: "📄" },
            { label: "Folders", count: this.vaultStats.folders.length, icon: "📁" },
            { label: "Tags", count: this.vaultStats.tags.length, icon: "🏷️" }
        ];

        stats.forEach(stat => {
            const card = statsContainer.createDiv({ cls: 'stat-card' });
            card.createSpan({ text: stat.icon, cls: 'stat-icon' });
            card.createEl('div', { text: `${stat.label}: ${stat.count}`, cls: 'stat-text' });
        });
    }

    private renderModelSelection(containerEl: HTMLElement) {
        new Setting(containerEl)
            .setName("AI Model")
            .setDesc("Select the AI model to use for ontology generation")
            .addDropdown(dropdown => {
                this.modelSelect = dropdown;
                this.availableModels.forEach(model => {
                    dropdown.addOption(model.model, model.model);
                });
                dropdown.onChange(value => {
                    // Handle model selection change if needed
                });
            });
    }

    private renderUserContextInput(containerEl: HTMLElement) {
        new Setting(containerEl)
            .setName("Additional Context")
            .setDesc("Provide any additional context or information about your knowledge base.")
            .addTextArea(text => {
                this.userContextInput = text;
                text.setPlaceholder("Enter additional context here...");
            });
    }

    private renderGuidedQuestions(containerEl: HTMLElement) {
        const questionsEl = containerEl.createDiv({ cls: 'guided-questions' });
        questionsEl.createEl("h4", { text: "Guided Questions" });
        const questionsList = questionsEl.createEl("ul", { cls: "questions-list" });

        [
            "What are the main themes or topics in your knowledge base?",
            "Are there any specific hierarchies or relationships between concepts that you want to emphasize?",
            "What are your goals for organizing your knowledge base?"
        ].forEach(question => {
            questionsList.createEl("li", { text: question });
        });
    }

    private renderButtons(containerEl: HTMLElement) {
        const buttonContainer = containerEl.createDiv({ cls: 'button-container' });

        new Setting(buttonContainer)
            .addButton(btn => {
                this.generateButton = btn
                    .setButtonText("Generate")
                    .setCta()
                    .onClick(() => this.generateOntology());
            });

        new Setting(buttonContainer)
            .addButton(btn => btn
                .setButtonText("Cancel")
                .setClass('secondary-button')
                .onClick(() => this.close()));
    }

    private async generateOntology() {
        const model = this.modelSelect.getValue();
        const context = this.userContextInput.getValue();

        if (!model) {
            new Notice('Please select an AI model.');
            return;
        }

        this.generateButton.setDisabled(true);
        this.loadingEl = this.contentEl.createDiv({ cls: "loading-container" });
        this.loadingEl.createEl('span', { text: 'Generating ontology...' });

        try {
            const input: OntologyInput = {
                files: this.vaultStats.files,
                folders: this.vaultStats.folders,
                tags: this.vaultStats.tags,
                provider: this.aiAdapter.getProviderType(),
                modelApiName: model,
                userContext: context
            };

            const ontology = await this.aiGenerationService.generateOntology(input);
            this.onGenerate(ontology);
            new Notice('Ontology generated successfully.');
            this.close();
        } catch (error) {
            new Notice('Error generating ontology.');
        } finally {
            this.generateButton.setDisabled(false);
            this.loadingEl.remove();
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
        this.containerEl.removeClass('graphweaver-modal');
    }
}