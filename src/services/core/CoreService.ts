import { IService } from './IService';
import { LifecycleState } from '@type/base.types';import { ServiceError } from './ServiceError';

/**
 * Abstract base class providing common functionality for services.
 * Implements standard lifecycle management, error handling, and state tracking.
 */
export abstract class CoreService implements IService {
    protected state: LifecycleState = LifecycleState.Uninitialized;
    protected error: ServiceError | null = null;
    protected isUnloading: boolean = false;

    constructor(
        public readonly serviceId: string,
        public readonly serviceName: string
    ) {}

    /**
     * Initialize the service
     * Manages state transitions and error handling
     */
    public async initialize(): Promise<void> {
        if (this.isUnloading) {
            throw new ServiceError(this.serviceName, 'Cannot initialize while unloading');
        }

        try {
            this.state = LifecycleState.Initializing;
            await this.initializeInternal();
            this.state = LifecycleState.Ready;
            this.error = null;
        } catch (error) {
            this.handleError('Initialization failed', error);
            this.state = LifecycleState.Error;
            throw error;
        }
    }

    /**
     * Internal initialization method to be implemented by derived classes
     * @throws ServiceError if initialization fails
     */
    protected abstract initializeInternal(): Promise<void>;

    /**
     * Check if service is ready for use
     */
    public isReady(): boolean {
        return this.state === LifecycleState.Ready && !this.isUnloading;
    }

    /**
     * Clean up service resources
     */
    public async destroy(): Promise<void> {
        if (this.isUnloading) return;

        try {
            this.isUnloading = true;
            this.state = LifecycleState.Destroying;
            await this.destroyInternal();
            this.state = LifecycleState.Destroyed;
        } catch (error) {
            this.handleError('Destroy failed', error);
            throw error;
        }
    }

    /**
     * Internal cleanup method to be implemented by derived classes
     */
    protected abstract destroyInternal(): Promise<void>;

    /**
     * Get current service state
     */
    public getState(): { state: LifecycleState; error: ServiceError | null } {
        return { state: this.state, error: this.error };
    }

    /**
     * Standard error handling
     */
    protected handleError(message: string, error: unknown): void {
        const serviceError = ServiceError.from(this.serviceName, error, {
            state: this.state,
            isUnloading: this.isUnloading
        });
        
        console.error(`${this.serviceName} error:`, serviceError.getDetails());
        this.error = serviceError;
    }
}