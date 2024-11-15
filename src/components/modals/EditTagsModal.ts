import { Modal, Setting, TextComponent, TextAreaComponent, App } from "obsidian";
import { Tag } from "../../models/PropertyTag";

type Callback = (tags: Tag[]) => void;

export class EditTagsModal extends Modal {
    public tags: Tag[];
    public onSubmit: Callback;
    public tagListEl: HTMLElement;
    public selectAllCheckbox: HTMLInputElement;

    constructor(app: App, tags: Tag[], onSubmit: Callback) {
        super(app);
        this.tags = [...tags];
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
        this.tagListEl = scrollableContent.createDiv({ cls: 'history-table-container' });
        this.renderTagList();

        // Create button container with proper styling
        const buttonContainer = scrollableContent.createDiv({ 
            cls: 'modal-action-buttons'
        });

        this.createActionButtons(buttonContainer);
    }

    private createHeader(containerEl: HTMLElement): void {
        const header = containerEl.createDiv({ cls: 'modal-header' });
        header.createEl('h2', { 
            text: 'Edit Tags',
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
            const checkboxes = this.tagListEl.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach((checkbox: HTMLInputElement) => {
                checkbox.checked = this.selectAllCheckbox.checked;
            });
        });
    }

    private createActionButtons(containerEl: HTMLElement) {
        new Setting(containerEl)
            .addButton(btn => {
                btn.setButtonText("Delete Selected")
                    .setClass('gw-button-warning')
                    .onClick(() => this.deleteSelectedTags());
                return btn;
            })
            .addButton(btn => {
                btn.setButtonText("Save")
                    .setCta()
                    .setClass('gw-button-primary')
                    .onClick(() => {
                        this.onSubmit(this.tags);
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

    public renderTagList() {
        this.tagListEl.empty();

        const table = this.tagListEl.createEl("table", { 
            cls: "history-table" 
        });

        // Create table header with proper alignment
        const headerRow = table.createEl("tr");
        [
            { text: "Name", cls: "align-left" },
            { text: "Description", cls: "align-left" },
            { text: "Delete", cls: "align-center" }
        ].forEach(header => {
            headerRow.createEl("th", { 
                text: header.text,
                cls: header.cls
            });
        });

        // Create table body with proper styling
        this.tags.forEach((tag, index) => {
            const row = table.createEl("tr");
            
            this.createEditableCell(row, tag, "name", index);
            this.createEditableCell(row, tag, "description", index);

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

    public createEditableCell(row: HTMLTableRowElement, tag: Tag, field: "name" | "description", index: number) {
        const cell = row.createEl("td");

        if (field === "name") {
            const input = new TextComponent(cell);
            input.inputEl.addClass('gw-text-input');
            input.setValue(tag[field])
                .onChange(value => {
                    this.tags[index][field] = value;
                });
        } else {
            const textarea = new TextAreaComponent(cell);
            textarea.inputEl.addClass('gw-textarea-input');
            textarea.setValue(tag[field])
                .onChange(value => {
                    this.tags[index][field] = value;
                });
        }
    }

    public updateSelectAllCheckbox() {
        const checkboxes = this.tagListEl.querySelectorAll('input[type="checkbox"]');
        const allChecked = Array.from(checkboxes).every((checkbox: HTMLInputElement) => checkbox.checked);
        this.selectAllCheckbox.checked = allChecked;
    }

    public deleteSelectedTags() {
        const checkboxes = this.tagListEl.querySelectorAll('input[type="checkbox"]:checked');
        const indicesToDelete = Array.from(checkboxes)
            .map(cb => parseInt((cb as HTMLInputElement).dataset.index || "", 10))
            .sort((a, b) => b - a);

        indicesToDelete.forEach(index => {
            this.tags.splice(index, 1);
        });

        this.renderTagList();
        this.updateSelectAllCheckbox();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
        this.containerEl.removeClass('graphweaver-modal');
    }
}