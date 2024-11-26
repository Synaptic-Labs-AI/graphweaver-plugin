import { App, Setting, TextComponent, TextAreaComponent, DropdownComponent, ButtonComponent, Notice } from "obsidian";
import { PropertyTag, PropertyType } from "../../models/PropertyTag";
import { EditPropertiesModal } from "../modals/EditPropertiesModal";
import { BaseAccordion } from "./BaseAccordion";
import { SettingsService } from "../../services/SettingsService";
import { AIService } from "../../services/AIService";

export class PropertyManagerAccordion extends BaseAccordion {
    public nameInput: TextComponent;
    public descriptionInput: TextAreaComponent;
    public typeDropdown: DropdownComponent;

    constructor(
        public app: App,
        containerEl: HTMLElement,
        public settingsService: SettingsService,
        public aiService: AIService
    ) {
        super(containerEl);
    }

    public render(): void {
        const contentEl = this.createAccordion(
            "📊 Property Management",
            "Create and manage custom properties for your notes."
        );
        this.createPropertyEditor(contentEl);
        this.createButtonRow(contentEl);
    }

    public createPropertyEditor(containerEl: HTMLElement): void {
        const editorContainer = containerEl.createDiv({ cls: "gw-property-editor" });

        new Setting(editorContainer)
            .setName("Property Name")
            .addText(text => {
                this.nameInput = text;
                text.setPlaceholder("Enter property name");
            });

        new Setting(editorContainer)
            .setName("Property Description")
            .addTextArea(textarea => {
                this.descriptionInput = textarea;
                textarea.setPlaceholder("Enter property description");
            });

        new Setting(editorContainer)
            .setName("Property Type")
            .addDropdown(dropdown => {
                this.typeDropdown = dropdown;
                dropdown.addOption("string", "String")
                    .addOption("number", "Number")
                    .addOption("boolean", "Boolean")
                    .addOption("array", "Array")
                    .addOption("date", "Date")
                    .setValue("string");
            });
    }

    public createButtonRow(containerEl: HTMLElement): void {
        const buttonContainer = containerEl.createDiv({ cls: "gw-button-container" });

        new Setting(buttonContainer)
            .addButton(button => button
                .setButtonText("Edit Properties")
                .onClick(() => this.openEditModal()))
            .addButton(button => button
                .setButtonText("Add Property")
                .setCta()
                .onClick(() => this.addProperty()));
    }

    public addProperty(): void {
        const name = this.nameInput.getValue().trim();
        const description = this.descriptionInput.getValue().trim();
        const type = this.typeDropdown.getValue() as PropertyType;

        if (!name) {
            new Notice("Property name cannot be empty.");
            return;
        }

        if (!description) {
            new Notice("Property description cannot be empty.");
            return;
        }

        const newProperty: PropertyTag = {
            name,
            description,
            type,
            required: false,
            multipleValues: false
        };

        const settings = this.settingsService.getSettings();
        settings.frontMatter.customProperties.push(newProperty);
        this.settingsService.updateSettings(settings);

        new Notice(`Property "${name}" has been added.`);
        this.nameInput.setValue("");
        this.descriptionInput.setValue("");
        this.typeDropdown.setValue("string");
    }

    public openEditModal(): void {
        const modal = new EditPropertiesModal(
            this.app,
            this.settingsService.getSettings().frontMatter.customProperties,
            (updatedProperties: PropertyTag[]) => {
                const settings = this.settingsService.getSettings();
                settings.frontMatter.customProperties = updatedProperties;
                this.settingsService.updateSettings(settings);
            }
        );
        modal.open();
    }
}