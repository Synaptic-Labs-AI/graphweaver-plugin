// src/types/ServiceTypes.ts

import { IService } from '../services/core/IService';
import { ServiceError } from '../services/core/ServiceError';

/**
 * Base interface for service registration configuration
 */
export interface BaseServiceConfig<T extends IService> {
    id: string;
    name?: string;
    dependencies?: string[];
}

/**
 * Configuration for factory-based service registration
 */
export interface FactoryServiceConfig<T extends IService> extends BaseServiceConfig<T> {
    type: 'factory';
    factory: () => T;
}

/**
 * Configuration for constructor-based service registration
 */
export interface ConstructorServiceConfig<T extends IService> extends BaseServiceConfig<T> {
    type: 'constructor';
    constructor: new (...args: any[]) => T;
}

/**
 * Union type for service registration configuration
 */
export type ServiceRegistrationConfig<T extends IService> =
    | FactoryServiceConfig<T>
    | ConstructorServiceConfig<T>;

/**
 * Service initialization status summary
 */
export interface InitializationStatus {
    totalServices: number;
    initializedServices: number;
    pendingServices: string[];
    failedServices: Array<{ id: string; error: ServiceError }>;
}

/**
 * Error information during service registration or initialization
 */
export interface RegistrationError {
    id: string;
    error: ServiceError;
}

/**
 * Service registration status enumeration
 */
export enum RegistrationStatus {
    NotRegistered = 'not_registered',
    Registered = 'registered',
    Initializing = 'initializing',
    Initialized = 'initialized',
    Error = 'error'
}

/**
 * Service registration information
 */
export interface ServiceRegistration<T extends IService = IService> {
    id: string;
    name: string;
    instance: T | null;
    factory?: () => T;
    constructor?: new (...args: any[]) => T;
    dependencies: string[];
    status: RegistrationStatus;
    error?: ServiceError;
}

/**
 * Type guards to differentiate between Factory and Constructor configurations
 */
export function isFactoryServiceConfig<T extends IService>(
    config: ServiceRegistrationConfig<T>
): config is FactoryServiceConfig<T> {
    return config.type === 'factory';
}

export function isConstructorServiceConfig<T extends IService>(
    config: ServiceRegistrationConfig<T>
): config is ConstructorServiceConfig<T> {
    return config.type === 'constructor';
}
