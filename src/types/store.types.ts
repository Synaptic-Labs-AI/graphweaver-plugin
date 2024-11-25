import { AIModel, AIProvider } from '@type/ai.types';
import { StateEvent } from '../stores/AIStore';
import type { Readable } from 'svelte/store';
import {
    OperationType,
    type OperationMetrics,
    type OperationStatus
} from '@type/operations.types';
import {
    ProcessingStateEnum,
    type ProcessingState
} from '@type/processing.types';
import { DEFAULT_SETTINGS, type PluginSettings } from './settings.types';
import {
    GeneratorType,
    GeneratorStatus
} from '@services/ai/GeneratorFactory';
import type { Plugin } from 'obsidian';
import { BaseError, LifecycleState } from './base.types';

// Add StoreError interface
export interface StoreError extends BaseError {
    retryCount?: number;
    message: string;
    timestamp: number;
}

// ============================================================================
// Core Store Types
// ============================================================================

/**
 * Generic store update type
 */
export type StoreUpdate<T> = Partial<T> | ((state: T) => T);

/**
 * Store subscriber function type
 */
export type StoreSubscriber<T> = (value: T) => void;

/**
 * Store unsubscriber function type
 */
export type StoreUnsubscriber = () => void;

/**
 * Base store interface
 */
export interface BaseStore<T> {
    /** Subscribe to store changes */
    subscribe: (
        run: StoreSubscriber<T>,
        invalidate?: () => void
    ) => StoreUnsubscriber;
    /** Set store value */
    set: (value: T) => void;
    /** Update store value */
    update: (updater: (value: T) => T) => void;
    /** Initialize store */
    initialize: (initialData: Partial<T>) => void;
    /** Reset store */
    reset: () => void;
    /** Get store snapshot */
    getSnapshot: () => T;
}

/**
 * Store initialization configuration
 */
export interface StoreInitConfig {
    settings?: Partial<PluginSettings>;
    processing?: Partial<ProcessingState>;
    ai?: Partial<AIState>;
    ui?: Partial<UIState>;
    files?: Partial<FilesState>;
}

/**
 * Store initialization data structure
 */
export interface StoreInitializationData {
    plugin: Plugin;
    data?: StoreInitConfig;
}

/**
 * Registry of available stores
 */
export type StoreRegistry = {
    plugin: PluginStore;
    settings: SettingsStore;
    processing: ProcessingStore;
    ui: UIStore;
    ai: AIStore;
};

export type StoreId = keyof StoreRegistry;

// ============================================================================
// Performance Metrics Types
// ============================================================================

/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
    responseTime: {
        average: number;
        min: number;
        max: number;
        samples: number;
    };
    successRate: {
        total: number;
        successful: number;
        rate: number;
    };
    errorRate: {
        total: number;
        errors: number;
        rate: number;
    };
    operationMetrics: Record<
        OperationType,
        {
            count: number;
            averageTime: number;
            errorCount: number;
        }
    >;
}

// ============================================================================
// Store State Types
// ============================================================================

/**
 * Store state interface
 */
export interface StoreState {
    isInitialized: boolean;
    lifecycle?: LifecycleState;
    error?: StoreError | null;
    lastUpdated?: number;
}

/**
 * AI state interface
 */
export interface AIState extends StoreState {
    isConnected: boolean;
    currentModel: string;
    isProcessing: boolean;
    provider: AIProvider;
    availableModels: AIModel[];
    generators?: Record<GeneratorType, GeneratorStatus>;
    lastResponse?: string;
    lastError?: {
        message: string;
        timestamp: number;
        source?: string;
        operationType?: OperationType;
    };
    operationMetrics?: Record<OperationType, OperationMetrics>;
    performanceMetrics: PerformanceMetrics;
    currentOperation?: OperationStatus | null;
    queueLength?: number;
    lastOperation?: OperationStatus;
    stateHistory: StateTransition[];
    knowledgeBloom: {
        isGenerating: boolean;
        selectedModel: string;
        userPrompt: string;
        lastGenerated?: {
            timestamp: number;
            noteCount: number;
        };
    };
}

/**
 * UI state interface
 */
export interface UIState extends StoreState {
    darkMode: boolean;
    activeAccordion: string | null;
    notifications: Notification[];
    lastInteraction: number;
    modalStack: string[];
}

/**
 * Files state interface
 */
export interface FilesState {
    processedFiles: string[];
    lastProcessed?: string;
    stats: {
        totalProcessed: number;
        successCount: number;
        errorCount: number;
        averageProcessingTime: number;
    };
    activeFilters: string[];
    sortOrder: 'asc' | 'desc';
    searchQuery: string;
}

/**
 * Plugin state interface
 */
interface WorkspaceState {
    activeLeaf?: any;
    config?: any;
}

interface AppState {
    workspace?: WorkspaceState;
}

export interface PluginState {
    plugin: Plugin | null;
    app: AppState | null;
    settings: PluginSettings;
    processing: ProcessingState;
    ai: AIState;
    ui: UIState;
    files: FilesState;
}

// ============================================================================
// Default State Values
// ============================================================================

/**
 * Default type-safe plugin state
 * Used for store initialization and reset
 */
export const DEFAULT_PLUGIN_STATE: PluginState = {
    plugin: null,
    app: null,
    settings: DEFAULT_SETTINGS,
    processing: {
        isProcessing: false,
        currentFile: null,
        queue: [] as string[],
        progress: 0,
        state: ProcessingStateEnum.IDLE,
        filesQueued: 0,
        filesProcessed: 0,
        filesRemaining: 0,
        errors: [] as StoreProcessingError[],
        error: null,
        startTime: null,
        estimatedTimeRemaining: null
    },
    ai: {
        isInitialized: false,
        isConnected: false,
        currentModel: '',
        isProcessing: false,
        provider: AIProvider.OpenAI,
        availableModels: [] as AIModel[],
        knowledgeBloom: {
            isGenerating: false,
            selectedModel: '',
            userPrompt: ''
        },
        generators: Object.values(GeneratorType).reduce(
            (acc, type) => ({
                ...acc,
                [type]: {
                    isInitialized: false,
                    lastRun: null,
                    statusMessage: 'Not Initialized'
                }
            }),
            {} as Record<GeneratorType, GeneratorStatus>
        ),
        error: undefined,
        lastResponse: undefined,
        lastError: undefined,
        operationMetrics: Object.values(OperationType).reduce(
            (acc, type) => ({
                ...acc,
                [type]: {
                    totalOperations: 0,
                    successfulOperations: 0,
                    failedOperations: 0,
                    averageDuration: 0,
                    lastOperation: undefined
                }
            }),
            {} as Record<OperationType, OperationMetrics>
        ),
        performanceMetrics: {
            responseTime: {
                average: 0,
                min: Infinity,
                max: 0,
                samples: 0
            },
            successRate: {
                total: 0,
                successful: 0,
                rate: 0
            },
            errorRate: {
                total: 0,
                errors: 0,
                rate: 0
            },
            operationMetrics: Object.values(OperationType).reduce(
                (acc, type) => ({
                    ...acc,
                    [type]: {
                        count: 0,
                        averageTime: 0,
                        errorCount: 0
                    }
                }),
                {} as Record<
                    OperationType,
                    { count: number; averageTime: number; errorCount: number }
                >
            )
        },
        currentOperation: null,
        queueLength: 0,
        lastOperation: undefined,
        stateHistory: [] as StateTransition[], // Make this mutable
        lastUpdated: Date.now() // Add this line
    },
    ui: {
        isInitialized: false,
        error: undefined,
        lastUpdated: Date.now(),
        darkMode: false,
        activeAccordion: null,
        notifications: [] as Notification[],
        lastInteraction: Date.now(),
        modalStack: [] as string[]
    },
    files: {
        processedFiles: [] as string[],
        lastProcessed: undefined,
        stats: {
            totalProcessed: 0,
            successCount: 0,
            errorCount: 0,
            averageProcessingTime: 0
        },
        activeFilters: [] as string[],
        sortOrder: 'asc',
        searchQuery: ''
    }
} as const;

// Type guard to ensure DEFAULT_PLUGIN_STATE matches PluginState interface
type VerifyPluginState = typeof DEFAULT_PLUGIN_STATE extends PluginState
    ? true
    : false;
const _typeCheck: VerifyPluginState = true;

// ============================================================================
// Store Error Types
// ============================================================================

/**
 * Error state interface
 */
export interface ErrorState {
    message: string;
    source?: string;
    timestamp: number;
    stack?: string;
    metadata?: Record<string, unknown>;
}

/**
 * Processing error interface
 */
export interface StoreProcessingError extends BaseError {
    filePath: string;
    error: string;
    retryCount: number;
}

/**
 * Store validation result
 */
export interface StoreValidation<T> {
    isValid: boolean;
    errors?: string[];
    value?: T;
    metadata?: Record<string, unknown>;
}

// ============================================================================
// Specific Store Interfaces
// ============================================================================

/**
 * Plugin store interface
 */
export interface PluginStore extends BaseStore<PluginState> {
    updateSection: <K extends keyof PluginState>(
        section: K,
        update: StoreUpdate<PluginState[K]>
    ) => void;
}

/**
 * Settings store interface
 */
export interface SettingsStore extends BaseStore<PluginSettings> {
    save: (settings: PluginSettings) => Promise<void>;
    updateSetting: <K extends keyof PluginSettings>(
        key: K,
        value: PluginSettings[K]
    ) => void;
    validateSettings: (settings: Partial<PluginSettings>) => boolean;
}

/**
 * AI store interface
 */
export interface AIStore extends BaseStore<AIState> {
    setProvider: (provider: AIProvider) => void;
    updateConnection: (isConnected: boolean) => void;
    setModel: (model: string) => void;
    setInitialized: (isInitialized: boolean) => void;
    setProcessing: (isProcessing: boolean) => void;
    setAvailableModels: (models: AIModel[]) => void;
    setError: (error: string | undefined) => void;
    setLastResponse: (response: string | undefined) => void;
    updateMetrics: (metrics: Partial<PerformanceMetrics>) => void;
    updateOperation: (operation: Partial<OperationStatus> | null) => void;
    reportError: (error: Error, metadata?: Record<string, any>) => void;
    subscribeToEvent: (event: StateEvent, callback: (transition: StateTransition) => void) => () => void;
    getStateHistory: () => StateTransition[];
    clearHistory: () => void;
    resetMetrics: () => void;
    setKnowledgeBloomGenerating: (isGenerating: boolean) => void;
    updateKnowledgeBloomSettings: (settings: Partial<AIState['knowledgeBloom']>) => void;
    recordKnowledgeBloomGeneration: (noteCount: number) => void;
}

/**
 * Processing store interface
 */
export interface ProcessingStore extends BaseStore<ProcessingState> {
    startProcessing: (file: string) => void;
    completeFile: (file: string) => void;
    setError: (error: string | undefined) => void;
    clearError: () => void;
    updateProgress: (progress: number) => void;
    updateQueue: (files: string[]) => void;
}

/**
 * UI store interface
 */
export interface UIStore extends BaseStore<UIState> {
    setDarkMode: (isDark: boolean) => void;
    setActiveAccordion: (accordionId: string | null) => void;
    addNotification: (notification: Notification) => void;
    removeNotification: (id: string) => void;
    pushModal: (modalId: string) => void;
    popModal: () => void;
}

// ============================================================================
// Notification Types
// ============================================================================

/**
 * Notification type
 */
export interface Notification {
    id: string;
    message: string;
    type: 'info' | 'success' | 'error' | 'warning';
    timestamp: number;
    duration?: number;
    dismissible?: boolean;
    actions?: Array<{
        label: string;
        action: () => void;
    }>;
}

/**
 * State transition interface
 */
export interface StateTransition {
    event: StateEvent;
    from: Partial<AIState>;
    to: Partial<AIState>;
    timestamp: number;
    metadata?: Record<string, any>;
}


export interface SettingsStore {
    subscribe: (run: StoreSubscriber<PluginSettings>, invalidate?: () => void) => StoreUnsubscriber;
    set: (value: PluginSettings) => void;
    update: (updater: (value: PluginSettings) => PluginSettings) => void;
    initialize: (persistedSettings: Partial<PluginSettings>) => Promise<void>;
    save: (settings: PluginSettings) => Promise<void>;
    updateSetting: <K extends keyof PluginSettings>(key: K, value: PluginSettings[K]) => void;
    validateSettings: (settings: Partial<PluginSettings>) => boolean;
    reset: () => void;
    getSnapshot: () => PluginSettings;
}

export interface DerivedSettingsStores {
    aiSettings: Readable<PluginSettings['aiProvider']>;
    frontMatterSettings: Readable<PluginSettings['frontMatter']>;
    advancedSettings: Readable<PluginSettings['advanced']>;
    knowledgeBloomSettings: Readable<PluginSettings['knowledgeBloom']>;
    settingsStatus: Readable<{
        isValid: boolean;
        hasApiKey: boolean;
        isConfigured: boolean;
        provider: AIProvider;
    }>;
}
