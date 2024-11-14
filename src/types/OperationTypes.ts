// src//types/OperationTypes.ts

/**
 * Operation types supported by the manager
 */
export enum OperationType {
    Generation = 'generation',
    FrontMatter = 'frontMatter',
    Wikilink = 'wikilink',
    Ontology = 'ontology',
    KnowledgeBloom = 'knowledgeBloom'
}

/**
 * Operation status tracking
 */
export interface OperationStatus {
    type: OperationType;
    startTime: number;
    endTime?: number;
    duration?: number;
    success?: boolean;
    error?: string;
    metadata?: Record<string, any>;
}

/**
 * Operation performance metrics
 */
export interface OperationMetrics {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    averageDuration: number;
    lastOperation?: OperationStatus;
}

/**
 * Operation queue item
 */
export interface QueuedOperation {
    id: string;
    type: OperationType;
    priority: number;
    startTime: number;
    execute: () => Promise<any>;
    metadata?: Record<string, any>;
}

/**
 * Operation result interface
 */
export interface OperationResult<T> {
    success: boolean;
    data?: T;
    error?: string;
    duration: number;
    metadata?: Record<string, any>;
}

/**
 * Operation configuration interface
 */
export interface OperationConfig {
    maxRetries?: number;
    retryDelay?: number;
    timeout?: number;
    priority?: number;
}

/**
 * Operation state enum
 */
export enum OperationState {
    Queued = 'queued',
    Running = 'running',
    Completed = 'completed',
    Failed = 'failed',
    Cancelled = 'cancelled'
}

/**
 * Operation error interface
 */
export interface OperationError {
    message: string;
    code?: string;
    retryable?: boolean;
    metadata?: Record<string, any>;
}

/**
 * Operation progress interface
 */
export interface OperationProgress {
    operationId: string;
    progress: number;
    message?: string;
    metadata?: Record<string, any>;
}

/**
 * Operation batch interface
 */
export interface OperationBatch {
    batchId: string;
    operations: QueuedOperation[];
    priority: number;
    metadata?: Record<string, any>;
}

/**
 * Operation retry policy
 */
export interface RetryPolicy {
    maxRetries: number;
    retryDelay: number;
    backoffFactor?: number;
    maxDelay?: number;
}