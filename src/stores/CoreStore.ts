// src/stores/CoreStore.ts
import { writable, derived, get } from 'svelte/store';
import type { Plugin } from 'obsidian';
import type { AIProvider, AIModel } from '@type/ai.types';

// Core state types
interface RootState {
    plugin: Plugin | null;
    initialized: boolean;
    lastUpdate: number;
}

export interface ErrorState {
    message: string | null;
    timestamp: number | null;
    type: 'error' | 'warning' | null;
    context?: Record<string, any>;
}

// Create the core store creator with persistence
function createPersistentStore<T>(key: string, initialState: T) {
    // Load persisted state if it exists
    const loadState = (): T => {
        try {
            const saved = localStorage.getItem(key);
            return saved ? { ...initialState, ...JSON.parse(saved) } : initialState;
        } catch {
            return initialState;
        }
    };

    const { subscribe, set, update } = writable<T>(loadState());

    return {
        subscribe,
        set,
        update,
        // Type-safe patch method
        patch: (partial: Partial<T>) => {
            update(state => ({ ...state, ...partial }));
        },
        // Reset to initial state
        reset: () => set(initialState),
        // Persist state
        persist: () => {
            const state = get({ subscribe });
            localStorage.setItem(key, JSON.stringify(state));
        }
    };
}

// Create the root store
export const core = createPersistentStore<RootState>('graphweaver-core', {
    plugin: null,
    initialized: false,
    lastUpdate: Date.now()
});

// Create the error store
export const errors = writable<ErrorState>({
    message: null,
    timestamp: null,
    type: null,
    context: {}
});

// Export core utilities
export const utils = {
    initialize: (plugin: Plugin) => {
        core.patch({ 
            plugin,
            initialized: true,
            lastUpdate: Date.now()
        });
    },

    reportError: (message: string, type: 'error' | 'warning' = 'error', context?: Record<string, any>) => {
        errors.set({
            message,
            type,
            timestamp: Date.now(),
            context
        });
    },

    clearError: () => {
        errors.set({
            message: null,
            timestamp: null,
            type: null
        });
    }
};

// Export derived states
export const isInitialized = derived(core, $core => $core.initialized);
export const hasError = derived(errors, $errors => $errors.message !== null);