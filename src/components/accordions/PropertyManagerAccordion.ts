import { App, TextComponent, TextAreaComponent, DropdownComponent, Setting, Notice } from "obsidian";
import { PropertyTag, PropertyType } from "../../models/PropertyTag";
import { EditPropertiesModal } from "../modals/EditPropertiesModal";
import { BaseAccordion } from "./BaseAccordion";
import { SettingsService } from "../../services/SettingsService";
import { AIService } from "../../services/AIService";

export class PropertyManagerAccordion extends BaseAccordion {
    private nameInput: TextComponent;
    private descriptionInput: TextAreaComponent;
    private typeDropdown: DropdownComponent;

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
            "📊 Property Management",
            "Create and manage custom properties for your notes."
        );
        this.createPropertyEditor(contentEl);
        this.createButtonRow(contentEl);
    }

    private createPropertyEditor(containerEl: HTMLElement): void {
        const settings = this.settingsService.getSettings();
        
        this.nameInput = this.createTextSetting(
            "Property Name",
            "Enter a unique name for this property",
            "Enter property name",
            "",
            { 
                section: "frontMatter", 
                key: "customProperties",
                value: settings.frontMatter.customProperties
            }
        );

        this.descriptionInput = this.createTextAreaSetting(
            "Property Description",
            "Describe the purpose of this property",
            "Enter property description",
            ""
        );

        new Setting(containerEl)
            .setName("Property Type")
            .setDesc("Select the data type for this property")
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

    private createButtonRow(containerEl: HTMLElement): void {
        this.createButton(
            "Add Property",
            "Create a new property",
            "Add Property",
            () => this.addProperty(),
            true
        );

        this.createButton(
            "Edit Properties",
            "Modify or delete existing properties",
            "Edit Properties",
            () => this.openEditModal(),
            false
        );
    }

    public addProperty(): void {
        const name = this.nameInput.getValue().trim();
        const description = this.descriptionInput.getValue()?.trim() || "";
        const type = this.typeDropdown.getValue() as PropertyType;

        if (!name) {
            this.showNotice("Property name cannot be empty.");
            return;
        }

        const settings = this.settingsService.getSettings();
        if (settings.frontMatter.customProperties.some(p => p.name === name)) {
            this.showNotice("A property with this name already exists.");
            return;
        }

        const newProperty: PropertyTag = {
            name,
            description,
            type
        };

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