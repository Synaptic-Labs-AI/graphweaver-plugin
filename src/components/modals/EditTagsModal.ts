import { Modal, Setting, TextComponent, TextAreaComponent, ButtonComponent, Notice, App } from "obsidian";
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
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl("h2", { text: "Edit Tags" });

        this.createSelectAllCheckbox(contentEl);
        this.tagListEl = contentEl.createDiv({ cls: "gw-modal-tag-list" });
        this.renderTagList();

        const buttonContainer = contentEl.createDiv({ cls: "gw-modal-button-container" });

        new Setting(buttonContainer)
            .addButton(btn => btn
                .setButtonText("Delete Selected")
                .setWarning()
                .onClick(() => this.deleteSelectedTags()))
            .addButton(btn => btn
                .setButtonText("Save")
                .setCta()
                .onClick(() => {
                    this.onSubmit(this.tags);
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
            const checkboxes = this.tagListEl.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach((checkbox: HTMLInputElement) => {
                checkbox.checked = this.selectAllCheckbox.checked;
            });
        });
    }

    public renderTagList() {
        this.tagListEl.empty();

        const table = this.tagListEl.createEl("table", { cls: "gw-modal-tag-table" });
        const headerRow = table.createEl("tr");
        headerRow.createEl("th", { text: "Name" });
        headerRow.createEl("th", { text: "Description" });
        headerRow.createEl("th", { text: "Delete" });

        this.tags.forEach((tag, index) => {
            const row = table.createEl("tr");
            
            this.createEditableCell(row, tag, "name", index);
            this.createEditableCell(row, tag, "description", index);

            const deleteCell = row.createEl("td");
            const deleteCheckbox = deleteCell.createEl("input", { type: "checkbox" });
            deleteCheckbox.dataset.index = index.toString();
            deleteCheckbox.addEventListener("change", () => this.updateSelectAllCheckbox());
        });
    }

    public updateSelectAllCheckbox() {
        const checkboxes = this.tagListEl.querySelectorAll('input[type="checkbox"]');
        const allChecked = Array.from(checkboxes).every((checkbox: HTMLInputElement) => checkbox.checked);
        this.selectAllCheckbox.checked = allChecked;
    }

    public createEditableCell(row: HTMLTableRowElement, tag: Tag, field: "name" | "description", index: number) {
        const cell = row.createEl("td");
        const input = field === "name" ? new TextComponent(cell) : new TextAreaComponent(cell);
        input.setValue(tag[field])
            .onChange(value => {
                this.tags[index][field] = value;
            });
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
    }
}