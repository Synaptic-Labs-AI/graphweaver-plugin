// src/services/ai/AIStateHandler.ts

import { PersistentStateManager } from '../../managers/StateManager';
import { PluginState } from '../../state/PluginState';
import { OperationType } from 'src/types/OperationTypes';
import { Notice } from 'obsidian';

/**
 * State transition events
 */
export enum StateEvent {
    ProviderChanged = 'providerChanged',
    ModelChanged = 'modelChanged',
    OperationStarted = 'operationStarted',
    OperationCompleted = 'operationCompleted',
    OperationFailed = 'operationFailed',
    ErrorOccurred = 'errorOccurred',
    StatusChanged = 'statusChanged',
    Reinitialized = 'reinitialized',
    Destroyed = 'destroyed'
}

/**
 * State transition metadata
 */
interface StateTransition {
    event: StateEvent;
    from: Partial<PluginState['ai']>;
    to: Partial<PluginState['ai']>;
    timestamp: number;
    metadata?: {
        operationType?: OperationType;
        duration?: number;
        [key: string]: any;
    };
}


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
    operationMetrics: Record<OperationType, {
        count: number;
        averageTime: number;
        errorCount: number;
    }>;
}

/**
 * Manages AI state and transitions
 */
export class AIStateHandler {
    public stateHistory: StateTransition[] = [];
    public readonly MAX_HISTORY = 100;
    public metrics: PerformanceMetrics;
    public stateSubscriptions: Map<StateEvent, Set<(transition: StateTransition) => void>>;

    constructor(
        public stateManager: PersistentStateManager
    ) {
        this.initializeMetrics();
        this.stateSubscriptions = new Map();
        this.setupSubscriptions();
    }

    /**
     * Initialize performance metrics
     */
    public initializeMetrics(): void {
        this.metrics = {
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
            operationMetrics: Object.values(OperationType).reduce((acc, type) => ({
                ...acc,
                [type]: {
                    count: 0,
                    averageTime: 0,
                    errorCount: 0
                }
            }), {} as Record<OperationType, { count: number; averageTime: number; errorCount: number }>)
        };
    }

    /**
     * Set up state subscriptions
     */
    public setupSubscriptions(): void {
        // Monitor settings changes
        this.stateManager.subscribe('settings', this.handleSettingsChange.bind(this));

        // Monitor AI state changes
        this.stateManager.subscribe('ai', this.handleAIStateChange.bind(this));

        // Monitor processing state changes
        this.stateManager.subscribe('processing', this.handleProcessingStateChange.bind(this));
    }

    /**
     * Update AI state with transition tracking
     */
    public updateState(
        update: Partial<PluginState['ai']>,
        event: StateEvent,
        metadata?: Record<string, any>
    ): void {
        // Capture previous state
        const previousState = { ...this.stateManager.getSnapshot().ai };

        // Update state
        this.stateManager.update('ai', {
            ...this.stateManager.getSnapshot().ai,
            ...update
        });

        // Capture updated state
        const updatedState = { ...this.stateManager.getSnapshot().ai };

        // Record transition
        const transition: StateTransition = {
            event,
            from: previousState,
            to: updatedState,
            timestamp: Date.now(),
            metadata
        };

        this.recordTransition(transition);
        this.notifySubscribers(transition);
    }

    /**
     * Record state transition
     */
    public recordTransition(transition: StateTransition): void {
        this.stateHistory.unshift(transition);

        // Maintain history limit
        if (this.stateHistory.length > this.MAX_HISTORY) {
            this.stateHistory.pop();
        }

        // Update metrics
        this.updateMetrics(transition);
    }

    /**
     * Update performance metrics
     */
    public updateMetrics(transition: StateTransition): void {
        const { event, metadata } = transition;
    
        // Update operation metrics
        if (metadata?.operationType) {
            const opMetrics = this.metrics.operationMetrics[metadata.operationType];
            if (opMetrics) {
                opMetrics.count++;
    
                if (metadata?.duration) {
                    opMetrics.averageTime =
                        (opMetrics.averageTime * (opMetrics.count - 1) + metadata.duration) /
                        opMetrics.count;
                }
    
                if (event === StateEvent.OperationFailed) {
                    opMetrics.errorCount++;
                }
            }
        }

        // Update response time metrics
        if (metadata?.duration) {
            const { responseTime } = this.metrics;
            responseTime.samples++;
            responseTime.min = Math.min(responseTime.min, metadata.duration);
            responseTime.max = Math.max(responseTime.max, metadata.duration);
            responseTime.average =
                (responseTime.average * (responseTime.samples - 1) + metadata.duration) /
                responseTime.samples;
        }

        // Update success/error rates
        this.metrics.successRate.total++;
        if (event === StateEvent.OperationCompleted) {
            this.metrics.successRate.successful++;
        }

        if (event === StateEvent.ErrorOccurred) {
            this.metrics.errorRate.errors++;
        }
        this.metrics.errorRate.total++;

        // Calculate rates
        this.metrics.successRate.rate =
            this.metrics.successRate.successful / this.metrics.successRate.total;
        this.metrics.errorRate.rate =
            this.metrics.errorRate.errors / this.metrics.errorRate.total;

        // Update state with performance metrics
        this.stateManager.update('ai', {
            ...this.stateManager.getSnapshot().ai,
            performanceMetrics: this.metrics
        });
    }

    /**
     * Handle settings changes
     */
    public handleSettingsChange(settings: PluginState['settings']): void {
        const currentState = this.stateManager.getSnapshot().ai;

        // Check for provider changes
        if (settings.aiProvider !== currentState.provider) {
            this.updateState(
                { provider: settings.aiProvider },
                StateEvent.ProviderChanged,
                { oldProvider: currentState.provider }
            );
        }
    }

    /**
     * Handle AI state changes
     */
    public handleAIStateChange(aiState: PluginState['ai']): void {
        const previousState = this.stateManager.getPreviousState().ai;

        // Check for model changes
        if (aiState.currentModel !== previousState.currentModel) {
            this.updateState(
                { currentModel: aiState.currentModel },
                StateEvent.ModelChanged,
                { oldModel: previousState.currentModel }
            );
        }
    }

    /**
     * Handle processing state changes
     */
    public handleProcessingStateChange(
        processingState: PluginState['processing']
    ): void {
        const event = processingState.isProcessing
            ? StateEvent.OperationStarted
            : StateEvent.OperationCompleted;

        this.updateState(
            { isProcessing: processingState.isProcessing },
            event,
            { operationType: processingState.currentOperation }
        );
    }

    /**
     * Subscribe to state events
     */
    public subscribe(
        event: StateEvent,
        callback: (transition: StateTransition) => void
    ): () => void {
        if (!this.stateSubscriptions.has(event)) {
            this.stateSubscriptions.set(event, new Set());
        }

        this.stateSubscriptions.get(event)?.add(callback);

        // Return unsubscribe function
        return () => {
            this.stateSubscriptions.get(event)?.delete(callback);
        };
    }

    /**
     * Notify subscribers of state transition
     */
    public notifySubscribers(transition: StateTransition): void {
        const subscribers = this.stateSubscriptions.get(transition.event);
        subscribers?.forEach(callback => {
            try {
                callback(transition);
            } catch (error) {
                console.error('Error in state transition subscriber:', error);
            }
        });
    }

    /**
     * Handle errors
     */
    public handleError(error: Error, metadata?: Record<string, any>): void {
        const errorState = {
            error: error.message,
            lastError: {
                message: error.message,
                timestamp: Date.now(),
                ...metadata
            }
        };

        this.updateState(
            errorState,
            StateEvent.ErrorOccurred,
            metadata
        );

        // Notify user
        new Notice(`AI Error: ${error.message}`);
    }

    /**
     * Get state history
     */
    public getStateHistory(): StateTransition[] {
        return [...this.stateHistory];
    }

    /**
     * Get performance metrics
     */
    public getMetrics(): PerformanceMetrics {
        return { ...this.metrics };
    }

    /**
     * Reset metrics
     */
    public resetMetrics(): void {
        this.initializeMetrics();

        this.stateManager.update('ai', {
            ...this.stateManager.getSnapshot().ai,
            performanceMetrics: this.metrics
        });
    }

    /**
     * Clear state history
     */
    public clearHistory(): void {
        this.stateHistory = [];
    }

    /**
     * Destroy handler
     */
    public destroy(): void {
        this.stateSubscriptions.clear();
        this.stateHistory = [];
        this.initializeMetrics();
    }
}
