import { AIResponse } from '@type/ai.types';
import { AdapterRegistry } from './AdapterRegistry';
import { GeneratorFactory, GeneratorType } from './GeneratorFactory';
import { FrontMatterGenerator } from '@generators/FrontMatterGenerator';
import { IService } from '@services/core/IService';
import { LifecycleState } from '@type/base.types';
import { ServiceError } from '@services/core/ServiceError';
import { QueueManagerService } from './QueueManagerService';
import { OperationExecutor } from './OperationExecutor';
import { OperationType, OperationConfig, QueuedOperation } from '@type/operations.types';
import { aiStore } from '@stores/AIStore';
import { get } from 'svelte/store';
import type { Unsubscriber } from 'svelte/store';
import { operationStore } from '@stores/operationStore';
import { TypedEventEmitter } from '@type/events.types';
import type { OperationEvents } from '@type/events.types';
import { metricsStore } from '@stores/metricsStore';
import type { OperationStatus } from '@type/operations.types';
import type { StoreError } from '@type/store.types';

/**
 * Manages AI operations using specialized services for execution and tracking
 */
export class AIOperationManager implements IService {
    // IService implementation
    public readonly serviceId: string = 'ai-operation-manager';
    public readonly serviceName: string = 'AI Operation Manager';
    private LifecycleState: LifecycleState = LifecycleState.Uninitialized;
    private serviceError: ServiceError | null = null;

    // Service components
    private readonly eventEmitter: TypedEventEmitter<OperationEvents>;
    private readonly queueManager: QueueManagerService;
    private readonly operationExecutor: OperationExecutor;
    private unsubscribers: Unsubscriber[] = [];

    constructor(
        private readonly adapterRegistry: AdapterRegistry,
        private readonly generatorFactory: GeneratorFactory
    ) {
        this.eventEmitter = operationStore.eventEmitter;
        this.queueManager = new QueueManagerService(this.processOperation.bind(this));
        this.operationExecutor = new OperationExecutor(operationStore);
    }

    /**
     * Initialize service and components
     */
    public async initialize(): Promise<void> {
        try {
            this.LifecycleState = LifecycleState.Initializing;

            this.setupEventListeners();
            this.LifecycleState = LifecycleState.Ready;
        } catch (error) {
            this.LifecycleState = LifecycleState.Error;
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
        // Operation complete listener
        this.eventEmitter.on('operationComplete', (status: OperationStatus) => {
            metricsStore.trackOperation(status);
            this.updateAIStore();
        });

        // Operation error listener
        this.eventEmitter.on('operationError', (status: OperationStatus) => {
            console.error(`Operation error (${status.type}):`, status.error);
            this.updateAIStore();
        });

        // Track store unsubscribers if needed later
        const aiStoreUnsub = aiStore.subscribe(() => {
            // Additional store-specific handling if needed
        });

        this.unsubscribers.push(aiStoreUnsub);
    }

    /**
     * Check if service is ready
     */
    public isReady(): boolean {
        return this.LifecycleState === LifecycleState.Ready;
    }

    /**
     * Get service state
     */
    public getState(): { state: LifecycleState; error: ServiceError | null } {
        return {
            state: this.LifecycleState,
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
            this.LifecycleState = LifecycleState.Destroying;

            // Clean up subscriptions
            this.unsubscribers.forEach(unsub => unsub());
            this.unsubscribers = [];

            // Clean up services
            await this.queueManager.destroy();
            this.eventEmitter.removeAllListeners();

            this.LifecycleState = LifecycleState.Destroyed;
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
                const aiState = get(aiStore);
                return adapter.generateResponse(prompt, aiState.currentModel);
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
     * Update AI store state
     */
    private updateAIStore(): void {
        aiStore.update(state => ({
            ...state,
            currentOperation: this.operationExecutor.getCurrentOperation(),
            queueLength: this.queueManager.getQueueLength(),
            operationMetrics: get(metricsStore),
            error: this.serviceError
                ? { message: this.serviceError.message, timestamp: Date.now() }
                : state.error
        }));
    }

    // Public access methods for metrics and history
    // Removed metricsTracker method calls
}