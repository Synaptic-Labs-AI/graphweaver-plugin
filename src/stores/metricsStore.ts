import { writable } from 'svelte/store';
import { OperationType, OperationMetrics, OperationStatus } from '@type/operations.types';

export function createInitialMetrics(): Record<OperationType, OperationMetrics> {
    return Object.values(OperationType).reduce((acc, type) => ({
        ...acc,
        [type]: {
            totalOperations: 0,
            successfulOperations: 0,
            failedOperations: 0,
            averageDuration: 0
        }
    }), {} as Record<OperationType, OperationMetrics>);
}

export function updateMetrics(
    typeMetrics: OperationMetrics,
    operation: OperationStatus
): OperationMetrics {
    const newTotal = typeMetrics.totalOperations + 1;
    const newSuccesses = typeMetrics.successfulOperations + (operation.success ? 1 : 0);
    const newFailures = typeMetrics.failedOperations + (!operation.success ? 1 : 0);
    const newAverageDuration = ((typeMetrics.averageDuration * typeMetrics.totalOperations) + (operation.duration || 0)) / newTotal;

    return {
        totalOperations: newTotal,
        successfulOperations: newSuccesses,
        failedOperations: newFailures,
        averageDuration: newAverageDuration
    };
}

function createMetricsStore() {
    const { subscribe, set, update } = writable<Record<OperationType, OperationMetrics>>(createInitialMetrics());

    return {
        subscribe,
        trackOperation: (operation: OperationStatus) => update(metrics => {
            const typeMetrics = metrics[operation.type];
            const updatedMetrics = updateMetrics(typeMetrics, operation);
            return {
                ...metrics,
                [operation.type]: updatedMetrics
            };
        }),
        resetMetrics: () => set(createInitialMetrics()),
    };
}

export const metricsStore = createMetricsStore();