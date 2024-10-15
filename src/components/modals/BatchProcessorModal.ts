// src/components/modals/BatchProcessorModal.ts

import { App, Modal, Notice, TFile, TFolder } from "obsidian";
import { AIService } from "../../services/AIService";
import { SettingsService } from "../../services/SettingsService";

export class BatchProcessorModal extends Modal {
    public aiService: AIService;
    public settingsService: SettingsService;

    constructor(app: App, aiService: AIService, settingsService: SettingsService) {
        super(app);
        this.aiService = aiService;
        this.settingsService = settingsService;
    }

    onOpen() {
        this.renderContent();
    }

    onClose() {
        this.contentEl.empty();
    }

    public renderContent(): void {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl("h2", { text: "Select Files/Folders to Process" });

        const fileExplorer = contentEl.createDiv({ cls: "file-explorer" });

        // Start rendering from the contents of the root folder
        this.renderVaultStructure(fileExplorer);

        // Add confirm and cancel buttons
        this.createButtons(contentEl);
    }

    public renderVaultStructure(containerEl: HTMLElement): void {
        const rootFolder = this.app.vault.getRoot();
        rootFolder.children.forEach((child) => {
            if (child instanceof TFolder) {
                this.renderFolder(containerEl, child);
            } else if (child instanceof TFile) {
                containerEl.appendChild(this.createFileElement(child));
            }
        });
    }

    public renderFolder(containerEl: HTMLElement, folder: TFolder): void {
        const folderEl = this.createFolderElement(folder);
        containerEl.appendChild(folderEl);

        const contentEl = folderEl.querySelector('.folder-content') as HTMLElement;
        folder.children.forEach((child) => {
            if (child instanceof TFolder) {
                this.renderFolder(contentEl, child);
            } else if (child instanceof TFile) {
                contentEl.appendChild(this.createFileElement(child));
            }
        });
    }

    public createFolderElement(folder: TFolder): HTMLElement {
        const folderEl = document.createElement("div");
        folderEl.className = "folder";

        const nameEl = folderEl.createDiv({ cls: "folder-name" });

        // Folder icon
        nameEl.createSpan({ cls: "icon folder-icon", text: "📁" });

        const checkbox = nameEl.createEl("input", { type: "checkbox" });
        checkbox.className = "folder-checkbox";

        nameEl.createSpan({ text: folder.name });

        const contentEl = folderEl.createDiv({ cls: "folder-content" });

        // Store folder path
        folderEl.setAttribute("data-path", folder.path);

        // Toggle folder open/closed
        nameEl.addEventListener("click", (e) => {
            if (e.target !== checkbox) {
                folderEl.classList.toggle("open");
            }
        });

        // Folder checkbox change handler
        checkbox.addEventListener("change", () => this.handleFolderCheckboxChange(checkbox));

        return folderEl;
    }

    public createFileElement(file: TFile): HTMLElement {
        const fileEl = document.createElement("div");
        fileEl.className = "file";

        // File icon
        fileEl.createSpan({ cls: "icon file-icon", text: "📄" });

        const checkbox = fileEl.createEl("input", { type: "checkbox" });
        checkbox.className = "file-checkbox";

        fileEl.createSpan({ text: file.name });

        // Store file path
        fileEl.setAttribute("data-path", file.path);

        // File checkbox change handler
        checkbox.addEventListener("change", () => this.handleFileCheckboxChange(checkbox));

        return fileEl;
    }

    public handleFolderCheckboxChange(checkbox: HTMLInputElement): void {
        const folderEl = checkbox.closest(".folder");
        if (!folderEl) return;

        // Select/deselect all descendant checkboxes
        const descendantCheckboxes = folderEl.querySelectorAll("input[type='checkbox']");
        descendantCheckboxes.forEach((childCheckbox: HTMLInputElement) => {
            childCheckbox.checked = checkbox.checked;
            childCheckbox.indeterminate = false;
        });

        // Update parent checkboxes
        this.updateParentCheckboxes(checkbox);
    }

    public handleFileCheckboxChange(checkbox: HTMLInputElement): void {
        // Update parent checkboxes
        this.updateParentCheckboxes(checkbox);
    }

    public updateParentCheckboxes(checkbox: HTMLInputElement): void {
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

    public createButtons(containerEl: HTMLElement): void {
        const buttonContainer = containerEl.createDiv({ cls: "button-container" });

        // Cancel button
        buttonContainer.createEl("button", { text: "Cancel", cls: "mod-cancel" })
            .addEventListener("click", () => this.close());

        // Confirm button
        buttonContainer.createEl("button", { text: "Confirm", cls: "mod-cta" })
            .addEventListener("click", () => this.confirmUpdate());
    }

    public async confirmUpdate(): Promise<void> {
        const selectedPaths = this.getSelectedPaths();
        if (selectedPaths.length === 0) {
            new Notice("No files selected for processing. Please select files or folders to update.");
            return;
        }

        this.close(); // Close modal before processing

        await this.processSelectedFiles(selectedPaths);
    }

    public getSelectedPaths(): string[] {
        const selectedPaths: string[] = [];
        const fileCheckboxes = this.contentEl.querySelectorAll(".file-checkbox:checked") as NodeListOf<HTMLInputElement>;

        fileCheckboxes.forEach((checkbox) => {
            const fileEl = checkbox.closest('.file') as HTMLElement;
            if (fileEl) {
                const path = fileEl.getAttribute('data-path');
                if (path) {
                    selectedPaths.push(path);
                }
            }
        });

        return selectedPaths;
    }

    public async processSelectedFiles(selectedPaths: string[]): Promise<void> {
        const totalFiles = selectedPaths.length;
        let updatedCount = 0;
        let errorCount = 0;

        const progressModal = new ProcessingProgressModal(this.app, totalFiles);
        progressModal.open();

        for (const path of selectedPaths) {
            try {
                const file = this.app.vault.getAbstractFileByPath(path);
                if (file instanceof TFile) {
                    await this.updateFile(file);
                    updatedCount++;
                }
            } catch (error) {
                console.error(`Error updating file ${path}:`, error);
                errorCount++;
            }

            progressModal.updateProgress(updatedCount);
        }

        progressModal.close();

        let message = `Updated ${updatedCount} file${updatedCount !== 1 ? 's' : ''} successfully.`;
        if (errorCount > 0) {
            message += ` Encountered errors in ${errorCount} file${errorCount !== 1 ? 's' : ''}.`;
        }
        new Notice(message);
    }

    public async updateFile(file: TFile): Promise<void> {
        const content = await this.app.vault.read(file);
        const updatedContent = await this.processContent(content);
        await this.app.vault.modify(file, updatedContent);
    }

    public async processContent(content: string): Promise<string> {
        console.log('BatchProcessorModal: Starting content processing');
        let processedContent = content;

        // Always generate front matter in manual process
        console.log('BatchProcessorModal: Generating front matter');
        const frontMatter = await this.aiService.generateFrontMatter(processedContent);
        processedContent = this.addOrUpdateFrontMatter(processedContent, frontMatter);

        const settings = this.settingsService.getSettings();
        if (settings.advanced.generateWikilinks) {
            console.log('BatchProcessorModal: Generating wikilinks');
            processedContent = await this.aiService.generateWikilinks(processedContent);
        }

        return processedContent;
    }

    public addOrUpdateFrontMatter(content: string, newFrontMatter: string): string {
        const frontMatterRegex = /^---\n[\s\S]*?\n---\n*/;
        if (frontMatterRegex.test(content)) {
            return content.replace(frontMatterRegex, `${newFrontMatter}\n\n`);
        } else {
            return `${newFrontMatter}\n\n${content}`;
        }
    }
}

// Processing Progress Modal

class ProcessingProgressModal extends Modal {
    public progressBar: HTMLElement;
    public totalFiles: number;

    constructor(app: App, totalFiles: number) {
        super(app);
        this.totalFiles = totalFiles;
    }

    onOpen() {
        this.contentEl.empty();

        this.contentEl.createEl("h2", { text: "Processing Files" });

        this.progressBar = this.contentEl.createDiv({ cls: "progress-bar-container" })
            .createDiv({ cls: "progress-bar" });

        this.updateProgress(0);
    }

    onClose() {
        this.contentEl.empty();
    }

    public updateProgress(current: number): void {
        const percentage = (current / this.totalFiles) * 100;
        this.progressBar.style.width = `${percentage}%`;
    }
}
