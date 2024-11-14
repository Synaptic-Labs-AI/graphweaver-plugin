import { App, Setting, TextComponent, TextAreaComponent, ButtonComponent, Notice } from "obsidian";
import { Tag } from "../../models/PropertyTag";
import { EditTagsModal } from "../modals/EditTagsModal";
import { BaseAccordion } from "./BaseAccordion";
import { SettingsService } from "../../services/SettingsService";
import { AIService } from "../../services/ai/AIService";

export class TagManagerAccordion extends BaseAccordion {
    public nameInput: TextComponent;
    public descriptionInput: TextAreaComponent;

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
            "🏷️ Tag Management",
            "Create and manage custom tags for your notes."
        );
        this.createTagEditor(contentEl);
        this.createButtonRow(contentEl);
    }

    public createTagEditor(containerEl: HTMLElement): void {
        const editorContainer = containerEl.createDiv({ cls: "gw-tag-editor" });

        new Setting(editorContainer)
            .setName("Tag Name")
            .addText(text => {
                this.nameInput = text;
                text.setPlaceholder("Enter tag name");
            });

        new Setting(editorContainer)
            .setName("Tag Description")
            .addTextArea(textarea => {
                this.descriptionInput = textarea;
                textarea.setPlaceholder("Enter tag description");
            });
    }

    public createButtonRow(containerEl: HTMLElement): void {
        const buttonContainer = containerEl.createDiv({ cls: "gw-button-container" });

        new Setting(buttonContainer)
            .addButton(button => button
                .setButtonText("Edit Tags")
                .onClick(() => this.openEditModal()))
            .addButton(button => button
                .setButtonText("Add Tag")
                .setCta()
                .onClick(() => this.addTag()));
    }

    public addTag(): void {
        const name = this.nameInput.getValue().trim();
        const description = this.descriptionInput.getValue().trim();

        if (!name) {
            new Notice("Tag name cannot be empty.");
            return;
        }

        const newTag: Tag = {
            name,
            description,
            type: "string",
            required: false,
            multipleValues: false
        };

        const settings = this.settingsService.getSettings();
        settings.tags.customTags.push(newTag);
        this.settingsService.updateSettings(settings);

        new Notice(`Tag "${name}" has been added.`);
        this.nameInput.setValue("");
        this.descriptionInput.setValue("");
    }

    public openEditModal(): void {
        const modal = new EditTagsModal(
            this.app,
            this.settingsService.getSettings().tags.customTags,
            (updatedTags: Tag[]) => {
                const settings = this.settingsService.getSettings();
                settings.tags.customTags = updatedTags;
                this.settingsService.updateSettings(settings);
            }
        );
        modal.open();
    }
}