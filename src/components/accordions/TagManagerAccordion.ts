import { App, TextComponent, TextAreaComponent, Notice } from "obsidian";
import { Tag } from "../../models/PropertyTag";
import { EditTagsModal } from "../modals/EditTagsModal";
import { BaseAccordion } from "./BaseAccordion";
import { SettingsService } from "../../services/SettingsService";
import { AIService } from "../../services/ai/AIService";

export class TagManagerAccordion extends BaseAccordion {
    private nameInput: TextComponent;
    private descriptionInput: TextAreaComponent;

    constructor(
        app: App,
        containerEl: HTMLElement,
        private settingsService: SettingsService,
        private aiService: AIService
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

    private createTagEditor(containerEl: HTMLElement): void {
        this.nameInput = this.addTextInput(
            containerEl,
            "Tag Name",
            "Enter the name of the tag.",
            "Enter tag name",
            "",
            (value: string) => {
                // Handle name input change if needed
            }
        );

        this.descriptionInput = this.addTextArea(
            containerEl,
            "Tag Description",
            "Enter a description for the tag.",
            "Enter tag description",
            "",
            (value: string) => {
                // Handle description input change if needed
            }
        );
    }

    private createButtonRow(containerEl: HTMLElement): void {
        this.addButton(containerEl, "Edit Tags", false, () => this.openEditModal());
        this.addButton(containerEl, "Add Tag", true, () => this.addTag());
    }

    private addTag(): void {
        const name = this.nameInput.getValue().trim();
        const description = this.descriptionInput.getValue().trim();

        if (!name) {
            this.showNotice("Tag name cannot be empty.");
            return;
        }

        const newTag: Tag = {
            name,
            description,
            type: "string",
            required: false,
            multipleValues: false
        };

        try {
            const settings = this.settingsService.getSettings();
            settings.tags.customTags.push(newTag);
            this.settingsService.updateSettings(settings);
            this.showNotice(`Tag "${name}" has been added.`);
            this.resetInputs(this.nameInput, this.descriptionInput);
        } catch (error) {
            this.handleError("Add Tag", error);
        }
    }

    private openEditModal(): void {
        const modal = new EditTagsModal(
            this.appInstance,
            this.settingsService.getSettings().tags.customTags,
            (updatedTags: Tag[]) => {
                try {
                    const settings = this.settingsService.getSettings();
                    settings.tags.customTags = updatedTags;
                    this.settingsService.updateSettings(settings);
                } catch (error) {
                    this.handleError("Edit Tags", error);
                }
            }
        );
        modal.open();
    }
}