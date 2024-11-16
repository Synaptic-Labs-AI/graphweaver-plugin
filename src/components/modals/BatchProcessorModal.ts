// BatchProcessorModal.ts

import { App, Modal, Setting, Notice, TFile, TFolder } from 'obsidian';
import { AIGenerationService } from 'src/services/ai/AIGenerationService';
import { AIService } from 'src/services/ai/AIService';
import { SettingsService } from 'src/services/SettingsService';

export class BatchProcessorModal extends Modal {
    private generationService: AIGenerationService;

    constructor(
        app: App,
        private aiService: AIService,
        private settingsService: SettingsService
    ) {
        super(app);
        this.containerEl.addClass('graphweaver-modal');
        this.generationService = this.aiService.getGenerationService();
    }

    onOpen() {
        this.renderContent();
    }

    public renderContent(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('status-history-modal');

        // Create modal content
        const modalContent = contentEl.createDiv({ cls: 'modal-content' });
        this.createHeader(modalContent);

        const scrollableContent = modalContent.createDiv({ cls: 'modal-scrollable-content' });
        this.renderVaultStructure(scrollableContent);

        const buttonContainer = modalContent.createDiv({ cls: 'modal-action-buttons gw-button-container' });
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
        rootFolder.children.forEach(child => {
            if (child instanceof TFolder) {
                containerEl.appendChild(this.createFolderElement(child));
            } else if (child instanceof TFile) {
                containerEl.appendChild(this.createFileElement(child));
            }
        });
    }

    private createFolderElement(folder: TFolder): HTMLElement {
        const folderEl = document.createElement('div');
        folderEl.className = 'gw-accordion';
        folderEl.setAttribute('data-path', folder.path);

        const headerEl = folderEl.createDiv({ cls: 'gw-accordion-header' });
        const titleWrapper = headerEl.createDiv({ cls: 'gw-accordion-title-wrapper' });

        new Setting(titleWrapper)
            .setName(folder.name)
            .addToggle(toggle => toggle
                .onChange(value => {
                    this.toggleFolderSelection(folderEl, value);
                }));

        const contentEl = folderEl.createDiv({ cls: 'gw-accordion-content' });

        headerEl.addEventListener('click', () => {
            const isCurrentlyHidden = contentEl.hidden;
            contentEl.hidden = !isCurrentlyHidden;
            headerEl.toggleClass('expanded', !isCurrentlyHidden);
        });

        folder.children.forEach(child => {
            if (child instanceof TFile) {
                contentEl.appendChild(this.createFileElement(child));
            }
        });

        return folderEl;
    }

    private createFileElement(file: TFile): HTMLElement {
        const fileEl = document.createElement('div');
        fileEl.className = 'gw-accordion-item';
        fileEl.setAttribute('data-path', file.path);

        const setting = new Setting(fileEl)
            .setName(file.name)
            .addToggle(toggle => toggle
                .onChange(value => {
                    // Handle file selection
                }));

        return fileEl;
    }

    private toggleFolderSelection(folderEl: HTMLElement, isSelected: boolean): void {
        const checkboxes = folderEl.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach((checkbox: HTMLInputElement) => {
            checkbox.checked = isSelected;
        });
    }

    private createButtons(containerEl: HTMLElement): void {
        new Setting(containerEl)
            .addButton(btn => btn
                .setButtonText('Process Selected')
                .setCta()
                .onClick(() => this.confirmUpdate()));

        new Setting(containerEl)
            .addButton(btn => btn
                .setButtonText('Cancel')
                .setClass('gw-button-secondary')
                .onClick(() => this.close()));
    }

    public async confirmUpdate(): Promise<void> {
        const selectedPaths = this.getSelectedPaths();
        if (selectedPaths.length === 0) {
            new Notice('No files or folders selected.');
            return;
        }

        const progressModal = new ProcessingProgressModal(this.app, selectedPaths.length);
        progressModal.open();

        await this.processSelectedFiles(selectedPaths, progressModal);
        progressModal.close();
        this.close();
        new Notice('Batch processing completed.');
    }

    private getSelectedPaths(): string[] {
        const checkboxes = this.containerEl.querySelectorAll('.gw-checkbox:checked');
        return Array.from(checkboxes).map(cb => cb.closest('[data-path]')?.getAttribute('data-path') || '').filter(path => path);
    }

    private async processSelectedFiles(selectedPaths: string[], progressModal: ProcessingProgressModal): Promise<void> {
        for (let i = 0; i < selectedPaths.length; i++) {
            const path = selectedPaths[i];
            const file = this.app.vault.getAbstractFileByPath(path);
            if (file instanceof TFile) {
                const content = await this.app.vault.read(file);
                const updatedContent = await this.processContent(content);
                await this.app.vault.modify(file, updatedContent);
            }
            progressModal.updateProgress(i + 1);
        }
    }

    private async processContent(content: string): Promise<string> {
        // Implement your content processing logic here
        return content;
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
        this.containerEl.removeClass('graphweaver-modal');
    }
}

class ProcessingProgressModal extends Modal {
    private progressBar: HTMLElement;
    private progressText: HTMLElement;
    private totalFiles: number;

    constructor(app: App, totalFiles: number) {
        super(app);
        this.totalFiles = totalFiles;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        const modalContent = contentEl.createDiv({ cls: 'modal-content' });
        modalContent.createEl('h2', { text: 'Processing Files...', cls: 'modal-header-title' });

        this.progressBar = modalContent.createDiv({ cls: 'progress-bar' });
        this.progressText = modalContent.createEl('p', { text: `0 / ${this.totalFiles} files processed.` });
    }

    public updateProgress(current: number): void {
        const percentage = (current / this.totalFiles) * 100;
        this.progressBar.style.width = `${percentage}%`;
        this.progressText.textContent = `${current} / ${this.totalFiles} files processed.`;
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}