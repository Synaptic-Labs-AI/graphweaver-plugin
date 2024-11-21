import { derived, writable, get } from 'svelte/store';
import type { OperationStatus, OperationMetrics, OperationType } from '@type/operations.types';
import { TypedEventEmitter } from '@type/events.types';
import type { OperationEvents } from '@type/events.types';
import { createInitialMetrics, updateMetrics } from '@stores/metricsStore';

interface OperationState {
    currentOperation: OperationStatus | null;
    operations: OperationStatus[];
    progress: number;
    queueLength: number;
    metrics: Record<OperationType, OperationMetrics>;
}

function createOperationStore() {
    const eventEmitter = new TypedEventEmitter<OperationEvents>();
    const store = writable<OperationState>({
        currentOperation: null,
        operations: [],
        progress: 0,
        queueLength: 0,
        metrics: createInitialMetrics()
    });

    return {
        subscribe: store.subscribe,
        eventEmitter,
        startOperation: (operation: OperationStatus) => store.update(state => ({
            ...state,
            currentOperation: operation,
            operations: [operation, ...state.operations]
        })),
        completeOperation: (operation: OperationStatus) => store.update(state => ({
            ...state,
            currentOperation: null,
            operations: state.operations.map(op => 
                op.id === operation.id ? operation : op
            )
        })),
        updateProgress: (progress: number) => store.update(state => ({
            ...state,
            progress
        })),
        updateQueue: (length: number) => store.update(state => ({
            ...state,
            queueLength: length
        })),
        trackMetrics: (operation: OperationStatus) => store.update(state => ({
            ...state,
            metrics: {
                ...state.metrics,
                [operation.type]: updateMetrics(state.metrics[operation.type], operation)
            }
        })),
        errorOperation: (status: OperationStatus) => {
            eventEmitter.emit('operationError', status);
            // ...existing code...
        },
        getCurrentOperation: () => {
            return get(store).currentOperation;
        }
    };
}

export const operationStore = createOperationStore();

export const currentOperation = derived(
    operationStore,
    ($store) => $store.currentOperation
);

export const operationProgress = derived(
    operationStore,
    ($store) => $store.progress
);