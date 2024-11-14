// src/services/core/IService.ts

import { ServiceState } from "src/state/ServiceState";
import { ServiceError } from './ServiceError';

/**
 * Interface defining the contract that all services must follow.
 * Provides standard lifecycle and state management methods.
 */
export interface IService {
    /**
     * Unique identifier for the service
     */
    readonly serviceId: string;

    /**
     * Human-readable name of the service
     */
    readonly serviceName: string;

    /**
     * Initialize the service and its dependencies
     * Should be called before the service is used
     * @throws ServiceError if initialization fails
     */
    initialize(): Promise<void>;

    /**
     * Check if the service is ready for use
     * @returns boolean indicating if service is fully initialized
     */
    isReady(): boolean;

    /**
     * Clean up service resources
     * Should be called when the service is no longer needed
     */
    destroy(): Promise<void>;

    /**
     * Get current service state
     * @returns Current ServiceState and error if present
     */
    getState(): { state: ServiceState; error: ServiceError | null };
}

/**
 * Optional interface for services that need configuration
 */
export interface IConfigurableService<T> extends IService {
    /**
     * Configure the service
     * @param config Configuration object
     */
    configure(config: T): Promise<void>;
}

/**
 * Optional interface for services that support reinitialization
 */
export interface IReinitializableService extends IService {
    /**
     * Reinitialize the service
     * Should clean up and re-initialize the service
     */
    reinitialize(): Promise<void>;
}