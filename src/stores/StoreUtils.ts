// src/stores/StoreUtils.ts

import { writable, type Writable, get } from 'svelte/store';
import type { StoreValidation, StoreUpdate, BaseStore } from '../types/store.types';

/**
 * Creates an enhanced store with additional functionality
 * @param initialState Initial state value
 * @param validator Optional validation function
 * @returns Enhanced store instance
 */
export function createEnhancedStore<T extends Record<string, any> | null>(initialValue: T): BaseStore<T> {
    let currentValue = initialValue;
    const subscribers: Array<(value: T) => void> = [];

    return {
        subscribe(run, invalidate) {
            subscribers.push(run);
            run(currentValue);
            return () => {
                const index = subscribers.indexOf(run);
                if (index > -1) {
                    subscribers.splice(index, 1);
                }
            };
        },
        set(value: T) {
            currentValue = value;
            subscribers.forEach(sub => sub(currentValue));
        },
        update(updater: (value: T) => T) {
            this.set(updater(currentValue));
        },
        initialize(initialData: Partial<T>) {
            currentValue = { ...currentValue, ...initialData } as T;
            this.set(currentValue);
        },
        reset() {
            currentValue = initialValue;
            this.set(currentValue);
        },
        getSnapshot() {
            return currentValue;
        }
    };
}

/**
 * Creates a persisted store that saves to localStorage
 */
export function createPersistedStore<T extends Record<string, any>>(
    key: string,
    initialState: T,
    validator?: (state: Partial<T>) => boolean
): BaseStore<T> {
    // Load persisted data if available
    const loadPersistedData = (): Partial<T> | null => {
        try {
            const stored = localStorage.getItem(key);
            if (!stored) return null;

            const parsed = JSON.parse(stored);
            if (validator && !validator(parsed)) {
                console.error('🦇 Invalid persisted state:', parsed);
                return null;
            }

            return parsed;
        } catch (error) {
            console.error('🦇 Error loading persisted state:', error);
            return null;
        }
    };

    // Create store with persisted or initial state
    const store = createEnhancedStore<T>(
        { ...initialState, ...(loadPersistedData() || {}) }
    );

    // Subscribe to changes and persist
    store.subscribe(state => {
        try {
            localStorage.setItem(key, JSON.stringify(state));
        } catch (error) {
            console.error('🦇 Error persisting state:', error);
        }
    });

    return store;
}

/**
 * Type-safe update helper for nested state
 */
export function updateNestedState<T extends Record<string, any>, K extends keyof T>(
    store: Writable<T>,
    key: K,
    value: StoreUpdate<T[K]>
): void {
    store.update(state => ({
        ...state,
        [key]: typeof value === 'function'
            ? (value as (prev: T[K]) => T[K])(state[key])
            : value
    }));
}

/**
 * Validates store state against schema
 */
export function validateState<T extends Record<string, any>>(
    state: Partial<T>,
    schema: Record<keyof T, { required?: boolean; type?: string }>
): StoreValidation<T> {
    const errors: string[] = [];

    // Check required fields
    (Object.keys(schema) as Array<keyof T>).forEach(key => {
        const fieldSchema = schema[key];
        if (fieldSchema.required && !(key in state)) {
            errors.push(`Missing required field: ${String(key)}`);
        }
    });

    // Validate types
    (Object.keys(state) as Array<keyof T>).forEach(key => {
        const fieldSchema = schema[key];
        const value = state[key];
        if (fieldSchema.type && typeof value !== fieldSchema.type) {
            errors.push(`Invalid type for ${String(key)}: expected ${fieldSchema.type}, got ${typeof value}`);
        }
    });

    return {
        isValid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
        value: errors.length === 0 ? (state as T) : undefined
    };
}

/**
 * Creates a derived state slice
 */
export function deriveSlice<T extends Record<string, any>, K extends keyof T>(
    store: Writable<T>,
    key: K
): Writable<T[K]> {
    return {
        subscribe: (run, invalidate) => {
            // Wrap the invalidate function to match the expected type
            const wrappedInvalidate: (value?: T[K]) => void = () => {
                if (invalidate) invalidate();
            };

            return store.subscribe(
                state => run(state[key]),
                wrappedInvalidate as any // Type assertion to bypass type mismatch
            );
        },
        set: (value: T[K]) => {
            store.update(state => ({ ...state, [key]: value }));
        },
        update: (updater: (value: T[K]) => T[K]) => {
            store.update(state => ({
                ...state,
                [key]: updater(state[key])
            }));
        }
    };
}

/**
 * Debounces store updates
 */
export function debounceStore<T extends Record<string, any>>(
    store: Writable<T>,
    delay: number
): Writable<T> {
    let timeout: ReturnType<typeof setTimeout>;

    return {
        subscribe: store.subscribe,
        set: (value: T) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                store.set(value);
            }, delay);
        },
        update: (updater: (value: T) => T) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                store.update(updater);
            }, delay);
        }
    };
}

/**
 * Combines multiple stores into one
 */
export function combineStores<T extends Record<string, Writable<any>>>(
    stores: T
): Writable<{ [K in keyof T]: T[K] extends Writable<infer U> ? U : never }> {
    const combinedInitialState = Object.keys(stores).reduce((acc, key) => {
        acc[key as keyof T] = get(stores[key as keyof T]);
        return acc;
    }, {} as { [K in keyof T]: T[K] extends Writable<infer U> ? U : never });

    const combined = writable(combinedInitialState);

    Object.entries(stores).forEach(([key, store]) => {
        store.subscribe(value => {
            combined.update(state => ({
                ...state,
                [key]: value
            }));
        });
    });

    return combined;
}

/**
 * Creates an undoable store
 */
export function createUndoableStore<T extends Record<string, any>>(
    initialState: T,
    maxHistory: number = 10
): BaseStore<T> & {
    undo: () => void;
    redo: () => void;
    canUndo: () => boolean;
    canRedo: () => boolean;
} {
    const store = createEnhancedStore<T>(initialState);
    const history: T[] = [initialState];
    let currentIndex = 0;

    function addToHistory(state: T) {
        if (currentIndex < history.length - 1) {
            history.splice(currentIndex + 1);
        }
        history.push(state);
        if (history.length > maxHistory) {
            history.shift();
        }
        currentIndex = history.length - 1;
    }

    return {
        ...store,
        update: (updater) => {
            store.update(state => {
                const newState = typeof updater === 'function' ? updater(state) : updater;
                addToHistory(newState);
                return newState;
            });
        },
        set: (value) => {
            addToHistory(value);
            store.set(value);
        },
        undo: () => {
            if (currentIndex > 0) {
                currentIndex--;
                store.set(history[currentIndex]);
            }
        },
        redo: () => {
            if (currentIndex < history.length - 1) {
                currentIndex++;
                store.set(history[currentIndex]);
            }
        },
        canUndo: () => currentIndex > 0,
        canRedo: () => currentIndex < history.length - 1
    };
}
