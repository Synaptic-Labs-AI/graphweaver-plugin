import { App, Notice, TextComponent, TextAreaComponent } from "obsidian";
import { Tag } from "../../models/PropertyTag";
import { EditTagsModal } from "../modals/EditTagsModal";
import { BaseAccordion } from "./BaseAccordion";
import { SettingsService } from "../../services/SettingsService";
import { AIService } from "../../services/AIService";

export class TagManagerAccordion extends BaseAccordion {
    private nameInput: TextComponent;
    private descriptionInput: TextAreaComponent;

    constructor(
        protected app: App,
        protected containerEl: HTMLElement,
        protected settingsService: SettingsService,
        protected aiService: AIService
    ) {
        super(app, containerEl, settingsService, aiService);
    }

    public render(): void {
        const contentEl = this.createAccordion(
            "🏷️ Tag Management",
            "Create and manage custom tags for your notes."
        );
        this.createTagEditor(contentEl);
        this.createButtonRow(contentEl);
    }

    private createTagEditor(containerEl: HTMLElement): void {
        const settings = this.settingsService.getSettings();

        this.nameInput = this.createTextSetting(
            "Tag Name",
            "Enter a unique name for this tag",
            "Enter tag name",
            "",
            { 
                section: "tags", 
                key: "customTags",
                value: settings.tags.customTags
            }
        );

        this.descriptionInput = this.createTextAreaSetting(
            "Tag Description",
            "Describe the purpose of this tag",
            "Enter tag description",
            ""
        );
    }

    private createButtonRow(containerEl: HTMLElement): void {
        this.createButton(
            "Add Tag",
            "Create a new tag",
            "Add Tag",
            () => this.addTag(),
            true
        );

        this.createButton(
            "Edit Tags",
            "Modify or delete existing tags",
            "Edit Tags",
            () => this.openEditModal(),
            false
        );
    }

    public addTag(): void {
        const name = this.nameInput.getValue().trim();
        const description = this.descriptionInput.getValue()?.trim() || "";

        if (!name) {
            this.showNotice("Tag name cannot be empty.");
            return;
        }

        const settings = this.settingsService.getSettings();
        if (settings.tags.customTags.some(t => t.name === name)) {
            this.showNotice("A tag with this name already exists.");
            return;
        }

        const newTag: Tag = {
            name,
            description,
            type: "string",
        };

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