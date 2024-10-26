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

// Define ProcessingState as enum
const enum ProcessingState {
    IDLE = 'idle',
    RUNNING = 'running',
    PAUSED = 'paused',
    ERROR = 'error'
}

/**
 * Status bar component showing processing state and history
 */
export class ProcessingStatusBar {
    private statusBarItem: HTMLElement;
    private iconContainer: HTMLElement;
    private currentState: ProcessingState = ProcessingState.IDLE;
    private currentStatus: ProcessingStatus = {
        state: 'idle',
        filesQueued: 0,
        filesProcessed: 0,
        filesRemaining: 0,
        errors: []
    };

    constructor(
        private app: App,
        private statusBar: HTMLElement,
        private eventEmitter: EventEmitter,
        private aiService: AIService,
        private settingsService: SettingsService,
        private databaseService: DatabaseService
    ) {
        this.initialize();
    }

    /**
     * Initialize the status bar UI
     */
    private initialize(): void {
        this.statusBarItem = this.statusBar.createEl('div', {
            cls: 'processing-status-bar mod-clickable'
        });

        this.iconContainer = this.statusBarItem.createDiv({
            cls: 'processing-status-icon'
        });

        this.updateIcon(ProcessingState.IDLE);
        this.statusBarItem.addEventListener('click', this.handleClick.bind(this));
        this.activateListeners();
    }

    /**
     * Set up all event listeners
     */
    private activateListeners(): void {
        this.eventEmitter.on('start', (data: ProcessingEvent['start']) => {
            if (data && data.status) {
                this.currentStatus = data.status;
                this.updateIcon(ProcessingState.RUNNING);
            }
        });
    
        this.eventEmitter.on('complete', async (stats: ProcessingEvent['complete']) => {
            if (stats) {
                this.currentStatus = {
                    state: 'idle',
                    filesQueued: stats.totalFiles,
                    filesProcessed: stats.processedFiles,
                    filesRemaining: 0,
                    errors: this.currentStatus.errors || []
                };
            }
            this.updateIcon(ProcessingState.IDLE);
        });
    
        this.eventEmitter.on('progress', (status: ProcessingEvent['progress']) => {
            if (status) {
                this.currentStatus = status;
            }
        });
    }

    /**
     * Update the status icon based on state
     */
    private updateIcon(state: ProcessingState): void {
        this.currentState = state;
        this.iconContainer.empty();

        const iconMap: Record<ProcessingState, string> = {
            [ProcessingState.IDLE]: 'check',
            [ProcessingState.RUNNING]: 'loader-2',
            [ProcessingState.PAUSED]: 'pause',
            [ProcessingState.ERROR]: 'alert-triangle'
        };

        setIcon(this.iconContainer, iconMap[state]);
        this.iconContainer.toggleClass('rotating', state === ProcessingState.RUNNING);
        
        const states = [
            ProcessingState.IDLE,
            ProcessingState.RUNNING,
            ProcessingState.PAUSED,
            ProcessingState.ERROR
        ];
        
        states.forEach(s => {
            this.statusBarItem.toggleClass(`status-${s}`, state === s);
        });
    }

    /**
     * Handle click event - open history modal with real data
     */
    private async handleClick(): Promise<void> {
        const recentStats = await this.databaseService.getProcessingStats();
        const safeStatus = {
            ...this.currentStatus,
            errors: this.currentStatus.errors || [],
            filesQueued: this.currentStatus.filesQueued || 0,
            filesProcessed: this.currentStatus.filesProcessed || 0,
            filesRemaining: this.currentStatus.filesRemaining || 0,
            state: this.currentStatus.state || 'idle'
        };
    
        new StatusHistoryModal(
            this.app,
            safeStatus,
            recentStats
        ).open();
    }

    /**
     * Clean up resources
     */
    public destroy(): void {
        this.eventEmitter.removeAllListeners();
        this.statusBarItem.remove();
    }
}