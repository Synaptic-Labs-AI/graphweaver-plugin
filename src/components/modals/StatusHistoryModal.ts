// src/components/modals/StatusHistoryModal.ts

import { App, Modal } from 'obsidian';
import { ProcessingStats, ProcessingStatus } from '../../models/ProcessingTypes';

export class StatusHistoryModal extends Modal {
    constructor(
        app: App,
        public currentStatus: ProcessingStatus,
        public recentStats: ProcessingStats[]
    ) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass('status-history-modal');
    
        // Add title
        contentEl.createEl('h2', { text: 'Processing Status & History' });
    
        // Current Status Section
        const currentStatusEl = contentEl.createDiv({ cls: 'gw-accordion-content' });
        this.renderCurrentStatus(currentStatusEl);
    
        // History Section
        const historyEl = contentEl.createDiv({ cls: 'gw-accordion-content' });
        this.renderProcessingHistory(historyEl);
    }

    /**
     * Render the current processing status
     */
    public renderCurrentStatus(containerEl: HTMLElement) {
        const statusEl = containerEl.createDiv({ cls: 'gw-property-editor' });

        // Create header
        statusEl.createEl('h3', { text: 'Current Status', cls: 'gw-accordion-title' });

        // Add status details
        const detailsEl = statusEl.createDiv({ cls: 'gw-modal-property-list' });

        const progressPct = this.currentStatus.filesQueued > 0
            ? Math.round((this.currentStatus.filesProcessed / this.currentStatus.filesQueued) * 100)
            : 0;

        // Status Badge with dynamic class
        detailsEl.createSpan({
            text: `Status: ${this.currentStatus.state.toUpperCase()}`,
            cls: `gw-status-badge gw-status-${this.currentStatus.state}`
        });

        // Progress
        detailsEl.createEl('p', {
            text: `Progress: ${this.currentStatus.filesProcessed}/${this.currentStatus.filesQueued} files (${progressPct}%)`
        });

        // Current File
        if (this.currentStatus.currentFile) {
            detailsEl.createEl('p', {
                text: `Current File: ${this.currentStatus.currentFile}`
            });
        }

        // Estimated Time Remaining
        if (this.currentStatus.estimatedTimeRemaining) {
            const minutes = Math.round(this.currentStatus.estimatedTimeRemaining / 60000);
            detailsEl.createEl('p', {
                text: `Estimated Time Remaining: ${minutes} minutes`
            });
        }

        // Recent Errors
        if (this.currentStatus.errors.length > 0) {
            const errorEl = statusEl.createDiv({ cls: 'gw-property-editor' });
            errorEl.createEl('h4', { text: 'Recent Errors', cls: 'gw-accordion-title' });
            const errorList = errorEl.createEl('ul');
            this.currentStatus.errors.slice(-5).forEach(error => {
                errorList.createEl('li', {
                    text: `${error.filePath}: ${error.error}`
                });
            });
        }
    }

    /**
     * Render the processing history
     */
    public renderProcessingHistory(containerEl: HTMLElement) {
        containerEl.createEl('h3', { text: 'Processing History', cls: 'gw-accordion-title' });

        if (this.recentStats.length === 0) {
            containerEl.createEl('p', {
                text: 'No processing history available yet.',
                cls: 'no-history'
            });
            return;
        }

        const tableEl = containerEl.createEl('table', { cls: 'gw-modal-property-table history-table' });

        // Add header row
        const headerRow = tableEl.createEl('tr');
        ['Time', 'Files', 'Success', 'Errors', 'Duration', 'Avg Time'].forEach(header => {
            headerRow.createEl('th', { text: header });
        });

        // Add data rows
        this.recentStats.forEach(stat => {
            const row = tableEl.createEl('tr');

            // Time
            row.createEl('td', {
                text: new Date(stat.startTime).toLocaleTimeString()
            });

            // Files
            row.createEl('td', {
                text: `${stat.processedFiles}/${stat.totalFiles}`
            });

            // Success
            row.createEl('td', {
                text: `${stat.processedFiles - stat.errorFiles}`,
                cls: 'success-count'
            });

            // Errors
            row.createEl('td', {
                text: `${stat.errorFiles}`,
                cls: stat.errorFiles > 0 ? 'error-count' : ''
            });

            // Duration
            const duration = stat.endTime ?
                Math.round((stat.endTime - stat.startTime) / 1000) : 0;
            row.createEl('td', {
                text: `${duration}s`
            });

            // Avg Time
            row.createEl('td', {
                text: `${Math.round(stat.averageProcessingTime)}ms`
            });
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
