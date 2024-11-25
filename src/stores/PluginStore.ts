// src/stores/PluginStore.ts
import type { App, Plugin } from 'obsidian';
import { derived, get } from 'svelte/store';
import type { PluginStore as IPluginStore, PluginState } from '@type/store.types';
import { core, utils as coreUtils } from './CoreStore';
import { DEFAULT_PLUGIN_STATE } from '@type/store.types';
import type { StoreUpdate } from '@type/store.types';
import { createBaseStore } from './StoreUtils';
import { DEFAULT_SETTINGS } from '@type/settings.types';

/**
 * PluginStore - Manages global plugin state
 */
export class PluginStore implements IPluginStore {
    private static readonly STORAGE_KEY = 'graphweaver-plugin-state';
    private static instance: PluginStore | null = null;
    private readonly store;
    public subscribe;
    public set;
    public update;

    private constructor() {
        // Create store with complete initial state
        this.store = createBaseStore<PluginState>({
            plugin: null,
            app: null,
            settings: DEFAULT_SETTINGS,
            processing: DEFAULT_PLUGIN_STATE.processing,
            ai: DEFAULT_PLUGIN_STATE.ai,
            ui: DEFAULT_PLUGIN_STATE.ui,
            files: DEFAULT_PLUGIN_STATE.files
        });

        // Bind store methods
        this.subscribe = this.store.subscribe;
        this.set = this.store.set;
        this.update = this.store.update;
    }

    public static getInstance(): PluginStore {
        if (!PluginStore.instance) {
            PluginStore.instance = new PluginStore();
        }
        return PluginStore.instance;
    }

    async initialize(): Promise<void> {
        try {
            const coreState = get(core);
            if (!coreState.initialized) {
                throw new Error('Core store must be initialized first');
            }
            await this.saveState(this.getSnapshot());
        } catch (error) {
            this.handleError('Failed to initialize Plugin Store', error);
            throw error;
        }
    }

    updateSection<K extends keyof PluginState>(
        section: K,
        update: StoreUpdate<PluginState[K]>
    ): void {
        try {
            const currentState = this.getSnapshot();
            this.update(state => {
                const newState = {
                    ...state,
                    [section]: typeof update === 'function'
                        ? (update as (prev: PluginState[K]) => PluginState[K])(state[section])
                        : { ...state[section], ...update }
                };
                return this.resetVolatileState(newState);
            });
            this.saveState(this.getSnapshot());
        } catch (error) {
            this.handleError(`Failed to update section: ${String(section)}`, error);
        }
    }

    async reset(): Promise<void> {
        this.set(structuredClone(DEFAULT_PLUGIN_STATE));
        await this.saveState(this.getSnapshot());
    }

    getSnapshot(): PluginState {
        return get(this.store);
    }

    private async saveState(state: PluginState): Promise<void> {
        try {
            const persistedState = this.resetVolatileState(state);
            localStorage.setItem(PluginStore.STORAGE_KEY, JSON.stringify(persistedState));
        } catch (error) {
            this.handleError('Failed to save state', error);
        }
    }

    private resetVolatileState(state: PluginState): PluginState {
        return {
            ...DEFAULT_PLUGIN_STATE,
            ...state,
            processing: {
                ...DEFAULT_PLUGIN_STATE.processing,
                ...state.processing,
                isProcessing: false,
                currentFile: null,
                progress: 0
            },
            ai: {
                ...DEFAULT_PLUGIN_STATE.ai,
                ...state.ai,
                isProcessing: false,
                currentOperation: null
            },
            ui: {
                ...DEFAULT_PLUGIN_STATE.ui,
                ...state.ui,
                notifications: []
            },
            files: {
                ...DEFAULT_PLUGIN_STATE.files,
                ...state.files
            }
        };
    }

    private handleError(message: string, error: unknown): void {
        coreUtils.reportError(message, 'error', { error });
    }

    private sanitizeState(state: PluginState): PluginState {
        return {
            ...state,
            plugin: state.plugin, // Keep the full plugin instance
            app: state.app ? {
                workspace: {
                    activeLeaf: state.app.workspace?.activeLeaf,
                    config: state.app.workspace?.config
                }
            } : null
        };
    }
}

// Create singleton instance
export const pluginStore = PluginStore.getInstance();

// Derived stores with explicit typing
export const settingsState = derived<typeof pluginStore, PluginState['settings']>(
    pluginStore, 
    $store => ($store as PluginState).settings
);

export const processingState = derived<typeof pluginStore, PluginState['processing']>(
    pluginStore, 
    $store => ($store as PluginState).processing
);

export const aiState = derived<typeof pluginStore, PluginState['ai']>(
    pluginStore, 
    $store => ($store as PluginState).ai
);

export const uiState = derived<typeof pluginStore, PluginState['ui']>(
    pluginStore, 
    $store => ($store as PluginState).ui
);

export const filesState = derived<typeof pluginStore, PluginState['files']>(
    pluginStore, 
    $store => ($store as PluginState).files
);

export const pluginStatus = derived<typeof pluginStore, {
    isInitialized: boolean;
    isProcessing: boolean;
    hasErrors: boolean;
    activeSection: string | null;
    serviceState: PluginState;
}>(pluginStore, ($store) => {
    const state = $store as PluginState;
    return {
        isInitialized: state.ai.isInitialized,
        isProcessing: state.processing.isProcessing,
        hasErrors: state.processing.errors.length > 0 || !!state.ai.error,
        activeSection: state.ui.activeAccordion,
        serviceState: pluginStore.getSnapshot()
    };
});