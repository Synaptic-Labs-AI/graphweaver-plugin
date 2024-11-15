import { App, Modal, Notice, TFile, TFolder, setIcon, ButtonComponent } from "obsidian";
import { AIService } from "../../services/ai/AIService";
import { SettingsService } from "../../services/SettingsService";
import { AIGenerationService } from "src/services/ai/AIGenerationService";

export class BatchProcessorModal extends Modal {
    private generationService: AIGenerationService;

    constructor(
        app: App,
        private aiService: AIService,
        private settingsService: SettingsService
    ) {
        super(app);
        this.containerEl.addClass('graphweaver-modal');
        // Get the generation service from AIService
        this.generationService = this.aiService.getGenerationService();
    }

    public renderContent(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('status-history-modal');

        // Create modal content with proper structure
        const modalContent = contentEl.createDiv({ cls: 'modal-content' });

        // Create header
        this.createHeader(modalContent);

        // Create scrollable container
        const scrollableContent = modalContent.createDiv({ cls: 'modal-scrollable-content' });

        // File explorer
        const fileExplorer = scrollableContent.createDiv({ 
            cls: 'gw-accordion history-table-container' 
        });

        // Render vault structure
        this.renderVaultStructure(fileExplorer);

        // Create button container
        const buttonContainer = modalContent.createDiv({ 
            cls: 'modal-action-buttons gw-button-container' 
        });
        this.createButtons(buttonContainer);
    }

    private createHeader(containerEl: HTMLElement): void {
        const header = containerEl.createDiv({ cls: 'modal-header' });
        header.createEl('h2', { 
            text: 'Select Files/Folders to Process',
            cls: 'modal-header-title'
        });
    }

    private renderVaultStructure(containerEl: HTMLElement): void {
        const rootFolder = this.app.vault.getRoot();
        rootFolder.children.forEach((child) => {
            if (child instanceof TFolder) {
                this.renderFolder(containerEl, child);
            } else if (child instanceof TFile) {
                containerEl.appendChild(this.createFileElement(child));
            }
        });
    }

    private renderFolder(containerEl: HTMLElement, folder: TFolder): void {
        const folderEl = this.createFolderElement(folder);
        containerEl.appendChild(folderEl);

        const contentEl = folderEl.querySelector('.gw-accordion-content') as HTMLElement;
        folder.children.forEach((child) => {
            if (child instanceof TFolder) {
                this.renderFolder(contentEl, child);
            } else if (child instanceof TFile) {
                contentEl.appendChild(this.createFileElement(child));
            }
        });
    }

    private createFolderElement(folder: TFolder): HTMLElement {
        const folderEl = document.createElement('div');
        folderEl.className = 'gw-accordion';
        folderEl.setAttribute('data-path', folder.path);

        // Create header
        const headerEl = folderEl.createDiv({ cls: 'gw-accordion-header' });
        const titleWrapper = headerEl.createDiv({ cls: 'gw-accordion-title-wrapper' });

        // Checkbox
        const checkbox = titleWrapper.createEl('input', {
            type: 'checkbox',
            cls: 'gw-checkbox folder-checkbox'
        });

        // Folder icon
        const iconEl = titleWrapper.createDiv({ cls: 'gw-accordion-icon' });
        setIcon(iconEl, 'folder');

        // Folder name
        titleWrapper.createSpan({ 
            text: folder.name,
            cls: 'gw-accordion-title'
        });

        // Toggle icon
        const toggleIcon = headerEl.createDiv({ cls: 'gw-accordion-toggle' });
        setIcon(toggleIcon, 'chevron-right');

        // Content container
        const contentEl = folderEl.createDiv({ cls: 'gw-accordion-content' });

        // Toggle handler
        headerEl.addEventListener('click', (e) => {
            if (e.target !== checkbox) {
                folderEl.classList.toggle('gw-accordion-open');
            }
        });

        // Checkbox handler
        checkbox.addEventListener('change', () => this.handleFolderCheckboxChange(checkbox));

        return folderEl;
    }

    private createFileElement(file: TFile): HTMLElement {
        const fileEl = document.createElement('div');
        fileEl.className = 'gw-accordion-item';
        fileEl.setAttribute('data-path', file.path);

        const contentWrapper = fileEl.createDiv({ cls: 'gw-accordion-item-content' });

        // Checkbox
        const checkbox = contentWrapper.createEl('input', {
            type: 'checkbox',
            cls: 'gw-checkbox file-checkbox'
        });

        // File icon
        const iconEl = contentWrapper.createDiv({ cls: 'gw-accordion-icon' });
        setIcon(iconEl, 'file-text');

        // File name
        contentWrapper.createSpan({ 
            text: file.name,
            cls: 'gw-accordion-item-title'
        });

        // Checkbox handler
        checkbox.addEventListener('change', () => this.handleFileCheckboxChange(checkbox));

        return fileEl;
    }

    private handleFolderCheckboxChange(checkbox: HTMLInputElement): void {
        const folderEl = checkbox.closest('.gw-accordion');
        if (!folderEl) return;

        const descendantCheckboxes = folderEl.querySelectorAll('input[type="checkbox"]');
        descendantCheckboxes.forEach((childCheckbox: HTMLInputElement) => {
            childCheckbox.checked = checkbox.checked;
            childCheckbox.indeterminate = false;
        });

        this.updateParentCheckboxes(checkbox);
    }

    private handleFileCheckboxChange(checkbox: HTMLInputElement): void {
        this.updateParentCheckboxes(checkbox);
    }

    private updateParentCheckboxes(checkbox: HTMLInputElement): void {
        let parentFolderEl = checkbox.closest('.gw-accordion')?.parentElement?.closest('.gw-accordion');
        
        while (parentFolderEl) {
            const parentCheckbox = parentFolderEl.querySelector('.folder-checkbox') as HTMLInputElement;
            const childCheckboxes = parentFolderEl.querySelectorAll(
                ':scope > .gw-accordion-content .gw-accordion > .gw-accordion-header .folder-checkbox, ' +
                ':scope > .gw-accordion-content .gw-accordion-item .file-checkbox'
            ) as NodeListOf<HTMLInputElement>;

            const allChecked = Array.from(childCheckboxes).every(cb => cb.checked);
            const someChecked = Array.from(childCheckboxes).some(cb => cb.checked);

            parentCheckbox.checked = allChecked;
            parentCheckbox.indeterminate = !allChecked && someChecked;

            parentFolderEl = parentFolderEl.parentElement?.closest('.gw-accordion');
        }
    }

    private createButtons(containerEl: HTMLElement): void {
        // Cancel button
        new ButtonComponent(containerEl)
            .setButtonText('Cancel')
            .setClass('gw-button-secondary')
            .onClick(() => this.close());

        // Confirm button
        new ButtonComponent(containerEl)
            .setButtonText('Confirm')
            .setCta()
            .setClass('gw-button-primary')
            .onClick(() => this.confirmUpdate());
    }

    public async confirmUpdate(): Promise<void> {
        const selectedPaths = this.getSelectedPaths();
        if (selectedPaths.length === 0) {
            new Notice("No files selected for processing. Please select files or folders to update.");
            return;
        }

        this.close();
        
        const progressModal = new ProcessingProgressModal(this.app, selectedPaths.length);
        progressModal.open();

        try {
            await this.processSelectedFiles(selectedPaths, progressModal);
        } finally {
            progressModal.close();
        }
    }

    private getSelectedPaths(): string[] {
        const selectedPaths: string[] = [];
        const fileCheckboxes = this.contentEl.querySelectorAll(".file-checkbox:checked") as NodeListOf<HTMLInputElement>;

        fileCheckboxes.forEach((checkbox) => {
            const fileEl = checkbox.closest('.gw-accordion-item') as HTMLElement;
            if (fileEl) {
                const path = fileEl.getAttribute('data-path');
                if (path) {
                    selectedPaths.push(path);
                }
            }
        });

        return selectedPaths;
    }

    private async processSelectedFiles(selectedPaths: string[], progressModal: ProcessingProgressModal): Promise<void> {
        let updatedCount = 0;
        let errorCount = 0;

        for (const path of selectedPaths) {
            try {
                const file = this.app.vault.getAbstractFileByPath(path);
                if (file instanceof TFile) {
                    await this.updateFile(file);
                    updatedCount++;
                    progressModal.updateProgress(updatedCount);
                }
            } catch (error) {
                console.error(`Error updating file ${path}:`, error);
                errorCount++;
            }
        }

        let message = `Updated ${updatedCount} file${updatedCount !== 1 ? 's' : ''} successfully.`;
        if (errorCount > 0) {
            message += ` Encountered errors in ${errorCount} file${errorCount !== 1 ? 's' : ''}.`;
        }
        
        new Notice(message);
    }

    private async updateFile(file: TFile): Promise<void> {
        const content = await this.app.vault.read(file);
        const updatedContent = await this.processContent(content);
        await this.app.vault.modify(file, updatedContent);
    }

    private async processContent(content: string): Promise<string> {
        let processedContent = content;
    
        try {
            // Get the generation service
            const generationService = this.aiService.getGenerationService();
    
            // Always generate front matter in manual process
            processedContent = await generationService.generateFrontMatter(processedContent);
            processedContent = this.addOrUpdateFrontMatter(processedContent, processedContent);
    
            const settings = this.settingsService.getSettings();
            if (settings.advanced.generateWikilinks) {
                // Get all existing pages for wikilink generation
                const existingPages = this.app.vault.getMarkdownFiles().map(file => file.basename);
                processedContent = await generationService.generateWikilinks(processedContent, existingPages);
            }
    
            return processedContent;
        } catch (error) {
            console.error('Error processing content:', error);
            throw error; // Re-throw to be handled by caller
        }
    }

    private addOrUpdateFrontMatter(content: string, newFrontMatter: string): string {
        const frontMatterRegex = /^---\n[\s\S]*?\n---\n*/;
        if (frontMatterRegex.test(content)) {
            return content.replace(frontMatterRegex, `${newFrontMatter}\n\n`);
        } else {
            return `${newFrontMatter}\n\n${content}`;
        }
    }

    onClose() {
        this.contentEl.empty();
        this.containerEl.removeClass('graphweaver-modal');
    }
}

export class ProcessingProgressModal extends Modal {
    private progressBar: HTMLElement;
    private progressText: HTMLElement;
    private totalFiles: number;

    constructor(app: App, totalFiles: number) {
        super(app);
        this.totalFiles = totalFiles;
        this.containerEl.addClass('graphweaver-modal');
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('status-history-modal');

        const modalContent = contentEl.createDiv({ cls: 'modal-content' });

        // Header
        const header = modalContent.createDiv({ cls: 'modal-header' });
        header.createEl('h2', { 
            text: 'Processing Files',
            cls: 'modal-header-title'
        });

        // Content
        const content = modalContent.createDiv({ cls: 'modal-scrollable-content' });

        // Progress container
        const progressContainer = content.createDiv({ 
            cls: 'gw-status-bar-progress-container' 
        });

        // Progress bar
        this.progressBar = progressContainer.createDiv({ 
            cls: 'gw-status-bar-progress' 
        });

        // Progress text
        this.progressText = content.createDiv({ 
            cls: 'progress-text',
            text: `Processing 0/${this.totalFiles} files...`
        });

        this.updateProgress(0);
    }

    public updateProgress(current: number): void {
        const percentage = (current / this.totalFiles) * 100;
        this.progressBar.style.width = `${percentage}%`;
        this.progressText.textContent = `Processing ${current}/${this.totalFiles} files...`;
    }

    onClose() {
        this.contentEl.empty();
        this.containerEl.removeClass('graphweaver-modal');
    }
}