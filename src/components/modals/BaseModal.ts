import { Modal, App } from "obsidian";

export abstract class BaseModal<T> extends Modal {
    constructor(app: App) {
        super(app);
    }

    public onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        
        this.createHeader();
        this.renderContent();
        this.createFooter();
    }

    protected createHeader(): void {
        const header = this.contentEl.createDiv('modal-header');
        header.createEl('h2', { text: this.getTitle() });
    }

    protected createFooter(): void {
        // ...code to create common footer elements...
    }

    // Common method to create select all checkbox
    public createSelectAllCheckbox(containerEl: HTMLElement, listEl: HTMLElement) {
        const selectAllContainer = containerEl.createDiv({ cls: "gw-select-all-container" });
        const selectAllCheckbox = selectAllContainer.createEl("input", { type: "checkbox" });
        selectAllContainer.createEl("span", { text: "Select All" });

        selectAllCheckbox.addEventListener("change", () => {
            const checkboxes = listEl.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach((checkbox: HTMLInputElement) => {
                checkbox.checked = selectAllCheckbox.checked;
            });
        });

        return selectAllCheckbox;
    }

    // Common method to update parent checkboxes
    public updateParentCheckboxes(checkbox: HTMLInputElement) {
        let parentFolderEl = checkbox.closest(".folder")?.parentElement?.closest(".folder");
        while (parentFolderEl) {
            const parentCheckbox = parentFolderEl.querySelector(".folder-checkbox") as HTMLInputElement;
            const childCheckboxes = parentFolderEl.querySelectorAll(":scope > .folder-content .folder > .folder-name > .folder-checkbox, :scope > .folder-content .file > .file-checkbox") as NodeListOf<HTMLInputElement>;

            const allChecked = Array.from(childCheckboxes).every(cb => cb.checked);
            const someChecked = Array.from(childCheckboxes).some(cb => cb.checked);

            parentCheckbox.checked = allChecked;
            parentCheckbox.indeterminate = !allChecked && someChecked;

            parentFolderEl = parentFolderEl.parentElement?.closest(".folder");
        }
    }

    protected showError(message: string): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("p", { text: message, cls: "error-message" });
    }

    protected abstract getTitle(): string;
    protected abstract renderContent(): void;
    protected abstract handleSubmit(data: T): Promise<void>;

    // ...any other shared methods or properties...
}