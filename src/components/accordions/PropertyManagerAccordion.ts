import { App, TextComponent, TextAreaComponent, DropdownComponent } from "obsidian";
import { PropertyTag, PropertyType } from "../../models/PropertyTag";
import { EditPropertiesModal } from "../modals/EditPropertiesModal";
import { BaseAccordion } from "./BaseAccordion";
import { SettingsService } from "../../services/SettingsService";
import { AIService } from "../../services/ai/AIService";

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
        super(containerEl, app);
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

        this.nameInput = this.addTextInput(
            editorContainer,
            "Property Name",
            "Enter property name",
            "Enter property name",
            "",
            (value: string) => {
                // Handle name input change if needed
            }
        );

        this.descriptionInput = this.addTextArea(
            editorContainer,
            "Property Description",
            "Enter property description",
            "Enter property description",
            "",
            (value: string) => {
                // Handle description input change if needed
            }
        );

        this.typeDropdown = this.addDropdown(
            editorContainer,
            "Property Type",
            "Select property type",
            {
                "string": "String",
                "number": "Number",
                "boolean": "Boolean",
                "array": "Array",
                "date": "Date"
            },
            "string",
            (value: string) => {
                // Handle dropdown change if needed
            }
        );
    }

    public createButtonRow(containerEl: HTMLElement): void {
        const buttonContainer = containerEl.createDiv({ cls: "gw-button-container" });

        this.addButton(
            buttonContainer,
            "Edit Properties",
            false,
            () => this.openEditModal()
        );

        this.addButton(
            buttonContainer,
            "Add Property",
            true,
            () => this.addProperty()
        );
    }

    public addProperty(): void {
        const name = this.nameInput.getValue().trim();
        const description = this.descriptionInput.getValue().trim();
        const type = this.typeDropdown.getValue() as PropertyType;

        if (!name) {
            this.showNotice("Property name cannot be empty.");
            return;
        }

        if (!description) {
            this.showNotice("Property description cannot be empty.");
            return;
        }

        const newProperty: PropertyTag = {
            name,
            description,
            type,
            required: false,
            multipleValues: false
        };

        try {
            const settings = this.settingsService.getSettings();
            settings.frontMatter.customProperties.push(newProperty);
            this.settingsService.updateSettings(settings);

            this.showNotice(`Property "${name}" has been added.`);
            this.resetInputs(this.nameInput, this.descriptionInput);
            this.typeDropdown.setValue("string");
        } catch (error) {
            this.handleError("Add Property", error);
        }
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