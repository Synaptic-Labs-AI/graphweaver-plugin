// src/stores/AIStore.ts
import { derived, get } from 'svelte/store';
import { Notice } from 'obsidian';
import type { AIState, AIStore, StateTransition, PerformanceMetrics } from '../types/store.types';
import { createEnhancedStore } from './StoreUtils';
import { AIProvider, type AIModel } from '@type/ai.types';
import { OperationType, type OperationStatus } from '@type/operations.types';
import { utils as coreUtils } from './CoreStore';

// Define state events
export enum StateEvent {
    ProviderChanged = 'providerChanged',
    ModelChanged = 'modelChanged',
    ConnectionChanged = 'connectionChanged',
    InitializationChanged = 'initializationChanged',
    ProcessingChanged = 'processingChanged',
    ModelsUpdated = 'modelsUpdated',
    OperationStarted = 'operationStarted',
    OperationCompleted = 'operationCompleted',
    OperationFailed = 'operationFailed',
    ErrorOccurred = 'errorOccurred',
    StatusChanged = 'statusChanged'
}

// Create initial operation metrics
const createInitialOperationMetrics = () => {
    return Object.values(OperationType).reduce((acc, type) => ({
        ...acc,
        [type]: {
            count: 0,
            averageTime: 0,
            errorCount: 0
        }
    }), {} as Record<OperationType, { count: number; averageTime: number; errorCount: number }>);
};

export interface AIState {
    // ...existing properties...
    error?: ServiceError | StoreError;
    // ...existing properties...
}

export function createAIStore(initialState: AIState = {
    isInitialized: false,
    isConnected: false,
    currentModel: '',
    isProcessing: false,
    provider: AIProvider.OpenAI,
    availableModels: [],
    performanceMetrics: {
        responseTime: { average: 0, min: Infinity, max: 0, samples: 0 },
        successRate: { total: 0, successful: 0, rate: 0 },
        errorRate: { total: 0, errors: 0, rate: 0 },
        operationMetrics: createInitialOperationMetrics()
    },
    stateHistory: []
}): AIStore {
    const store = createEnhancedStore<AIState>(initialState);
    const eventSubscribers = new Map<StateEvent, Set<(transition: StateTransition) => void>>();

    function recordTransition(event: StateEvent, update: Partial<AIState>, metadata?: Record<string, any>) {
        const previousState = get(store);
        store.update(state => ({ ...state, ...update }));
        const newState = get(store);

        const transition: StateTransition = {
            event,
            from: previousState,
            to: newState,
            timestamp: Date.now(),
            metadata
        };

        store.update(state => ({
            ...state,
            stateHistory: [transition, ...state.stateHistory].slice(0, 100)
        }));

        eventSubscribers.get(event)?.forEach(callback => {
            try {
                callback(transition);
            } catch (error) {
                console.error('Error in state transition subscriber:', error);
                coreUtils.reportError('AI Store event subscriber error', 'error', { error });
            }
        });

        return transition;
    }

    return {
        ...store,
        setProvider: (provider: AIProvider) => {
            recordTransition(StateEvent.ProviderChanged, { provider });
        },
        updateConnection: (isConnected: boolean) => {
            recordTransition(StateEvent.ConnectionChanged, { isConnected });
        },
        setModel: (model: string) => {
            recordTransition(StateEvent.ModelChanged, { currentModel: model });
        },
        setInitialized: (isInitialized: boolean) => {
            recordTransition(StateEvent.InitializationChanged, { isInitialized });
        },
        setProcessing: (isProcessing: boolean) => {
            recordTransition(StateEvent.ProcessingChanged, { isProcessing });
        },
        setAvailableModels: (models: AIModel[]) => {
            recordTransition(StateEvent.ModelsUpdated, { availableModels: models });
        },
        setError: (error: string | undefined) => {
            recordTransition(StateEvent.ErrorOccurred, { error });
        },
        setLastResponse: (response: string | undefined) => {
            store.update(state => ({ ...state, lastResponse: response }));
        },
        updateMetrics: (metrics: Partial<PerformanceMetrics>) => {
            store.update(state => ({
                ...state,
                performanceMetrics: {
                    ...state.performanceMetrics,
                    ...metrics
                }
            }));
        },
        updateOperation: (operation: Partial<OperationStatus> | null) => {
            recordTransition(
                operation ? StateEvent.OperationStarted : StateEvent.OperationCompleted,
                { currentOperation: operation && 'type' in operation ? operation as OperationStatus : null }
            );
        },
        reportError: (error: Error, metadata?: Record<string, any>) => {
            recordTransition(StateEvent.ErrorOccurred, {
                error: error.message,
                lastError: {
                    message: error.message,
                    timestamp: Date.now()
                }
            }, metadata);
            coreUtils.reportError(`AI Error: ${error.message}`, 'error', metadata);
            new Notice(`AI Error: ${error.message}`);
        },
        subscribeToEvent: (event: StateEvent, callback: (transition: StateTransition) => void) => {
            if (!eventSubscribers.has(event)) {
                eventSubscribers.set(event, new Set());
            }
            eventSubscribers.get(event)?.add(callback);
            return () => {
                eventSubscribers.get(event)?.delete(callback);
            };
        },
        getStateHistory: () => get(store).stateHistory,
        clearHistory: () => {
            store.update(state => ({ ...state, stateHistory: [] }));
        },
        resetMetrics: () => {
            store.update(state => ({
                ...state,
                performanceMetrics: initialState.performanceMetrics
            }));
        }
    };
}

export const aiStore = createAIStore();

export const aiStatus = derived(aiStore, ($store) => ({
    isInitialized: $store.isInitialized,
    isConnected: $store.isConnected,
    currentModel: $store.currentModel,
    isProcessing: $store.isProcessing,
    provider: $store.provider,
    availableModels: $store.availableModels,
    hasError: !!$store.error
}));