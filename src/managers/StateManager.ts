// src/managers/StateManager.ts

import { debounce } from "lodash";
import { EventEmitter } from 'events';
import { PluginState, DEFAULT_PLUGIN_STATE, StateSelector, StateSubscriber, StateUpdate } from "../state/PluginState";
import { StateUpdater } from "../state/utils/StateUpdater";
import { StatePersistence } from "../state/utils/StatePersistence";
import { IService } from '../services/core/IService';
import { ServiceError } from '../services/core/ServiceError';
import { ServiceState } from '../state/ServiceState';

/**
 * Configuration options for state manager
 */
interface StateManagerOptions {
    persistDebounce?: number;
    debug?: boolean;
    storageKeyPrefix?: string;
}

/**
 * State change event types with proper typing
 */
export enum StateEventType {
    StateChanged = 'stateChanged',
    StateUpdated = 'stateUpdated',
    StateReset = 'stateReset',
    PersistenceError = 'persistenceError',
    ValidationError = 'validationError',
    Unloading = 'unloading'
}

/**
 * Event handler mapping interface
 */
interface StateEventHandlers {
    [StateEventType.StateChanged]: (key: keyof PluginState, value: any) => void;
    [StateEventType.ValidationError]: (error: Error) => void;
    [StateEventType.PersistenceError]: (error: Error) => void;
    [StateEventType.StateReset]: () => void;
    [StateEventType.Unloading]: () => void;
}

/**
 * Base state manager class with improved event handling
 */
export class StateManager extends EventEmitter implements IService {
    public readonly serviceId: string = 'state-manager';
    public readonly serviceName: string = 'State Manager';

    protected serviceState: ServiceState = ServiceState.Uninitialized;
    protected error: ServiceError | null = null;

    protected state: PluginState;
    protected previousState: PluginState;
    protected subscribers: Map<keyof PluginState, Set<StateSubscriber<keyof PluginState>>>;
    protected options: Required<StateManagerOptions>;
    protected eventHandlers: Partial<StateEventHandlers>;
    protected isUnloading: boolean = false;

    /**
     * Constructor initializes state and options
     * @param initialState Initial state of the plugin
     * @param options Configuration options
     */
    constructor(
        initialState: PluginState = DEFAULT_PLUGIN_STATE,
        options: StateManagerOptions = {}
    ) {
        super();

        this.state = { ...initialState };
        this.previousState = { ...initialState };
        this.subscribers = new Map();
        this.options = {
            persistDebounce: 1000,
            debug: false,
            storageKeyPrefix: 'graphweaver_',
            ...options
        };

        this.eventHandlers = {};
        this.setupEventHandlers();
    }

    /**
     * Initialize the service
     */
    public async initialize(): Promise<void> {
        try {
            this.serviceState = ServiceState.Initializing;
            // Perform any initialization logic if needed
            await this.initializeInternal();
            this.serviceState = ServiceState.Ready;
            if (this.options.debug) {
            }
        } catch (error) {
            this.serviceState = ServiceState.Error;
            this.error = ServiceError.from(
                this.serviceName,
                error,
                { context: 'Initialization failed' }
            );
            this.emit(StateEventType.ValidationError, this.error);
            throw this.error;
        }
    }

    /**
     * Check if service is ready
     */
    public isReady(): boolean {
        return this.serviceState === ServiceState.Ready && !this.isUnloading;
    }

    /**
     * Destroy the service
     */
    public async destroy(): Promise<void> {
        try {
            this.serviceState = ServiceState.Destroying;
            this.isUnloading = true;
            this.emit(StateEventType.Unloading);
            // Clean up resources
            await this.destroyInternal();
            this.subscribers.clear();
            this.eventHandlers = {};
            this.removeAllListeners();
            this.serviceState = ServiceState.Destroyed;
            if (this.options.debug) {
            }
        } catch (error) {
            this.serviceState = ServiceState.Error;
            this.error = ServiceError.from(
                this.serviceName,
                error,
                { context: 'Destroy failed' }
            );
            this.emit(StateEventType.ValidationError, this.error);
            throw this.error;
        }
    }

    /**
     * Get current service state
     */
    public getState(): { state: ServiceState; error: ServiceError | null } {
        return { state: this.serviceState, error: this.error };
    }

    /**
     * Internal initialization method to be implemented by derived classes
     */
    protected async initializeInternal(): Promise<void> {
        // To be overridden by subclasses if needed
    }

    /**
     * Internal cleanup method to be implemented by derived classes
     */
    protected async destroyInternal(): Promise<void> {
        // To be overridden by subclasses if needed
    }

    /**
     * Set up event handlers with type safety
     */
    protected setupEventHandlers(): void {
        this.eventHandlers[StateEventType.StateChanged] = (key: keyof PluginState, value: any) => {
            if (this.options.debug) {
            }
        };

        this.eventHandlers[StateEventType.ValidationError] = (error: Error) => {
            console.error('State validation error:', error);
        };

        this.eventHandlers[StateEventType.PersistenceError] = (error: Error) => {
            console.error('State persistence error:', error);
        };

        // Register handlers with EventEmitter
        Object.entries(this.eventHandlers).forEach(([event, handler]) => {
            if (handler) {
                this.on(event, handler);
            }
        });
    }

    /**
     * Subscribe to state changes with automatic cleanup
     */
    public subscribe<K extends keyof PluginState>(
        key: K,
        subscriber: StateSubscriber<K>
    ): () => void {
        if (this.isUnloading) return () => {};

        if (!this.subscribers.has(key)) {
            this.subscribers.set(key, new Set());
        }

        const subscribers = this.subscribers.get(key);
        subscribers?.add(subscriber as StateSubscriber<keyof PluginState>);

        // Return unsubscribe function
        return () => {
            if (!this.isUnloading) {
                subscribers?.delete(subscriber as StateSubscriber<keyof PluginState>);
                if (subscribers?.size === 0) {
                    this.subscribers.delete(key);
                }
            }
        };
    }

    /**
     * Update state with validation and error handling
     */
    public update<K extends keyof PluginState>(
        key: K,
        update: StateUpdate<K>,
        source?: string
    ): void {
        if (this.isUnloading) return;

        try {
            this.previousState = { ...this.state };
            
            // Validate update
            if (!this.validateUpdate(key, update)) {
                throw new Error(`Invalid update for key: ${String(key)}`);
            }
            
            // Use StateUpdater to handle the update
            const newValue = StateUpdater.updateSlice(key, this.state[key], update);
            this.state[key] = newValue;

            this.emit(StateEventType.StateUpdated, key, newValue, source);
            this.notifySubscribers(key);
            
        } catch (error) {
            console.error(`Error updating state for key ${String(key)}:`, error);
            this.emit(StateEventType.ValidationError, error);
            throw error;
        }
    }

    /**
     * Validate state updates before applying
     */
    protected validateUpdate<K extends keyof PluginState>(
        key: K,
        update: StateUpdate<K>
    ): boolean {
        return key in this.state && update !== undefined;
    }

    /**
     * Select state slice with type safety
     */
    public select<K extends keyof PluginState>(selector: StateSelector<K>): PluginState[K] {
        return selector(this.state);
    }

    /**
     * Get immutable state snapshot
     */
    public getSnapshot(): Readonly<PluginState> {
        return Object.freeze({ ...this.state });
    }

    /**
     * Get immutable previous state
     */
    public getPreviousState(): Readonly<PluginState> {
        return Object.freeze({ ...this.previousState });
    }

    /**
     * Reset state to defaults
     */
    public reset(): void {
        if (this.isUnloading) return;
        
        this.state = { ...DEFAULT_PLUGIN_STATE };
        this.emit(StateEventType.StateReset);
    }

    /**
     * Notify subscribers with error handling
     */
    protected notifySubscribers(key: keyof PluginState): void {
        if (this.isUnloading) return;

        const subscribers = this.subscribers.get(key);
        if (subscribers) {
            for (const subscriber of subscribers) {
                try {
                    subscriber(this.state[key], this.previousState[key]);
                } catch (error) {
                    console.error(`Error in state subscriber for key ${String(key)}:`, error);
                    this.emit(StateEventType.ValidationError, error);
                }
            }
        }
    }
}

/**
 * Persistent state manager with improved error handling
 */
export class PersistentStateManager extends StateManager {
    public readonly storageKey: string;
    public readonly debouncedPersist: ReturnType<typeof debounce>;
    private persistenceTimeout?: NodeJS.Timeout;

    /**
     * Constructor initializes persistence settings
     * @param initialState Initial state of the plugin
     * @param storageKey Key used for storing state
     * @param options Configuration options
     */
    constructor(
        initialState: PluginState = DEFAULT_PLUGIN_STATE,
        storageKey: string,
        options: StateManagerOptions = {}
    ) {
        super(initialState, options);
        this.storageKey = `${this.options.storageKeyPrefix}${storageKey}`;

        this.debouncedPersist = debounce(
            async () => this.persistState(),
            this.options.persistDebounce
        );

        this.initializePersistedState();
    }

    /**
     * Initialize persisted state with error handling
     */
    public async initializePersistedState(): Promise<void> {
        if (this.isUnloading) return;

        try {
            const validation = await StatePersistence.loadState(this.storageKey);

            if (validation.valid && Object.keys(validation.state).length > 0) {
                Object.entries(validation.state).forEach(([key, value]) => {
                    if (key in this.state) {
                        this.update(key as keyof PluginState, value);
                    }
                });
            } else if (validation.errors.length > 0) {
                console.warn('State validation errors:', validation.errors);
            }

            this.emit(StateEventType.StateChanged, 'initialized', true);
        } catch (error) {
            console.error('Error initializing persisted state:', error);
            this.emit(StateEventType.PersistenceError, error);
        }
    }

    /**
     * Persist state with timeout handling
     */
    public async persistState(): Promise<void> {
        if (this.isUnloading) return;

        try {
            // Cancel any pending persistence
            if (this.persistenceTimeout) {
                clearTimeout(this.persistenceTimeout);
            }

            // Set new timeout for persistence
            this.persistenceTimeout = setTimeout(async () => {
                try {
                    await StatePersistence.saveState(this.storageKey, this.state);
                    if (this.options.debug) {
                    }
                } catch (error) {
                    console.error('Error persisting state:', error);
                    this.emit(StateEventType.PersistenceError, error);
                }
            }, this.options.persistDebounce);

        } catch (error) {
            console.error('Error setting up state persistence:', error);
            this.emit(StateEventType.PersistenceError, error);
        }
    }

    /**
     * Override update to trigger persistence
     */
    public override update<K extends keyof PluginState>(
        key: K,
        update: StateUpdate<K>,
        source?: string
    ): void {
        if (this.isUnloading) return;

        super.update(key, update, source);
        this.debouncedPersist();
    }

    /**
     * Clear persisted state with error handling
     */
    public async clearPersistedState(): Promise<void> {
        if (this.isUnloading) return;

        try {
            await StatePersistence.clearState(this.storageKey);
            this.reset();
            if (this.options.debug) {
            }
        } catch (error) {
            console.error('Error clearing persisted state:', error);
            this.emit(StateEventType.PersistenceError, error);
        }
    }

    /**
     * Enhanced cleanup including persistence timeout
     */
    public override async destroy(): Promise<void> {
        // Cancel any pending persistence
        if (this.persistenceTimeout) {
            clearTimeout(this.persistenceTimeout);
        }

        // Cancel debounced persist
        this.debouncedPersist.cancel();

        // Call parent destroy
        await super.destroy();
    }
}
