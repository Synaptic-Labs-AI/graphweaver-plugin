// src/registrations/ServiceRegistrations.ts

import { ServiceError } from '@services/core/ServiceError';
import { IService } from '@services/core/IService';
import type { InitializationStatus } from '@services/core/ServiceError';
import { ServiceInstance } from './CoreRegistrations';
/**
 * Registration status enum
 */
export enum RegistrationStatus {
    NotRegistered = 'NOT_REGISTERED',
    Registered = 'REGISTERED',
    Initialized = 'INITIALIZED',
    Failed = 'FAILED'
}

/**
 * Type for service identifiers
 */
type ServiceIdentifier = string;

/**
 * Interface for service registration details
 */
interface RegisteredService {
    instance: IService;
    dependencies: ServiceIdentifier[];
    error?: ServiceError; // Add error property
}

/**
 * Singleton ServiceRegistry to manage all services
 */

export class ServiceRegistry {
    private static instance: ServiceRegistry;
    private readonly services: Map<string, RegisteredService> = new Map();
    private readonly initializedServices: Set<string> = new Set();
    private isInitialized = false;

    private constructor() {} 

    public static getInstance(): ServiceRegistry {
        if (!ServiceRegistry.instance) {
            console.log('🦇 [ServiceRegistry] Creating new instance');
            ServiceRegistry.instance = new ServiceRegistry();
        }
        return ServiceRegistry.instance;
    }

    public getRegisteredServices(): ServiceInstance[] {
        console.log('🦇 [ServiceRegistry] Getting registered services');
        return Array.from(this.services.entries()).map(([id, service]) => ({
            id,
            service: service.instance,
            name: service.instance.serviceName || id,
            initialize: () => service.instance.initialize(),
            destroy: () => service.instance.destroy()
        }));
    }

    public hasRegisteredServices(): boolean {
        return this.services.size > 0;
    }

    public getServiceState(id: string): {
        registered: boolean;
        status: RegistrationStatus;
        dependencies: string[];
        error?: ServiceError;
    } {
        const service = this.services.get(id);
        if (!service) {
            return {
                registered: false,
                status: RegistrationStatus.NotRegistered,
                dependencies: []
            };
        }

        return {
            registered: true,
            status: this.initializedServices.has(id) 
                ? RegistrationStatus.Initialized 
                : RegistrationStatus.Registered,
            dependencies: service.dependencies,
            error: service.error
        };
    }

    public getInitializationStatus(): InitializationStatus {
        const failedServices: Array<{id: string; error: ServiceError}> = [];
        const pendingServices: string[] = [];

        this.services.forEach((service, id) => {
            if (service.error) {
                failedServices.push({ id, error: service.error });
            } else if (!this.initializedServices.has(id)) {
                pendingServices.push(id);
            }
        });

        return {
            totalServices: this.services.size,
            initializedServices: this.initializedServices.size,
            pendingServices,
            failedServices,
            timestamp: Date.now()
        };
    }

    public getService<T extends IService>(id: ServiceIdentifier): T {
        console.log(`🦇 [ServiceRegistry] Getting service: ${id}`);
        
        if (!this.isInitialized) {
            throw new ServiceError(
                'ServiceRegistry',
                'Registry not initialized. Call initializeRegistry() first.',
                'REGISTRY_NOT_INITIALIZED'
            );
        }

        const service = this.services.get(id);
        if (!service) {
            const available = Array.from(this.services.keys()).join(', ');
            throw new ServiceError(
                'ServiceRegistry',
                `Service ${id} not found. Available: ${available}`,
                'SERVICE_NOT_FOUND'
            );
        }

        return service.instance as T;
    }


    public getDependencies(serviceId: string): string[] {
        const service = this.services.get(serviceId);
        return service ? service.dependencies : [];
    }
    
    public hasService(serviceId: string): boolean {
        return this.services.has(serviceId);
    }
    
    public getAllServiceIds(): string[] {
        return Array.from(this.services.keys());
    }
    

    public async initializeRegistry(): Promise<void> {
        console.log('🦇 [ServiceRegistry] Initializing registry');
        this.isInitialized = true;
    }

    public async registerService<T extends IService>(
        id: ServiceIdentifier,
        instance: T,
        dependencies: ServiceIdentifier[] = []
    ): Promise<void> {
        console.log(`🦇 [ServiceRegistry] Registering service: ${id}`);
        
        if (this.services.has(id)) {
            throw new ServiceError(
                'ServiceRegistry',
                `Service ${id} already registered`,
                'SERVICE_ALREADY_REGISTERED'
            );
        }

        this.services.set(id, {
            instance,
            dependencies,
            error: undefined
        });
        
        if (dependencies.length === 0) {
            this.initializedServices.add(id);
        }
        
        console.log(`🦇 [ServiceRegistry] Available services: ${Array.from(this.services.keys()).join(', ')}`);
    }

    public async initializeAll(): Promise<void> {
        console.log('🦇 [ServiceRegistry] Initializing all services');
        for (const [id, service] of this.services) {
            if (!this.initializedServices.has(id)) {
                try {
                    await service.instance.initialize();
                    this.initializedServices.add(id);
                } catch (error) {
                    service.error = error instanceof ServiceError ? error : 
                        new ServiceError(`Failed to initialize ${id}`, 'INITIALIZATION_FAILED');
                    throw service.error;
                }
            }
        }
    }

    public async destroyAll(): Promise<void> {
        console.log('🦇 [ServiceRegistry] Destroying all services');
        const services = Array.from(this.services.entries()).reverse();
        
        for (const [id, service] of services) {
            try {
                await service.instance.destroy();
                this.initializedServices.delete(id);
            } catch (error) {
                console.error(`🦇 [ServiceRegistry] Error destroying ${id}:`, error);
            }
        }
        
        this.services.clear();
        this.isInitialized = false;
    }
}