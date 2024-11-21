/**
 * Service Types Module
 * @module types/services
 * @description Type definitions for service management and registration
 */

import type { IService } from '@services/core/IService';
import type { ServiceError } from '@services/core/ServiceError';
import { LifecycleState, BaseStatus } from './base.types';

/**
 * Service registration status
 */
export enum RegistrationStatus {
    NotRegistered = 'NOT_REGISTERED',
    Registered = 'REGISTERED',
    Initialized = 'INITIALIZED',
    Failed = 'FAILED'
}

/**
 * Base service configuration
 */
export interface BaseServiceConfig<T extends IService> {
    /** Unique service identifier */
    id: string;
    /** Human-readable service name */
    name?: string;
    /** Array of service dependency IDs */
    dependencies?: string[];
    /** Optional service metadata */
    metadata?: Record<string, unknown>;
}

/**
 * Factory-based service configuration
 */
export interface FactoryServiceConfig<T extends IService> extends BaseServiceConfig<T> {
    /** Configuration type discriminator */
    type: 'factory';
    /** Factory function to create service instance */
    factory: () => Promise<T> | T;
}

/**
 * Constructor-based service configuration
 */
export interface ConstructorServiceConfig<T extends IService> extends BaseServiceConfig<T> {
    /** Configuration type discriminator */
    type: 'constructor';
    /** Service class constructor */
    constructor: new (...args: unknown[]) => T;
}

/**
 * Combined service configuration type
 */
export type ServiceRegistrationConfig<T extends IService> =
    | FactoryServiceConfig<T>
    | ConstructorServiceConfig<T>;

/**
 * Service initialization status
 */
export interface InitializationStatus {
    /** Total number of registered services */
    totalServices: number;
    /** Number of successfully initialized services */
    initializedServices: number;
    /** IDs of services pending initialization */
    pendingServices: string[];
    /** Services that failed initialization */
    failedServices: Array<{
        id: string;
        error: ServiceError;
    }>;
    /** Initialization timestamp */
    timestamp: number;
}

/**
 * Service registration error
 */
export interface RegistrationError {
    /** Service ID */
    id: string;
    /** Error details */
    error: ServiceError;
    /** Error timestamp */
    timestamp: number;
    /** Whether the error is recoverable */
    recoverable: boolean;
}

/**
 * Service registration information
 */
export interface ServiceRegistration<T extends IService = IService> {
    id: string;
    name: string;
    instance: T | null;
    factory?: () => Promise<T> | T;
    constructor?: new (...args: unknown[]) => T;
    dependencies: string[];
    status: RegistrationStatus;
    state: LifecycleState;
    error?: ServiceError;
    metadata?: Record<string, unknown>;
    lastUpdated: number;
    hooks?: ServiceLifecycleHooks<T>;
}

/**
 * Service dependency resolution result
 */
export interface DependencyResolution {
    /** Resolved service IDs in initialization order */
    order: string[];
    /** Circular dependencies if any */
    circular?: string[][];
    /** Missing dependencies */
    missing?: string[];
}

/**
 * Service lifecycle hooks
 */
export interface ServiceLifecycleHooks<T extends IService = IService> {
    /** Called before service initialization */
    beforeInit?: (service: T) => Promise<void> | void;
    /** Called after service initialization */
    afterInit?: (service: T) => Promise<void> | void;
    /** Called before service destruction */
    beforeDestroy?: (service: T) => Promise<void> | void;
    /** Called after service destruction */
    afterDestroy?: (service: T) => Promise<void> | void;
}

/**
 * Service manager events
 */
export interface ServiceManagerEvents {
    /** Service registered */
    registered: (registration: ServiceRegistration) => void;
    /** Service initialized */
    initialized: (service: IService) => void;
    /** Service failed */
    failed: (error: RegistrationError) => void;
    /** All services initialized */
    ready: () => void;
    /** Service destroyed */
    destroyed: (serviceId: string) => void;
}

export function isFactoryServiceConfig<T extends IService>(
    config: ServiceRegistrationConfig<T>
): config is FactoryServiceConfig<T> {
    return (config as FactoryServiceConfig<T>).type === 'factory';
}

export function isConstructorServiceConfig<T extends IService>(
    config: ServiceRegistrationConfig<T>
): config is ConstructorServiceConfig<T> {
    return (config as ConstructorServiceConfig<T>).type === 'constructor';
}

// Add type guard
export function isServiceState(value: any): value is LifecycleState {
    return Object.values(LifecycleState).includes(value);
}

// Use base status
export interface ServiceStatus extends BaseStatus {
    state: LifecycleState;
}