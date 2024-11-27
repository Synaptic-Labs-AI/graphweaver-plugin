// src/components/modals/BatchProcessorModal.ts

import { App, Modal, Notice, TFile, TFolder } from "obsidian";
import { AIService } from "../../services/AIService";
import { SettingsService } from "../../services/SettingsService";
import { BaseModal } from "./BaseModal";

export class BatchProcessorModal extends BaseModal<void> {
    public aiService: AIService;
    public settingsService: SettingsService;

    constructor(app: App, aiService: AIService, settingsService: SettingsService) {
        super(app);
        this.aiService = aiService;
        this.settingsService = settingsService;
    }

    protected getTitle(): string {
        return "Batch Processor";
    }

    protected renderContent(): void {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl("h2", { text: "Select Files/Folders to Process" });

        const fileExplorer = contentEl.createDiv({ cls: "file-explorer" });

        // Start rendering from the contents of the root folder
        this.renderVaultStructure(fileExplorer);

        // Add confirm and cancel buttons
        this.createButtons(contentEl);
    }

    protected async handleSubmit(): Promise<void> {
        const selectedPaths = this.getSelectedPaths();
        if (selectedPaths.length === 0) {
            new Notice("No files selected for processing. Please select files or folders to update.");
            return;
        }

        this.close(); // Close modal before processing

        await this.processSelectedFiles(selectedPaths);
    }

    public renderVaultStructure(containerEl: HTMLElement): void {
        const rootFolder = this.app.vault.getRoot();
        const validChildren = rootFolder.children.filter(
            (item): item is TFile | TFolder => item instanceof TFile || item instanceof TFolder
        );
        const { folders, files } = this.separateItemsByType(validChildren);

        // Render folders first
        folders.sort((a, b) => a.name.localeCompare(b.name));
        folders.forEach(folder => {
            this.renderFolder(containerEl, folder);
        });

        // Render root files after folders
        files.sort((a, b) => a.name.localeCompare(b.name));
        files.forEach(file => {
            containerEl.appendChild(this.createFileElement(file));
        });
    }

    private separateItemsByType(items: (TFile | TFolder)[]) {
        return items.reduce((acc, item) => {
            if (item instanceof TFolder) {
                acc.folders.push(item);
            } else if (item instanceof TFile) {
                acc.files.push(item);
            }
            return acc;
        }, { folders: [] as TFolder[], files: [] as TFile[] });
    }

    public renderFolder(containerEl: HTMLElement, folder: TFolder): void {
        const folderEl = this.createFolderElement(folder);
        containerEl.appendChild(folderEl);

        const contentEl = folderEl.querySelector('.folder-content') as HTMLElement;
        const validChildren = folder.children.filter(
            (item): item is TFile | TFolder => item instanceof TFile || item instanceof TFolder
        );
        const { folders, files } = this.separateItemsByType(validChildren);

        // Render subfolders first
        folders.sort((a, b) => a.name.localeCompare(b.name));
        folders.forEach(subfolder => {
            this.renderFolder(contentEl, subfolder);
        });

        // Render files after subfolders
        files.sort((a, b) => a.name.localeCompare(b.name));
        files.forEach(file => {
            contentEl.appendChild(this.createFileElement(file));
        });
    }

    public createFolderElement(folder: TFolder): HTMLElement {
        const folderEl = document.createElement("div");
        folderEl.className = "folder collapsed"; // Start collapsed

        const nameEl = folderEl.createDiv({ cls: "folder-name" });

        // Toggle arrow icon
        const arrowIcon = nameEl.createSpan({ cls: "collapse-icon" });
        arrowIcon.innerHTML = "▸"; // Right-pointing arrow when collapsed

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
                folderEl.classList.toggle("collapsed");
                arrowIcon.innerHTML = folderEl.classList.contains("collapsed") ? "▸" : "▾";
            }
        });

        // Folder checkbox change handler with immediate visual feedback
        checkbox.addEventListener("change", () => {
            this.handleFolderCheckboxChange(checkbox);
            const isChecked = checkbox.checked;
            
            // Update visual state of child checkboxes
            const childCheckboxes = contentEl.querySelectorAll("input[type='checkbox']") as NodeListOf<HTMLInputElement>;
            childCheckboxes.forEach(childBox => {
                childBox.checked = isChecked;
                childBox.indeterminate = false;
            });
        });

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
        super.updateParentCheckboxes(checkbox);
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

        const progressNotice = new Notice(`Processing 0/${totalFiles} files...`, 0);

        for (const path of selectedPaths) {
            try {
                const file = this.app.vault.getAbstractFileByPath(path);
                if (file instanceof TFile) {
                    await this.updateFile(file);
                    updatedCount++;
                    progressNotice.setMessage(`Processing ${updatedCount}/${totalFiles} files...`);
                }
            } catch (error) {
                console.error(`Error updating file ${path}:`, error);
                errorCount++;
            }
        }

        progressNotice.hide();

        let message = `Updated ${updatedCount} file${updatedCount !== 1 ? 's' : ''} successfully.`;
        if (errorCount > 0) {
            message += ` Encountered errors in ${errorCount} file${errorCount !== 1 ? 's' : ''}.`;
        }
        new Notice(message, 5000);
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
        const frontMatterOutput = await this.aiService.generateFrontMatter(processedContent);
        if (frontMatterOutput.success && frontMatterOutput.frontMatter) {
            processedContent = this.addOrUpdateFrontMatter(processedContent, frontMatterOutput.frontMatter);
        }

        const settings = this.settingsService.getSettings();

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
