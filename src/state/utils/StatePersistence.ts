// src/state/utils/StatePersistence.ts

import { PluginState, DEFAULT_PLUGIN_STATE } from '../PluginState';
import { StateValidator } from './StateValidator';

/**
 * Interface for persistence validation result
 */
export interface PersistedStateValidation {
    valid: boolean;
    state: PluginState;
    errors: string[];
}

/**
 * Type guard for narrowing validation result
 */
function isValidationResult<K extends keyof PluginState>(
    key: K, 
    value: any
): value is { valid: boolean; value: PluginState[K]; errors: string[] } {
    return value && 
           typeof value === 'object' && 
           'valid' in value && 
           'value' in value && 
           'errors' in value;
}

/**
 * Utility class for handling state persistence
 */
export class StatePersistence {
    /**
     * Load state from storage with validation
     */
    public static async loadState(
        storageKey: string
    ): Promise<PersistedStateValidation> {
        try {
            const persistedData = localStorage.getItem(storageKey);
            if (!persistedData) {
                return {
                    valid: true,
                    state: { ...DEFAULT_PLUGIN_STATE },
                    errors: []
                };
            }

            return this.validateAndMergeState(JSON.parse(persistedData));
        } catch (error) {
            console.error('Error loading persisted state:', error);
            return {
                valid: false,
                state: { ...DEFAULT_PLUGIN_STATE },
                errors: [(error as Error).message]
            };
        }
    }

    /**
     * Save state to storage
     */
    public static async saveState(
        storageKey: string,
        state: PluginState
    ): Promise<void> {
        try {
            const stateToSave = JSON.stringify(state);
            localStorage.setItem(storageKey, stateToSave);
        } catch (error) {
            console.error('Error saving state:', error);
            throw error;
        }
    }

    /**
     * Clear persisted state
     */
    public static async clearState(storageKey: string): Promise<void> {
        try {
            localStorage.removeItem(storageKey);
        } catch (error) {
            console.error('Error clearing state:', error);
            throw error;
        }
    }

    /**
     * Validate and merge persisted state
     */
    public static validateAndMergeState(
        persisted: unknown
    ): PersistedStateValidation {
        const errors: string[] = [];
        let validState: PluginState = { ...DEFAULT_PLUGIN_STATE };

        if (!persisted || typeof persisted !== 'object') {
            return {
                valid: false,
                state: validState,
                errors: ['Invalid persisted state format']
            };
        }

        // Process each state slice with type checking
        (Object.entries(persisted) as [keyof PluginState, unknown][]).forEach(([key, value]) => {
            if (StateValidator.isPluginStateKey(key)) {
                const validation = StateValidator.validateStateSlice(key, value);
                
                if (isValidationResult(key, validation)) {
                    if (validation.valid && validation.value) {
                        // Merge with current state to maintain type safety
                        validState = {
                            ...validState,
                            [key]: validation.value
                        };
                    } else {
                        errors.push(...validation.errors.map(err => `${key}: ${err}`));
                    }
                }
            }
        });

        return {
            valid: errors.length === 0,
            state: validState,
            errors
        };
    }

    /**
     * Helper method to validate state slice
     */
    public static validateSlice<K extends keyof PluginState>(
        key: K,
        value: unknown,
        currentState: PluginState
    ): PluginState[K] {
        const defaultValue = currentState[key];
        
        try {
            const validation = StateValidator.validateStateSlice(key, value);
            if (validation.valid && validation.value) {
                return validation.value;
            }
        } catch (error) {
            console.error(`Error validating ${key}:`, error);
        }
        
        return defaultValue;
    }
}
