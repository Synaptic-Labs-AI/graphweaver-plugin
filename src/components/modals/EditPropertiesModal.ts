import { Modal, Setting, TextComponent, DropdownComponent, ButtonComponent, Notice, App } from "obsidian";
import { PropertyTag, PropertyType } from "../../models/PropertyTag";

type Callback = (properties: PropertyTag[]) => void;

export class EditPropertiesModal extends Modal {
    public properties: PropertyTag[];
    public onSubmit: Callback;
    public propertyListEl: HTMLElement;
    public selectAllCheckbox: HTMLInputElement;

    constructor(app: App, properties: PropertyTag[], onSubmit: Callback) {
        super(app);
        this.properties = [...properties];
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl("h2", { text: "Edit Properties" });

        this.createSelectAllCheckbox(contentEl);
        this.propertyListEl = contentEl.createDiv({ cls: "gw-modal-property-list" });
        this.renderPropertyList();

        const buttonContainer = contentEl.createDiv({ cls: "gw-modal-button-container" });

        new Setting(buttonContainer)
            .addButton(btn => btn
                .setButtonText("Delete Selected")
                .setWarning()
                .onClick(() => this.deleteSelectedProperties()))
            .addButton(btn => btn
                .setButtonText("Save")
                .setCta()
                .onClick(() => {
                    this.onSubmit(this.properties);
                    this.close();
                }))
            .addButton(btn => btn
                .setButtonText("Cancel")
                .onClick(() => this.close()));
    }

    public createSelectAllCheckbox(containerEl: HTMLElement) {
        const selectAllContainer = containerEl.createDiv({ cls: "gw-select-all-container" });
        this.selectAllCheckbox = selectAllContainer.createEl("input", { type: "checkbox" });
        selectAllContainer.createEl("span", { text: "Select All" });

        this.selectAllCheckbox.addEventListener("change", () => {
            const checkboxes = this.propertyListEl.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach((checkbox: HTMLInputElement) => {
                checkbox.checked = this.selectAllCheckbox.checked;
            });
        });
    }

    public renderPropertyList() {
        this.propertyListEl.empty();

        const table = this.propertyListEl.createEl("table", { cls: "gw-modal-property-table" });
        const headerRow = table.createEl("tr");
        headerRow.createEl("th", { text: "Drag" });
        headerRow.createEl("th", { text: "Name" });
        headerRow.createEl("th", { text: "Description" });
        headerRow.createEl("th", { text: "Type" });
        headerRow.createEl("th", { text: "Delete" });

        this.properties.forEach((property, index) => {
            const row = table.createEl("tr", { attr: { draggable: "true", "data-index": index.toString() } });
            
            row.addEventListener("dragstart", this.onDragStart.bind(this));
            row.addEventListener("dragover", this.onDragOver.bind(this));
            row.addEventListener("drop", this.onDrop.bind(this));

            row.createEl("td", { text: "≡", cls: "gw-drag-handle" });
            this.createEditableCell(row, property, "name", index);
            this.createEditableCell(row, property, "description", index);
            this.createTypeDropdown(row, property, index);

            const deleteCell = row.createEl("td");
            const deleteCheckbox = deleteCell.createEl("input", { type: "checkbox" });
            deleteCheckbox.dataset.index = index.toString();
            deleteCheckbox.addEventListener("change", () => this.updateSelectAllCheckbox());
        });
    }

    public updateSelectAllCheckbox() {
        const checkboxes = this.propertyListEl.querySelectorAll('input[type="checkbox"]');
        const allChecked = Array.from(checkboxes).every((checkbox: HTMLInputElement) => checkbox.checked);
        this.selectAllCheckbox.checked = allChecked;
    }

    public createEditableCell(row: HTMLTableRowElement, property: PropertyTag, field: "name" | "description", index: number) {
        const cell = row.createEl("td");
        const input = new TextComponent(cell);
        input.setValue(property[field])
            .onChange(value => {
                this.properties[index][field] = value;
            });
    }

    public createTypeDropdown(row: HTMLTableRowElement, property: PropertyTag, index: number) {
        const cell = row.createEl("td");
        const dropdown = new DropdownComponent(cell);
        const types: PropertyType[] = ["string", "number", "boolean", "array", "date"];
        
        types.forEach(type => {
            dropdown.addOption(type, type);
        });

        dropdown.setValue(property.type)
            .onChange(value => {
                this.properties[index].type = value as PropertyType;
            });
    }

    public deleteSelectedProperties() {
        const checkboxes = this.propertyListEl.querySelectorAll('input[type="checkbox"]:checked');
        const indicesToDelete = Array.from(checkboxes)
            .map(cb => parseInt((cb as HTMLInputElement).dataset.index || "", 10))
            .sort((a, b) => b - a);

        indicesToDelete.forEach(index => {
            this.properties.splice(index, 1);
        });

        this.renderPropertyList();
        this.updateSelectAllCheckbox();
    }

    public onDragStart(e: DragEvent) {
        const target = e.target as HTMLElement;
        e.dataTransfer?.setData("text/plain", target.dataset.index || "");
    }

    public onDragOver(e: DragEvent) {
        e.preventDefault();
    }

    public onDrop(e: DragEvent) {
        e.preventDefault();
        const fromIndex = parseInt(e.dataTransfer?.getData("text/plain") || "", 10);
        const toIndex = parseInt((e.target as HTMLElement).closest("tr")?.dataset.index || "", 10);

        if (!isNaN(fromIndex) && !isNaN(toIndex)) {
            const [reorderedItem] = this.properties.splice(fromIndex, 1);
            this.properties.splice(toIndex, 0, reorderedItem);
            this.renderPropertyList();
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}