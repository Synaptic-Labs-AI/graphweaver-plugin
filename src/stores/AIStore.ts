// src/stores/AIStore.ts
import { derived, get } from 'svelte/store';
import { Notice } from 'obsidian';
import type { AIState, AIStore, StateTransition, PerformanceMetrics } from '../types/store.types';
import { createEnhancedStore } from './StoreUtils';
import { AIProvider, type AIModel } from '@type/ai.types';
import { OperationType, type OperationStatus } from '@type/operations.types';
import { utils as coreUtils } from './CoreStore';
import { AIModelUtils } from '@type/aiModels';

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
    StatusChanged = 'statusChanged',
    KnowledgeBloomStarted = 'knowledgeBloomStarted',
    KnowledgeBloomCompleted = 'knowledgeBloomCompleted',
    KnowledgeBloomFailed = 'knowledgeBloomFailed'
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

const defaultInitialState: AIState = {
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
    stateHistory: [],
    lastUpdated: Date.now(),
    knowledgeBloom: {
        isGenerating: false,
        selectedModel: '',
        userPrompt: ''
    }
};

export function createAIStore(initialState: AIState = defaultInitialState): AIStore {
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
            const models = AIModelUtils.getModelsForProvider(provider);
            if (!models.length) {
                throw new Error(`No models available for provider: ${provider}`);
            }
            recordTransition(StateEvent.ProviderChanged, { 
                provider,
                availableModels: models,
                currentModel: models[0].apiName
            });
        },
        updateConnection: (isConnected: boolean) => {
            recordTransition(StateEvent.ConnectionChanged, { isConnected });
        },
        setModel: (model: string) => {
            const modelInfo = AIModelUtils.getModelByApiName(model);
            if (!modelInfo) {
                throw new Error(`Invalid model: ${model}`);
            }
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
            recordTransition(StateEvent.ErrorOccurred, { 
                error: error ? { message: error, timestamp: Date.now() } : undefined 
            });
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
                error: {
                    message: error.message,
                    timestamp: Date.now()
                },
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
        },
        setKnowledgeBloomGenerating: (isGenerating: boolean) => {
            recordTransition(
                isGenerating ? StateEvent.KnowledgeBloomStarted : StateEvent.KnowledgeBloomCompleted,
                { knowledgeBloom: { ...get(store).knowledgeBloom, isGenerating } }
            );
        },

        updateKnowledgeBloomSettings: (settings: Partial<AIState['knowledgeBloom']>) => {
            store.update(state => ({
                ...state,
                knowledgeBloom: {
                    ...state.knowledgeBloom,
                    ...settings
                }
            }));
        },

        recordKnowledgeBloomGeneration: (noteCount: number) => {
            store.update(state => ({
                ...state,
                knowledgeBloom: {
                    ...state.knowledgeBloom,
                    lastGenerated: {
                        timestamp: Date.now(),
                        noteCount
                    }
                }
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

// Add Knowledge Bloom specific derived store
export const knowledgeBloomStatus = derived(aiStore, ($store) => ({
    isGenerating: $store.knowledgeBloom.isGenerating,
    selectedModel: $store.knowledgeBloom.selectedModel,
    userPrompt: $store.knowledgeBloom.userPrompt,
    lastGenerated: $store.knowledgeBloom.lastGenerated
}));