import { App, setIcon } from 'obsidian';
import { StatusHistoryModal } from '../modals/StatusHistoryModal';
import { AIService } from '../../services/AIService';
import { SettingsService } from '../../services/SettingsService';
import { DatabaseService } from '../../services/DatabaseService';
import { 
    ProcessingStatus,
    ProcessingEvent,
    ProcessingStats
} from '../../models/ProcessingTypes';
import { EventEmitter } from 'events';

/**
 * Enum defining all possible processing states
 */
export enum ProcessingState {
    IDLE = 'idle',
    RUNNING = 'running',
    ERROR = 'error'
}

/**
 * Interface for status bar configuration
 */
interface StatusBarConfig {
    showTooltips: boolean;
    updateInterval: number;
    animationEnabled: boolean;
}

/**
 * Enhanced status bar component showing processing state and history
 */
export class ProcessingStatusBar {
    private readonly statusBarItem: HTMLElement;
    private readonly iconContainer: HTMLElement;
    private readonly DEFAULT_CONFIG: StatusBarConfig = {
        showTooltips: true,
        updateInterval: 1000,
        animationEnabled: true
    };

    private currentState: ProcessingState;
    private currentStatus: ProcessingStatus;
    private updateInterval: NodeJS.Timeout | null;

    constructor(
        private app: App,
        private statusBar: HTMLElement,
        private eventEmitter: EventEmitter,
        private aiService: AIService,
        private settingsService: SettingsService,
        private databaseService: DatabaseService,
        private config: Partial<StatusBarConfig> = {}
    ) {
        // Initialize state and status
        this.currentState = ProcessingState.IDLE;
        this.currentStatus = this.getDefaultStatus();
        
        // Create UI elements
        this.statusBarItem = this.createStatusBarItem();
        this.iconContainer = this.createIconContainer();
        
        // Initialize the component
        this.initialize();
    }

    /**
     * Initialize the status bar component
     */
    private initialize(): void {
        this.setupEventListeners();
        this.updateDisplay();
        this.startPeriodicUpdates();
    }

    /**
     * Create the main status bar item
     */
    private createStatusBarItem(): HTMLElement {
        const item = this.statusBar.createEl('div', {
            cls: 'processing-status-bar mod-clickable'
        });

        if (this.getConfig().showTooltips) {
            item.setAttribute('aria-label', 'Processing Status');
        }

        item.addEventListener('click', this.handleClick.bind(this));
        return item;
    }

    /**
     * Create the icon container
     */
    private createIconContainer(): HTMLElement {
        return this.statusBarItem.createDiv({
            cls: 'processing-status-icon',
            attr: {
                'aria-hidden': 'true'
            }
        });
    }

    /**
     * Set up all event listeners
     */
    private setupEventListeners(): void {
        // Processing start event
        this.eventEmitter.on('start', ({ status }: ProcessingEvent['start']) => {
            if (status) {
                this.updateStatus(ProcessingState.RUNNING, status);
            }
        });

        // Processing complete event
        this.eventEmitter.on('complete', async (stats: ProcessingEvent['complete']) => {
            const hasErrors = this.currentStatus.errors.length > 0;
            this.updateStatus(
                hasErrors ? ProcessingState.ERROR : ProcessingState.IDLE,
                this.createCompleteStatus(stats)
            );
        });

        // Progress update event
        this.eventEmitter.on('progress', (status: ProcessingEvent['progress']) => {
            if (status) {
                this.updateStatus(this.currentState, status);
            }
        });

        // Error event
        this.eventEmitter.on('error', () => {
            this.updateStatus(ProcessingState.ERROR, this.currentStatus);
        });
    }

    /**
     * Update current status and trigger display update
     */
    private updateStatus(state: ProcessingState, status: ProcessingStatus): void {
        this.currentState = state;
        this.currentStatus = status;
        this.updateDisplay();
    }

    /**
     * Update the visual display of the status bar
     */
    private updateDisplay(): void {
        // Update state classes
        this.updateStateClasses();
        
        // Update icon
        this.updateIcon();
        
        // Update tooltip
        if (this.getConfig().showTooltips) {
            this.updateTooltip();
        }
    }

    /**
     * Update the status bar state classes
     */
    private updateStateClasses(): void {
        // Remove all state classes
        Object.values(ProcessingState).forEach(state => {
            this.statusBarItem.removeClass(`status-${state}`);
        });

        // Add current state class
        this.statusBarItem.addClass(`status-${this.currentState}`);
    }

    /**
     * Update the status icon
     */
    private updateIcon(): void {
        this.iconContainer.empty();
        setIcon(this.iconContainer, 'loader-2');

        // Toggle animation class based on state
        this.iconContainer.toggleClass(
            'animated',
            this.getConfig().animationEnabled && this.currentState === ProcessingState.RUNNING
        );
    }

    /**
     * Update the tooltip text
     */
    private updateTooltip(): void {
        const tooltipText = this.getTooltipText();
        this.statusBarItem.setAttribute('aria-label', tooltipText);
        this.statusBarItem.dataset.tooltip = tooltipText;
    }

    /**
     * Get the current tooltip text based on state and status
     */
    private getTooltipText(): string {
        const { filesProcessed, filesQueued } = this.currentStatus;
        
        switch (this.currentState) {
            case ProcessingState.RUNNING:
                return `Processing: ${filesProcessed}/${filesQueued} files`;
            case ProcessingState.ERROR:
                return `Error: ${this.currentStatus.errors.length} errors occurred`;
            case ProcessingState.IDLE:
                return filesProcessed > 0 
                    ? `Complete: ${filesProcessed} files processed`
                    : 'Ready';
            default:
                return 'Unknown status';
        }
    }

    /**
     * Handle status bar click
     */
    private async handleClick(): Promise<void> {
        const recentStats = await this.databaseService.getProcessingStats();
        
        new StatusHistoryModal(
            this.app,
            this.getSafeStatus(),
            recentStats
        ).open();
    }

    /**
     * Start periodic status updates
     */
    private startPeriodicUpdates(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        this.updateInterval = setInterval(() => {
            if (this.currentState === ProcessingState.RUNNING) {
                this.updateDisplay();
            }
        }, this.getConfig().updateInterval);
    }

    /**
     * Get merged configuration with defaults
     */
    private getConfig(): StatusBarConfig {
        return { ...this.DEFAULT_CONFIG, ...this.config };
    }

    /**
     * Get default status object
     */
    private getDefaultStatus(): ProcessingStatus {
        return {
            state: 'idle',
            filesQueued: 0,
            filesProcessed: 0,
            filesRemaining: 0,
            errors: []
        };
    }

    /**
     * Create status object for completion
     */
    private createCompleteStatus(stats: ProcessingStats): ProcessingStatus {
        return {
            state: 'idle',
            filesQueued: stats.totalFiles,
            filesProcessed: stats.processedFiles,
            filesRemaining: 0,
            errors: this.currentStatus.errors || []
        };
    }

    /**
     * Get safe status object with default values
     */
    private getSafeStatus(): ProcessingStatus {
        return {
            ...this.currentStatus,
            errors: this.currentStatus.errors || [],
            filesQueued: this.currentStatus.filesQueued || 0,
            filesProcessed: this.currentStatus.filesProcessed || 0,
            filesRemaining: this.currentStatus.filesRemaining || 0,
            state: this.currentStatus.state || 'idle'
        };
    }

    /**
     * Clean up resources
     */
    public destroy(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        this.eventEmitter.removeAllListeners();
        this.statusBarItem.remove();
    }
}