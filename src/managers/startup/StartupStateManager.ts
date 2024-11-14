import { EventEmitter } from 'events';

/**
 * Enum for tracking startup generation state
 */
export enum StartupState {
    NotStarted = 'not_started',
    Initializing = 'initializing',
    Scanning = 'scanning',
    Processing = 'processing',
    Completed = 'completed',
    Error = 'error'
}

/**
 * Interface for startup state events
 * Export this for type usage
 */
export interface StartupStateEvents {
    stateChanged: (state: StartupState) => void;
    progress: (processed: number, total: number) => void;
    error: (error: Error) => void;
    completed: () => void;
}

/**
 * Manages startup state and transitions
 */
export class StartupStateManager {
    private currentState: StartupState = StartupState.NotStarted;
    private eventEmitter: EventEmitter;
    private isUnloading: boolean = false;

    constructor() {
        this.eventEmitter = new EventEmitter();
    }

    /**
     * Set current state with validation
     */
    public setState(state: StartupState): void {
        if (this.isUnloading) return;

        this.currentState = state;
        this.emitEvent('stateChanged', state);
    }

    /**
     * Get current state
     */
    public getState(): StartupState {
        return this.currentState;
    }

    /**
     * Emit progress update
     */
    public emitProgress(processed: number, total: number): void {
        if (this.isUnloading) return;
        this.emitEvent('progress', processed, total);
    }

    /**
     * Type-safe event subscription
     */
    public on<K extends keyof StartupStateEvents>(
        event: K,
        callback: StartupStateEvents[K]
    ): void {
        if (!this.isUnloading) {
            this.eventEmitter.on(event, callback);
        }
    }

    /**
     * Public method to emit events
     */
    public emitEvent<K extends keyof StartupStateEvents>(
        event: K,
        ...args: Parameters<StartupStateEvents[K]>
    ): void {
        if (!this.isUnloading) {
            this.eventEmitter.emit(event, ...args);
        }
    }

    /**
     * Clean up resources
     */
    public destroy(): void {
        this.isUnloading = true;
        this.eventEmitter.removeAllListeners();
    }
}