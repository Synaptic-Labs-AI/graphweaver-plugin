import { App, Setting, DropdownComponent, TextAreaComponent, ButtonComponent, TFile, Notice } from "obsidian";
import { SettingsService } from "../../services/SettingsService";
import { AIService } from "../../services/AIService";
import { BaseModal } from "./BaseModal";

export class KnowledgeBloomModal extends BaseModal<void> {
    private templateSelect: DropdownComponent;
    private contextInput: TextAreaComponent;
    private generateButton: ButtonComponent;
    private templates: TFile[] = [];

    constructor(
        app: App,
        private sourceFile: TFile,
        private settingsService: SettingsService,
        private aiService: AIService
    ) {
        super(app);
    }

    protected getTitle(): string {
        return "Knowledge Bloom Generator";
    }

    async onOpen() {
        this.titleEl.setText("Knowledge Bloom Generator");
        await this.loadTemplates();
        this.renderContent();
    }

    private async loadTemplates() {
        const templateFolder = this.settingsService.getSettings().knowledgeBloom?.templateFolder || "";
        if (!templateFolder) {
            new Notice("Please set a templates folder in Knowledge Bloom settings.");
            return;
        }

        try {
            const folder = this.app.vault.getAbstractFileByPath(templateFolder);
            if (!folder) throw new Error("Templates folder not found");

            // Get all markdown files in the template folder
            this.templates = await this.app.vault.getAllLoadedFiles()
                .filter(file => 
                    file instanceof TFile && 
                    file.extension === "md" && 
                    file.path.startsWith(templateFolder)
                ) as TFile[];
        } catch (error) {
            console.error("Error loading templates:", error);
            new Notice("Failed to load templates. Check your template folder path.");
        }
    }

    protected renderContent(): void {
        const { contentEl } = this;

        // Template Selection
        new Setting(contentEl)
            .setName("Note Template")
            .setDesc("Select a template for the generated notes")
            .addDropdown(dropdown => {
                this.templateSelect = dropdown;
                this.templates.forEach(template => {
                    dropdown.addOption(template.path, template.basename);
                });
            });

        // Additional Context
        new Setting(contentEl)
            .setName("Additional Context")
            .setDesc("Provide any additional context for note generation")
            .addTextArea(text => {
                this.contextInput = text;
                text.inputEl.rows = 4;
                text.inputEl.cols = 50;
                return text;
            });

        // Buttons
        const buttonContainer = contentEl.createDiv("button-container");
        new Setting(buttonContainer)
            .addButton(button => {
                this.generateButton = button;
                button
                    .setButtonText("Generate Notes")
                    .setCta()
                    .onClick(() => this.handleGenerate());
            })
            .addButton(button => 
                button
                    .setButtonText("Cancel")
                    .onClick(() => this.close())
            );
    }

    protected async handleSubmit(): Promise<void> {
        this.close();
    }

    private async handleGenerate() {
        const templatePath = this.templateSelect.getValue();
        if (!templatePath) {
            new Notice("Please select a template first.");
            return;
        }

        this.close();
        new Notice("Generating knowledge bloom...");

        try {
            const templateFile = this.app.vault.getAbstractFileByPath(templatePath) as TFile;
            const template = await this.app.vault.read(templateFile);
            const result = await this.aiService.generateKnowledgeBloom(
                this.sourceFile,
                this.contextInput.getValue(),
                template
            );

            if (result.generatedNotes.length > 0) {
                new Notice(`Generated ${result.generatedNotes.length} new notes!`);
            } else {
                new Notice("No new notes were generated.");
            }
        } catch (error) {
            new Notice(`Failed to generate notes: ${(error as Error).message}`);
        }
    }
}