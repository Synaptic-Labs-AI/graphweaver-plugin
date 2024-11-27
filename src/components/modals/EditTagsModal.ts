import { Setting, TextComponent, TextAreaComponent, App } from "obsidian";
import { Tag } from "../../models/PropertyTag";
import { BaseModal } from "./BaseModal";

type Callback = (tags: Tag[]) => void;

export class EditTagsModal extends BaseModal<Tag[]> {
    public tags: Tag[];
    public onSubmit: Callback;
    public tagListEl: HTMLElement;
    public selectAllCheckbox: HTMLInputElement;

    constructor(app: App, tags: Tag[], onSubmit: Callback) {
        super(app);
        this.tags = [...tags];
        this.onSubmit = onSubmit;
    }

    protected getTitle(): string {
        return "Edit Tags";
    }

    protected renderContent(): void {
        const { contentEl } = this;

        this.tagListEl = contentEl.createDiv({ cls: "gw-modal-tag-list" });

        this.selectAllCheckbox = this.createSelectAllCheckbox(contentEl, this.tagListEl);

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
                .onClick(() => this.handleSubmit(this.tags)))
            .addButton(btn => btn
                .setButtonText("Cancel")
                .onClick(() => this.close()));
    }

    protected async handleSubmit(data: Tag[]): Promise<void> {
        // Filter out any invalid/incomplete tags before submitting
        const validTags = data.filter(tag => tag.name && tag.description);
        this.onSubmit(validTags);
        this.close();
    }

    protected renderTagList() {
        this.tagListEl.empty();

        const table = this.tagListEl.createEl("table", { cls: "gw-modal-tag-table" });
        const headerRow = table.createEl("tr");
        headerRow.createEl("th", { text: "Drag" });  // Add drag column
        headerRow.createEl("th", { text: "Name" });
        headerRow.createEl("th", { text: "Description" });
        headerRow.createEl("th", { text: "Delete" });

        this.tags.forEach((tag, index) => {
            const row = table.createEl("tr", { attr: { draggable: "true", "data-index": index.toString() } });
            
            row.addEventListener("dragstart", this.onDragStart.bind(this));
            row.addEventListener("dragover", this.onDragOver.bind(this));
            row.addEventListener("drop", this.onDrop.bind(this));

            row.createEl("td", { text: "≡", cls: "gw-drag-handle" });
            this.createEditableCell(row, tag, "name", index);
            this.createEditableCell(row, tag, "description", index);

            const deleteCell = row.createEl("td");
            const deleteCheckbox = deleteCell.createEl("input", { type: "checkbox" });
            deleteCheckbox.dataset.index = index.toString();
            deleteCheckbox.addEventListener("change", () => this.updateSelectAllCheckbox());
        });
    }

    // Add drag and drop handlers
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
            const [reorderedItem] = this.tags.splice(fromIndex, 1);
            this.tags.splice(toIndex, 0, reorderedItem);
            this.renderTagList();
        }
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