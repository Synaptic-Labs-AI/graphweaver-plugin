// src/state/PluginState.ts

import { AIProvider, AIModel } from '../models/AIModels';
import { OperationType, OperationMetrics, OperationStatus } from 'src/types/OperationTypes';
import { PerformanceMetrics } from '../services/ai/AIStateHandler';
import { PropertyTag, Tag } from '../models/PropertyTag';
import { GeneratorType, GeneratorStatus } from '../services/ai/GeneratorFactory';

/**
 * Core plugin state interface
 */
export interface PluginState {
    // Settings state
    settings: {
        aiProvider: AIProvider;
        customProperties: PropertyTag[];
        customTags: Tag[];
    };

    // Processing state
    processing: {
        isProcessing: boolean;
        currentFile: string | null;
        queue: string[];
        progress: number;
        currentOperation?: OperationType;
        error?: string;
    };

    // AI service state
    ai: {
        isInitialized: boolean;
        isConnected: boolean;
        currentModel: string;
        isProcessing: boolean;
        provider: AIProvider;
        availableModels: AIModel[];
        generators?: Record<GeneratorType, GeneratorStatus>;
        error?: string;
        lastResponse?: string;
        lastError?: {
            message: string;
            timestamp: number;
            source?: string;
            operationType?: OperationType;
        };
        operationMetrics?: Record<OperationType, OperationMetrics>;
        performanceMetrics?: PerformanceMetrics;
        currentOperation?: OperationStatus | null;
        queueLength?: number;
        lastOperation?: OperationStatus;
    };

    // UI state
    ui: {
        darkMode: boolean;
        activeAccordion?: string;
        notifications: Array<{
            id: string;
            message: string;
            type: 'info' | 'success' | 'error';
            timestamp: number;
        }>;
    };

    // File processing state
    files: {
        processedFiles: string[];
        lastProcessed?: string;
        stats: {
            totalProcessed: number;
            successCount: number;
            errorCount: number;
            averageProcessingTime: number;
        };
    };
}

/**
 * Default generator statuses
 */
export const DEFAULT_GENERATOR_STATUSES: Record<GeneratorType, GeneratorStatus> = Object.fromEntries(
    Object.values(GeneratorType).map(type => [
        type,
        {
            isInitialized: false,
            lastRun: null,
            statusMessage: 'Not Initialized'
        }
    ])
) as Record<GeneratorType, GeneratorStatus>;

/**
 * Default plugin state
 */
export const DEFAULT_PLUGIN_STATE: PluginState = {
    settings: {
        aiProvider: AIProvider.OpenAI,
        customProperties: [],
        customTags: []
    },
    processing: {
        isProcessing: false,
        currentFile: null,
        queue: [],
        progress: 0,
        currentOperation: undefined,
        error: undefined
    },
    ai: {
        isInitialized: false,
        isConnected: false,
        currentModel: '',
        isProcessing: false,
        provider: AIProvider.OpenAI,
        availableModels: [],
        generators: DEFAULT_GENERATOR_STATUSES,
        error: undefined,
        lastResponse: undefined,
        lastError: undefined,
        performanceMetrics: undefined,
        currentOperation: null,
        queueLength: 0,
        lastOperation: undefined
    },
    ui: {
        darkMode: false,
        activeAccordion: undefined,
        notifications: []
    },
    files: {
        processedFiles: [],
        lastProcessed: undefined,
        stats: {
            totalProcessed: 0,
            successCount: 0,
            errorCount: 0,
            averageProcessingTime: 0
        }
    }
};

/**
 * State slice selector types
 */
export type StateSelector<T extends keyof PluginState> = (state: PluginState) => PluginState[T];

/**
 * State update types
 */
export type StateUpdate<T extends keyof PluginState> = Partial<PluginState[T]>;

/**
 * State subscription callback types
 */
export type StateSubscriber<T extends keyof PluginState> = (
    state: PluginState[T],
    previousState: PluginState[T]
) => void;