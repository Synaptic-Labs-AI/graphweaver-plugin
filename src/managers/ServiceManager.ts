// src/managers/ServiceManager.ts

import { App } from 'obsidian';
import { ServiceRegistry } from '../services/core/ServiceRegistry';
import { ServiceError } from '../services/core/ServiceError';
import { ServiceState } from '../state/ServiceState';
import { IService } from '../services/core/IService';
import { ServiceRegistrationConfig, RegistrationStatus } from '../types/ServiceTypes';

/**
 * Manager state interface
 */
interface ManagerState {
    state: ServiceState;
    error: ServiceError | null;
    registeredServices: number;
    initializedServices: number;
    pendingServices: string[];
    failedServices: Array<{ id: string; error: ServiceError }>;
}

/**
 * Manages service lifecycle and dependencies
 * Provides centralized access to all plugin services
 */
export class ServiceManager {
    private registry: ServiceRegistry;
    private state: ServiceState = ServiceState.Uninitialized;
    private error: ServiceError | null = null;
    private isUnloading: boolean = false;

    constructor(private app: App) {
        this.registry = new ServiceRegistry();
    }

    /**
     * Register a service with its dependencies
     * @param config Service registration configuration
     */
    public registerService<T extends IService>(config: ServiceRegistrationConfig<T>): void {
        if (this.isUnloading) {
            throw new ServiceError(
                'ServiceManager',
                'Cannot register services while unloading'
            );
        }

        try {
            this.registry.register(config);
            console.log(`ServiceManager: Registered service ${config.id}`);
        } catch (error) {
            this.handleError(`Failed to register service ${config.id}`, error);
            throw error;
        }
    }

    /**
     * Register multiple services at once
     * @param configs Array of service registration configurations
     */
    public registerServices(configs: ServiceRegistrationConfig<IService>[]): void {
        configs.forEach(config => this.registerService(config));
    }

    /**
     * Initialize all registered services
     */
    public async initializeServices(): Promise<void> {
        if (this.isUnloading) {
            throw new ServiceError('ServiceManager', 'Cannot initialize while unloading');
        }

        if (!this.hasRegisteredServices()) {
            throw new ServiceError('ServiceManager', 'No services registered');
        }

        try {
            this.state = ServiceState.Initializing;
            await this.registry.initializeServices();
            this.state = ServiceState.Ready;
            this.error = null;
            console.log('ServiceManager: All services initialized successfully');
        } catch (error) {
            this.state = ServiceState.Error;
            this.handleError('Service initialization failed', error);
            throw error;
        }
    }

    /**
     * Get an initialized service instance
     * @param id Service ID
     * @returns Service instance
     */
    public getService<T extends IService>(id: string): T {
        if (this.isUnloading) {
            throw new ServiceError('ServiceManager', 'Cannot get service while unloading');
        }
    
        // Remove the check for this.state !== ServiceState.Ready
    
        try {
            const serviceState = this.registry.getServiceState(id);
    
            if (serviceState.status !== RegistrationStatus.Initialized) {
                throw new ServiceError('ServiceManager', `Service ${id} is not initialized`);
            }
    
            const service = this.registry.getService<T>(id);
            console.log(`ServiceManager: Retrieved service ${id}`);
            return service;
        } catch (error) {
            this.handleError(`Failed to get service ${id}`, error);
            throw error;
        }
    }

    /**
     * Clean up all services and resources
     */
    public async destroy(): Promise<void> {
        if (this.isUnloading) return;

        this.isUnloading = true;
        this.state = ServiceState.Destroying;

        try {
            await this.registry.destroyServices();
            this.state = ServiceState.Destroyed;
            console.log('ServiceManager: All services destroyed successfully');
        } catch (error) {
            this.handleError('Service cleanup failed', error);
            throw error;
        }
    }

    /**
     * Get detailed manager state
     * @returns Current manager state
     */
    public getState(): ManagerState {
        const status = this.registry.getInitializationStatus();
        return {
            state: this.state,
            error: this.error,
            registeredServices: status.totalServices,
            initializedServices: status.initializedServices,
            pendingServices: status.pendingServices,
            failedServices: status.failedServices
        };
    }

    /**
     * Get service registration status
     * @param id Service ID
     * @returns Service state details
     */
    public getServiceState(id: string): {
        registered: boolean;
        status: RegistrationStatus;
        dependencies: string[];
        error?: ServiceError;
    } {
        return this.registry.getServiceState(id);
    }

    /**
     * Check if manager has registered services
     * @returns Boolean indicating if services are registered
     */
    public hasRegisteredServices(): boolean {
        return this.registry.hasRegisteredServices();
    }

    /**
     * Check if services are ready
     * @returns Boolean indicating if services are ready
     */
    public isReady(): boolean {
        return this.state === ServiceState.Ready && !this.isUnloading;
    }

    /**
     * Handle errors consistently
     * @param message Error message
     * @param error Error object
     */
    private handleError(message: string, error: unknown): void {
        const serviceError = error instanceof ServiceError 
            ? error 
            : ServiceError.from('ServiceManager', error);

        console.error('ServiceManager:', message, serviceError.getDetails());
        this.error = serviceError;
    }
}
