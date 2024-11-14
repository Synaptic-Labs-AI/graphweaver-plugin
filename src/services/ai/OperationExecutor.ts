// src/services/ai/OperationExecutor.ts

import { OperationType, OperationStatus, QueuedOperation, OperationResult, OperationConfig } from 'src/types/OperationTypes';
import { OperationEventEmitter } from './OperationEventEmitter';
import { MetricsTracker } from './MetricsTracker';
import { QueueManagerService } from './QueueManagerService';

/**
 * Handles operation execution lifecycle and tracking
 */
export class OperationExecutor {
    private currentOperation: OperationStatus | null = null;

    constructor(
        private readonly metricsTracker: MetricsTracker,
        private readonly eventEmitter: OperationEventEmitter,
        private readonly queueManager: QueueManagerService
    ) {}

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
        const queuedOperation: QueuedOperation = {
            id: operationId,
            type,
            priority: config?.priority ?? this.queueManager.getOperationPriority(type),
            startTime: Date.now(),
            execute: async () => {
                const result = await this.executeWithTracking<T>(type, operation, metadata);
                return result.data as T;
            },
            metadata
        };

        // Add to queue
        this.queueManager.enqueueOperation(queuedOperation);
        
        // Wait for completion
        return this.waitForOperation<T>(operationId);
    }

    /**
     * Execute operation with tracking
     */
    private async executeWithTracking<T>(
        type: OperationType,
        operation: () => Promise<T>,
        metadata?: Record<string, any>
    ): Promise<OperationResult<T>> {
        const startTime = Date.now();
        const status: OperationStatus = {
            type,
            startTime,
            metadata
        };

        try {
            // Start operation
            this.currentOperation = status;
            this.eventEmitter.emitOperationStart(status);

            // Execute operation
            const result = await operation();

            // Complete operation
            const endTime = Date.now();
            status.endTime = endTime;
            status.duration = endTime - startTime;
            status.success = true;

            this.eventEmitter.emitOperationComplete(status);

            return {
                success: true,
                data: result,
                duration: status.duration,
                metadata
            };
        } catch (error) {
            const endTime = Date.now();
            status.endTime = endTime;
            status.duration = endTime - startTime;
            status.success = false;
            status.error = error instanceof Error ? error.message : 'Unknown error';

            this.eventEmitter.emitOperationError(
                error instanceof Error ? error : new Error(String(error)),
                status
            );

            return {
                success: false,
                error: status.error,
                duration: status.duration,
                metadata
            };
        } finally {
            this.currentOperation = null;
        }
    }

    /**
     * Wait for operation completion with type-safe metrics
     */
    private async waitForOperation<T>(operationId: string): Promise<T> {
        return new Promise((resolve, reject) => {
            const checkInterval = setInterval(() => {
                const operation = this.queueManager.getOperation(operationId);
                if (!operation) {
                    clearInterval(checkInterval);
                    const metrics = this.metricsTracker.getAllMetrics();
                    
                    const defaultOperation = metrics[OperationType.Generation]?.lastOperation;
                    const operationResult = defaultOperation?.metadata?.result;

                    if (defaultOperation?.success && operationResult !== undefined) {
                        resolve(operationResult as T);
                    } else {
                        reject(new Error(defaultOperation?.error || 'Operation failed'));
                    }
                }
            }, 50);
        });
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
        return this.currentOperation;
    }
}