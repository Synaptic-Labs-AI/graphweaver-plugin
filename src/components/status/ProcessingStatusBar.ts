// src/components/status/ProcessingStatusBar.ts

import { App, setIcon, Notice } from 'obsidian';
import { ProcessingState, ProcessingStatus } from '../../types/ProcessingTypes';
import { PersistentStateManager } from '../../managers/StateManager';
import { AIService } from '../../services/ai/AIService';
import { SettingsService } from '../../services/SettingsService';
import { DatabaseService } from '../../services/DatabaseService';

interface StatusBarConfig {
    showTooltips: boolean;
    updateInterval: number;
    animationEnabled: boolean;
}

interface StateUpdate {
    state?: ProcessingState;
    currentFile?: string | null;
    progress?: number;
    status?: ProcessingStatus;
}

export class ProcessingStatusBar {
    private statusBarItem: HTMLElement;
    private iconEl: HTMLElement;
    private progressBarEl: HTMLElement;
    private stateSubscription?: () => void;

    private readonly DEFAULT_CONFIG: StatusBarConfig = {
        showTooltips: true,
        updateInterval: 1000,
        animationEnabled: true
    };

    private currentState: ProcessingState = ProcessingState.IDLE;
    private currentStatus: ProcessingStatus;
    private updateIntervalId: number | null = null; // Changed type to number for consistency

    // Store event handler references for cleanup
    private clickHandler: () => void;

    constructor(
        private app: App,
        private statusBar: HTMLElement,
        private stateManager: PersistentStateManager,
        private aiService: AIService,
        private settingsService: SettingsService,
        private databaseService: DatabaseService,
        private config: Partial<StatusBarConfig> = {}
    ) {
        this.currentStatus = this.getDefaultStatus();
        this.statusBarItem = this.createStatusBarItem();
        this.initialize();
    }

    private initialize(): void {
        this.setupStateListener();
        this.updateDisplay();
        this.startPeriodicUpdates();
    }

    private createStatusBarItem(): HTMLElement {
        // Create main container with new CSS class
        const item = this.statusBar.createEl('div', {
            cls: 'gw-processing-status-bar mod-clickable'
        });

        // Create icon element with new CSS class
        this.iconEl = item.createDiv({
            cls: 'gw-status-bar-icon'
        });

        // Create progress container and bar with new CSS classes
        const progressContainer = item.createDiv({
            cls: 'gw-status-bar-progress-container'
        });

        this.progressBarEl = progressContainer.createDiv({
            cls: 'gw-status-bar-progress'
        });

        if (this.getConfig().showTooltips) {
            this.configureTooltip(item);
        }

        // Store the click handler for cleanup
        this.clickHandler = this.handleClick.bind(this);
        item.addEventListener('click', this.clickHandler);

        return item;
    }

    private setupStateListener(): void {
        // Properly unsubscribe from the state when destroyed
        this.stateSubscription = this.stateManager.subscribe('processing', (processingState) => {
            this.currentState = processingState.isProcessing
                ? ProcessingState.RUNNING
                : ProcessingState.IDLE;

            this.currentStatus = {
                state: this.currentState,
                filesQueued: processingState.queue.length,
                filesProcessed: processingState.progress,
                filesRemaining: processingState.queue.length - processingState.progress,
                currentFile: processingState.currentFile || undefined,
                errors: processingState.error
                    ? [{
                        filePath: processingState.currentFile || '',
                        error: processingState.error,
                        timestamp: Date.now(),
                        retryCount: 0
                    }]
                    : []
            };

            this.updateDisplay();
        });
    }

    public updateFromState(update: StateUpdate): void {
        if (update.state !== undefined) {
            this.currentState = update.state;
        }
        if (update.status) {
            this.currentStatus = { ...this.currentStatus, ...update.status };
        }
        this.updateDisplay();
    }

    private updateStateClasses(): void {
        // Remove all state classes first
        Object.values(ProcessingState).forEach(state => {
            this.statusBarItem.removeClass(`status-${state.toLowerCase()}`);
        });
        // Add current state class
        this.statusBarItem.addClass(`status-${this.currentState.toLowerCase()}`);
    }

    private updateIcon(): void {
        this.iconEl.empty();

        const iconMap: Record<ProcessingState, string> = {
            [ProcessingState.RUNNING]: 'refresh-cw',
            [ProcessingState.PAUSED]: 'pause-circle',
            [ProcessingState.ERROR]: 'alert-circle',
            [ProcessingState.IDLE]: 'check-circle'
        };

        const iconName = iconMap[this.currentState] || iconMap[ProcessingState.IDLE];
        setIcon(this.iconEl, iconName);
    }

    private updateProgressBar(): void {
        const { filesProcessed, filesQueued } = this.currentStatus;
        const progressPct = filesQueued > 0 ? (filesProcessed / filesQueued) * 100 : 0;

        // Update progress bar width with transition
        this.progressBarEl.style.width = `${progressPct}%`;

        // State-specific color mapping using CSS variables
        const colors: Record<ProcessingState, string> = {
            [ProcessingState.RUNNING]: 'var(--interactive-accent)',
            [ProcessingState.ERROR]: 'var(--color-red)',
            [ProcessingState.PAUSED]: 'var(--text-muted)',
            [ProcessingState.IDLE]: 'var(--color-green)'
        };

        this.progressBarEl.style.backgroundColor = colors[this.currentState];
    }

    private updateTooltip(): void {
        const tooltipText = this.getTooltipText();
        this.statusBarItem.setAttribute('aria-label', tooltipText);
    }

    private getTooltipText(): string {
        const { filesProcessed, filesQueued } = this.currentStatus;

        const tooltipMap: Record<ProcessingState, string> = {
            [ProcessingState.RUNNING]: `Processing: ${filesProcessed}/${filesQueued} files`,
            [ProcessingState.PAUSED]: 'Processing is paused',
            [ProcessingState.ERROR]: 'Error occurred during processing',
            [ProcessingState.IDLE]: 'Processing complete'
        };

        return tooltipMap[this.currentState] || 'Unknown status';
    }

    private updateDisplay(): void {
        this.updateStateClasses();
        this.updateIcon();
        this.updateProgressBar();

        if (this.getConfig().showTooltips) {
            this.updateTooltip();
        }
    }

    private configureTooltip(item: HTMLElement): void {
        item.setAttribute('aria-label', 'Processing Status');
        item.setAttribute('aria-label-position', 'top');
    }

    private getConfig(): StatusBarConfig {
        return { ...this.DEFAULT_CONFIG, ...this.config };
    }

    private getDefaultStatus(): ProcessingStatus {
        return {
            state: ProcessingState.IDLE,
            filesQueued: 0,
            filesProcessed: 0,
            filesRemaining: 0,
            errors: []
        };
    }

    private async handleClick(): Promise<void> {
        try {
            const recentStats = await this.databaseService.getProcessingStats();
            if (!recentStats || recentStats.length === 0) {
                new Notice('No processing history available.');
                return;
            }

            const module = await import('../modals/StatusHistoryModal');
            const { default: StatusHistoryModal } = module;

            new StatusHistoryModal(
                this.app,
                this.getSafeStatus(),
                recentStats
            ).open();
        } catch (error) {
            console.error('Error opening history modal:', error);
            new Notice('An error occurred while opening the history modal.');
        }
    }

    private startPeriodicUpdates(): void {
        if (this.updateIntervalId !== null) {
            clearInterval(this.updateIntervalId);
        }

        this.updateIntervalId = window.setInterval(() => {
            if (this.currentState === ProcessingState.RUNNING) {
                this.updateDisplay();
            }
        }, this.getConfig().updateInterval);
    }

    private getSafeStatus(): ProcessingStatus {
        return {
            ...this.currentStatus,
            errors: this.currentStatus.errors || [],
            filesQueued: this.currentStatus.filesQueued || 0,
            filesProcessed: this.currentStatus.filesProcessed || 0,
            filesRemaining: this.currentStatus.filesRemaining || 0,
            state: this.currentStatus.state || ProcessingState.IDLE
        };
    }

    public destroy(): void {
        if (this.updateIntervalId !== null) {
            clearInterval(this.updateIntervalId);
            this.updateIntervalId = null;
        }
        if (this.stateSubscription) {
            this.stateSubscription();
            this.stateSubscription = undefined;
        }
        // Remove the click event listener
        this.statusBarItem.removeEventListener('click', this.clickHandler);

        // Remove the status bar item from the DOM
        this.statusBarItem.remove();
    }
}
