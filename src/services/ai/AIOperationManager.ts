// src/services/ai/AIOperationManager.ts

import { AIResponse } from '../../models/AIModels';
import { PersistentStateManager } from '../../managers/StateManager';
import { AdapterRegistry } from './AdapterRegistry';
import { GeneratorFactory, GeneratorType } from './GeneratorFactory';
import { FrontMatterGenerator } from 'src/generators/FrontMatterGenerator';
import { IService } from '../core/IService';
import { ServiceState } from '../../state/ServiceState';
import { ServiceError } from '../core/ServiceError';
import { QueueManagerService } from './QueueManagerService';
import { MetricsTracker } from './MetricsTracker';
import { OperationEventEmitter } from './OperationEventEmitter';
import { OperationExecutor } from './OperationExecutor';
import { OperationType, OperationConfig, QueuedOperation } from 'src/types/OperationTypes';

/**
 * Manages AI operations using specialized services for execution and tracking
 */
export class AIOperationManager implements IService {
    // IService implementation
    public readonly serviceId: string = 'ai-operation-manager';
    public readonly serviceName: string = 'AI Operation Manager';
    private serviceState: ServiceState = ServiceState.Uninitialized;
    private serviceError: ServiceError | null = null;

    // Service components
    private readonly eventEmitter: OperationEventEmitter;
    private readonly metricsTracker: MetricsTracker;
    private readonly queueManager: QueueManagerService;
    private readonly operationExecutor: OperationExecutor;

    constructor(
        private readonly stateManager: PersistentStateManager,
        private readonly adapterRegistry: AdapterRegistry,
        private readonly generatorFactory: GeneratorFactory
    ) {
        this.eventEmitter = new OperationEventEmitter();
        this.metricsTracker = new MetricsTracker();
        this.queueManager = new QueueManagerService(this.processOperation.bind(this));
        this.operationExecutor = new OperationExecutor(
            this.metricsTracker,
            this.eventEmitter,
            this.queueManager
        );
    }

    /**
     * Initialize service and components
     */
    public async initialize(): Promise<void> {
        try {
            this.serviceState = ServiceState.Initializing;

            await this.metricsTracker.initialize();
            await this.queueManager.initialize();
            
            this.setupEventListeners();
            this.serviceState = ServiceState.Ready;
        } catch (error) {
            this.serviceState = ServiceState.Error;
            this.serviceError = ServiceError.from(this.serviceName, error);
            throw this.serviceError;
        }
    }

    /**
     * Process a single operation
     */
    private async processOperation(operation: QueuedOperation): Promise<void> {
        await operation.execute();
    }

    /**
     * Set up event listeners
     */
    private setupEventListeners(): void {
        this.eventEmitter.on('operationComplete', (status) => {
            this.metricsTracker.trackOperation(status);
            this.updateState();
        });

        this.eventEmitter.on('operationError', (error, status) => {
            console.error(`Operation error (${status.type}):`, error);
            this.updateState();
        });
    }

    /**
     * Check if service is ready
     */
    public isReady(): boolean {
        return this.serviceState === ServiceState.Ready;
    }

    /**
     * Get service state
     */
    public getState(): { state: ServiceState; error: ServiceError | null } {
        return {
            state: this.serviceState,
            error: this.serviceError
        };
    }

     /**
     * Get the OperationExecutor instance
     */
     public getOperationExecutor(): OperationExecutor {
        return this.operationExecutor;
    }

    /**
     * Clean up resources
     */
    public async destroy(): Promise<void> {
        try {
            this.serviceState = ServiceState.Destroying;

            await this.queueManager.destroy();
            await this.metricsTracker.destroy();
            this.eventEmitter.removeAllListeners();

            this.serviceState = ServiceState.Destroyed;
        } catch (error) {
            this.serviceError = ServiceError.from(this.serviceName, error);
            throw this.serviceError;
        }
    }

    /**
     * Generate AI response
     */
    public async generateResponse(prompt: string, config?: OperationConfig): Promise<AIResponse> {
        if (!this.isReady()) {
            throw new Error('AIOperationManager not ready');
        }

        return this.operationExecutor.execute<AIResponse>(
            OperationType.Generation,
            async () => {
                const adapter = this.adapterRegistry.getCurrentAdapter();
                const model = this.stateManager.getSnapshot().ai.currentModel;
                return adapter.generateResponse(prompt, model);
            },
            { prompt },
            config
        );
    }

    /**
     * Generate front matter
     */
    public async generateFrontMatter(content: string, config?: OperationConfig): Promise<string> {
        if (!this.isReady()) {
            throw new Error('AIOperationManager not ready');
        }

        return this.operationExecutor.execute<string>(
            OperationType.FrontMatter,
            async () => {
                const generator = await this.generatorFactory.getGenerator(GeneratorType.FrontMatter) as FrontMatterGenerator;
                const result = await generator.generate({ content });
                return result.content;
            },
            { contentLength: content.length },
            config
        );
    }

    /**
     * Update global state
     */
    private updateState(): void {
        const currentState = this.stateManager.getSnapshot().ai;
        this.stateManager.update('ai', {
            ...currentState,
            currentOperation: this.operationExecutor.getCurrentOperation(),
            queueLength: this.queueManager.getQueueLength(),
            operationMetrics: this.metricsTracker.getAllMetrics(),
            error: this.serviceError?.message || currentState.error
        });
    }

    // Public access methods for metrics and history
    public getMetrics = () => this.metricsTracker.getAllMetrics();
    public getHistory = () => this.metricsTracker.getHistory();
    public clearHistory = () => this.metricsTracker.clearHistory();
    public resetMetrics = () => this.metricsTracker.resetMetrics();
}