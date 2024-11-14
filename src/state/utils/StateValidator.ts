// src/state/utils/StateValidator.ts

import { PluginState, DEFAULT_PLUGIN_STATE } from '../PluginState';
import { STATE_VALIDATION_SCHEMA } from './StateTypes';

/**
 * Validation result interface with strong typing
 */
interface ValidationResult<K extends keyof PluginState> {
    valid: boolean;
    value: PluginState[K] | undefined;
    errors: string[];
}

/**
 * Utility class for validating state slices
 */
export class StateValidator {
    /**
     * Validate a specific state slice with type safety
     */
    public static validateStateSlice<K extends keyof PluginState>(
        key: K,
        value: unknown
    ): ValidationResult<K> {
        try {
            if (!value || typeof value !== 'object') {
                return {
                    valid: false,
                    value: undefined,
                    errors: ['Value must be an object']
                };
            }

            const schema = STATE_VALIDATION_SCHEMA[key];
            const errors: string[] = [];

            // Check required properties
            for (const required of schema.required) {
                if (!(required in (value as object))) {
                    errors.push(`Missing required property: ${String(required)}`);
                }
            }

            if (errors.length > 0) {
                return {
                    valid: false,
                    value: undefined,
                    errors
                };
            }

            // Create a type-safe merged value with defaults
            const mergedValue = {
                ...DEFAULT_PLUGIN_STATE[key],
                ...(value as Partial<PluginState[K]>)
            };

            return {
                valid: true,
                value: mergedValue as PluginState[K],
                errors: []
            };
        } catch (error) {
            return {
                valid: false,
                value: undefined,
                errors: [(error as Error).message]
            };
        }
    }

    /**
     * Validate if key is a valid plugin state key
     */
    public static isPluginStateKey(key: string): key is keyof PluginState {
        return key in DEFAULT_PLUGIN_STATE;
    }

    /**
     * Get type safe default state slice
     */
    public static getDefaultSlice<K extends keyof PluginState>(key: K): PluginState[K] {
        return { ...DEFAULT_PLUGIN_STATE[key] };
    }
}