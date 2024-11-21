/**
 * Operation Types Module
 * @module types/operations
 * @description Core operation type definitions
 */

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
 * Operation status tracking
 */
export interface OperationStatus {
    id: string;
    type: OperationType;
    startTime: number;
    endTime?: number;
    duration?: number;
    success?: boolean;
    error?: string;
    metadata?: Record<string, unknown>;
}

/**
 * Operation performance metrics
 */
export interface OperationMetrics {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    averageDuration: number;
}

/**
 * Operation queue item
 */
export interface QueuedOperation {
    id: string;
    type: OperationType;
    priority: number;
    startTime: number;
    execute: () => Promise<unknown>;
    metadata?: Record<string, unknown>;
}

/**
 * Operation result interface
 */
export interface OperationResult<T> {
    success: boolean;
    data?: T;
    error?: string;
    duration: number;
    metadata?: Record<string, unknown>;
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