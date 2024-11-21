// src/services/ai/OperationExecutor.ts

import { operationStore } from '@stores/operationStore';
import type { OperationStatus, OperationType } from '@type/operations.types';
import { OperationConfig } from '../../types/operations.types';

/**
 * Handles operation execution lifecycle and tracking
 */
export class OperationExecutor {
    constructor(private store: typeof operationStore) {}

    /**
     * Execute operation with tracking
     */
    public async execute<T>(
        type: OperationType,
        operation: () => Promise<T>,
        metadata?: Record<string, any>,
        config?: OperationConfig
    ): Promise<T> {
        const operationId = this.generateOperationId();
        const status: OperationStatus = {
            id: operationId,
            type,
            startTime: Date.now(),
            metadata
        };

        try {
            this.store.startOperation(status);
            const result = await operation();
            this.store.completeOperation({
                ...status,
                endTime: Date.now(),
                success: true
            });
            return result;
        } catch (error: any) {
            const endTime = Date.now();
            status.endTime = endTime;
            status.duration = endTime - status.startTime;
            status.success = false;
            status.error = error instanceof Error ? error.message : 'Unknown error';

            this.store.errorOperation(status);

            throw error;
        }
    }

    /**
     * Generate unique operation ID
     */
    private generateOperationId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get current operation
     */
    public getCurrentOperation(): OperationStatus | null {
        return this.store.getCurrentOperation();
    }
}