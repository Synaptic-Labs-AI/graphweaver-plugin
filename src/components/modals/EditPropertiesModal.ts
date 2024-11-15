import { Modal, Setting, TextComponent, DropdownComponent, App } from "obsidian";
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
        // Add the graphweaver-modal class to the modal container
        this.containerEl.addClass('graphweaver-modal');
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        // Add modal-specific classes
        contentEl.addClass('status-history-modal');

        // Create modal content with proper structure
        const modalContent = contentEl.createDiv({ cls: 'modal-content' });

        // Create header (fixed at top)
        this.createHeader(modalContent);

        // Create scrollable container
        const scrollableContent = modalContent.createDiv({ cls: 'modal-scrollable-content' });

        // Add content sections
        this.createSelectAllCheckbox(scrollableContent);
        this.propertyListEl = scrollableContent.createDiv({ cls: 'history-table-container' });
        this.renderPropertyList();

        // Create button container with proper styling
        const buttonContainer = scrollableContent.createDiv({ 
            cls: 'modal-action-buttons'
        });

        this.createActionButtons(buttonContainer);
    }

    private createHeader(containerEl: HTMLElement): void {
        const header = containerEl.createDiv({ cls: 'modal-header' });
        header.createEl('h2', { 
            text: 'Edit Properties',
            cls: 'modal-header-title'
        });
    }

    private createSelectAllCheckbox(containerEl: HTMLElement) {
        const selectAllContainer = containerEl.createDiv({ 
            cls: 'gw-accordion-header' 
        });
        
        const titleWrapper = selectAllContainer.createDiv({ 
            cls: 'gw-accordion-title-wrapper' 
        });

        this.selectAllCheckbox = titleWrapper.createEl("input", { 
            type: "checkbox",
            cls: 'gw-checkbox'
        });
        
        titleWrapper.createEl("span", { 
            text: "Select All",
            cls: 'gw-accordion-title'
        });

        this.selectAllCheckbox.addEventListener("change", () => {
            const checkboxes = this.propertyListEl.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach((checkbox: HTMLInputElement) => {
                checkbox.checked = this.selectAllCheckbox.checked;
            });
        });
    }

    public renderPropertyList() {
        this.propertyListEl.empty();

        const table = this.propertyListEl.createEl("table", { 
            cls: "history-table" 
        });
        
        // Create table header
        const headerRow = table.createEl("tr");
        [
            { text: "Drag", cls: "align-center" },
            { text: "Name", cls: "align-left" },
            { text: "Description", cls: "align-left" },
            { text: "Type", cls: "align-left" },
            { text: "Delete", cls: "align-center" }
        ].forEach(header => {
            headerRow.createEl("th", { 
                text: header.text,
                cls: header.cls
            });
        });

        // Create table body
        this.properties.forEach((property, index) => {
            const row = table.createEl("tr", { 
                attr: { 
                    draggable: "true", 
                    "data-index": index.toString() 
                }
            });
            
            row.addEventListener("dragstart", this.onDragStart.bind(this));
            row.addEventListener("dragover", this.onDragOver.bind(this));
            row.addEventListener("drop", this.onDrop.bind(this));

            // Drag handle
            row.createEl("td", { 
                text: "≡", 
                cls: "align-center gw-drag-handle" 
            });

            // Editable cells
            this.createEditableCell(row, property, "name", index);
            this.createEditableCell(row, property, "description", index);
            this.createTypeDropdown(row, property, index);

            // Delete checkbox
            const deleteCell = row.createEl("td", { 
                cls: "align-center" 
            });
            const deleteCheckbox = deleteCell.createEl("input", { 
                type: "checkbox",
                cls: 'gw-checkbox'
            });
            deleteCheckbox.dataset.index = index.toString();
            deleteCheckbox.addEventListener("change", () => this.updateSelectAllCheckbox());
        });
    }

    private createActionButtons(containerEl: HTMLElement) {
        new Setting(containerEl)
            .addButton(btn => {
                btn.setButtonText("Delete Selected")
                    .setClass('gw-button-warning')
                    .onClick(() => this.deleteSelectedProperties());
                return btn;
            })
            .addButton(btn => {
                btn.setButtonText("Save")
                    .setCta()
                    .setClass('gw-button-primary')
                    .onClick(() => {
                        this.onSubmit(this.properties);
                        this.close();
                    });
                return btn;
            })
            .addButton(btn => {
                btn.setButtonText("Cancel")
                    .setClass('gw-button-secondary')
                    .onClick(() => this.close());
                return btn;
            });

        containerEl.addClass('gw-button-container');
    }

    private createEditableCell(row: HTMLTableRowElement, property: PropertyTag, field: "name" | "description", index: number) {
        const cell = row.createEl("td");
        const input = new TextComponent(cell);
        input.inputEl.addClass('gw-text-input');
        input.setValue(property[field])
            .onChange(value => {
                this.properties[index][field] = value;
            });
    }

    private createTypeDropdown(row: HTMLTableRowElement, property: PropertyTag, index: number) {
        const cell = row.createEl("td");
        const dropdown = new DropdownComponent(cell);
        const types: PropertyType[] = ["string", "number", "boolean", "array", "date"];
        
        dropdown.selectEl.addClass('gw-dropdown');
        types.forEach(type => {
            dropdown.addOption(type, type);
        });

        dropdown.setValue(property.type)
            .onChange(value => {
                this.properties[index].type = value as PropertyType;
            });
    }

    public updateSelectAllCheckbox() {
        const checkboxes = this.propertyListEl.querySelectorAll('input[type="checkbox"]');
        const allChecked = Array.from(checkboxes).every((checkbox: HTMLInputElement) => checkbox.checked);
        this.selectAllCheckbox.checked = allChecked;
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
        target.addClass('dragging');
    }

    public onDragOver(e: DragEvent) {
        e.preventDefault();
        const target = e.target as HTMLElement;
        target.closest('tr')?.addClass('drag-over');
    }

    public onDrop(e: DragEvent) {
        e.preventDefault();
        const fromIndex = parseInt(e.dataTransfer?.getData("text/plain") || "", 10);
        const toIndex = parseInt((e.target as HTMLElement).closest("tr")?.dataset.index || "", 10);

        document.querySelectorAll('.dragging, .drag-over').forEach(el => {
            el.removeClass('dragging');
            el.removeClass('drag-over');
        });

        if (!isNaN(fromIndex) && !isNaN(toIndex)) {
            const [reorderedItem] = this.properties.splice(fromIndex, 1);
            this.properties.splice(toIndex, 0, reorderedItem);
            this.renderPropertyList();
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
        this.containerEl.removeClass('graphweaver-modal');
    }
}