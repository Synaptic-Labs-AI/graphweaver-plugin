// src/state/utils/StateTypes.ts

import { PluginState } from '../PluginState';

/**
 * Type to get validation schema for each state slice
 */
export type StateValidationSchema = {
    [K in keyof PluginState]: {
        required: Array<keyof PluginState[K]>;
        optional?: Array<keyof PluginState[K]>;
    }
};

/**
 * State slice validation result
 */
export interface StateSliceValidation<K extends keyof PluginState> {
    valid: boolean;
    value?: PluginState[K];
    errors: string[];
}

/**
 * Helper type for type-safe state updates
 */
export type TypedStateUpdate<K extends keyof PluginState> = {
    key: K;
    value: Partial<PluginState[K]>;
};

/**
 * Validation schema for each state slice
 */
export const STATE_VALIDATION_SCHEMA: StateValidationSchema = {
    settings: {
        required: ['aiProvider', 'customProperties', 'customTags']
    },
    processing: {
        required: ['isProcessing', 'currentFile', 'queue', 'progress'],
        optional: ['currentOperation', 'error']
    },
    ai: {
        required: [
            'isInitialized',
            'isConnected',
            'currentModel',
            'isProcessing',
            'provider',
            'availableModels'
        ],
        optional: [
            'generators',
            'error',
            'lastResponse',
            'lastError',
            'operationMetrics',
            'performanceMetrics',
            'currentOperation',
            'queueLength',
            'lastOperation'
        ]
    },
    ui: {
        required: ['darkMode', 'notifications'],
        optional: ['activeAccordion']
    },
    files: {
        required: ['processedFiles', 'stats'],
        optional: ['lastProcessed']
    }
};