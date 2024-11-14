// src/services/ai/QueueManagerService.ts

import { CoreService } from '../core/CoreService';
import { OperationType, OperationStatus, QueuedOperation } from 'src/types/OperationTypes';
import { ServiceState } from '../../state/ServiceState';

export class QueueManagerService extends CoreService {
    private operationQueue: QueuedOperation[] = [];
    private isProcessing: boolean = false;
    private queueProcessorInterval?: NodeJS.Timeout;
    
    public readonly MAX_QUEUE_SIZE = 100;
    public readonly QUEUE_PROCESS_INTERVAL = 100;

    constructor(
        private readonly processOperation: (operation: QueuedOperation) => Promise<void>
    ) {
        super('queue-manager', 'Queue Manager Service');
    }

    protected async initializeInternal(): Promise<void> {
        this.startQueueProcessor();
    }

    protected async destroyInternal(): Promise<void> {
        if (this.queueProcessorInterval) {
            clearInterval(this.queueProcessorInterval);
            this.queueProcessorInterval = undefined;
        }
    }

    /**
     * Add operation to queue
     */
    public enqueueOperation(operation: QueuedOperation): void {
        if (this.operationQueue.length >= this.MAX_QUEUE_SIZE) {
            throw new Error('Operation queue is full');
        }

        this.operationQueue.push(operation);
        this.sortQueue();
    }

    /**
     * Sort queue by priority
     */
    private sortQueue(): void {
        this.operationQueue.sort((a, b) => b.priority - a.priority);
    }

    /**
     * Get priority for operation type
     */
    public getOperationPriority(type: OperationType): number {
        const priorities: Record<OperationType, number> = {
            [OperationType.Generation]: 1,
            [OperationType.FrontMatter]: 2,
            [OperationType.Wikilink]: 2,
            [OperationType.Ontology]: 3,
            [OperationType.KnowledgeBloom]: 4
        };
        return priorities[type] || 1;
    }

    /**
     * Start queue processor
     */
    private startQueueProcessor(): void {
        // Clear any existing interval
        if (this.queueProcessorInterval) {
            clearInterval(this.queueProcessorInterval);
        }

        this.queueProcessorInterval = setInterval(
            () => this.processQueue(),
            this.QUEUE_PROCESS_INTERVAL
        );
    }

    /**
     * Process queued operations
     */
    private async processQueue(): Promise<void> {
        if (this.isProcessing || this.operationQueue.length === 0) {
            return;
        }

        this.isProcessing = true;

        try {
            const operation = this.operationQueue[0];
            await this.processOperation(operation);
            // Remove processed operation
            this.operationQueue = this.operationQueue.filter(op => op.id !== operation.id);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Get operation by ID
     */
    public getOperation(operationId: string): QueuedOperation | undefined {
        return this.operationQueue.find(op => op.id === operationId);
    }

    /**
     * Get queue length
     */
    public getQueueLength(): number {
        return this.operationQueue.length;
    }

    /**
     * Check if queue is processing
     */
    public isQueueProcessing(): boolean {
        return this.isProcessing;
    }

    /**
     * Clear the queue
     */
    public clearQueue(): void {
        this.operationQueue = [];
    }
}