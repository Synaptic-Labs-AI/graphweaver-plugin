// src/services/core/ServiceRegistry.ts

import { IService } from './IService';
import { ServiceError, RegistrationError } from './ServiceError';
import { ServiceValidator } from './utils/ServiceValidator';
import { DependencyResolver } from './utils/DependencyResolver';
import { 
    ServiceRegistrationConfig, 
    RegistrationStatus, 
    ServiceRegistration, 
    InitializationStatus,
} from '../../types/ServiceTypes';

/**
 * Registry managing service lifecycle and dependencies
 */
export class ServiceRegistry {
    private services = new Map<string, ServiceRegistration>();
    private isInitializing = false;

    /**
     * Register a new service
     * @param config Service registration configuration
     */
    public register<T extends IService>(config: ServiceRegistrationConfig<T>): void {
        try {
            ServiceValidator.validateRegistration(config, this.services);
    
            const registration: ServiceRegistration<T> = {
                id: config.id,
                name: config.name || config.id,
                instance: null,
                dependencies: config.dependencies || [],
                status: RegistrationStatus.Registered,
                factory: config.type === 'factory' ? config.factory : undefined,
                constructor: config.type === 'constructor' ? config.constructor : undefined,
            };
    
            this.services.set(config.id, registration);
            console.log(`ServiceRegistry: Service ${config.id} registered`);
    
        } catch (error) {
            throw ServiceError.from('ServiceRegistry', error, {
                operation: 'register',
                serviceId: config.id,
            });
        }
    }
    

    /**
     * Initialize all services in dependency order
     */
    public async initializeServices(): Promise<void> {
        if (this.isInitializing) {
            throw ServiceError.from('ServiceRegistry', 'Already initializing services');
        }
    
        if (this.services.size === 0) {
            throw ServiceError.from('ServiceRegistry', 'No services registered');
        }
    
        this.isInitializing = true;
        const errors: RegistrationError[] = [];
    
        try {
            const initOrder = DependencyResolver.calculateInitializationOrder(this.services);
    
            for (const serviceId of initOrder) {
                try {
                    await this.initializeService(serviceId);
                } catch (error) {
                    const serviceError = ServiceError.from(serviceId, error, {
                        operation: 'initialize',
                        serviceId
                    });
                    errors.push({ id: serviceId, error: serviceError });
                    console.error(`ServiceRegistry: Failed to initialize service ${serviceId}`, serviceError);
                }
            }
    
            if (errors.length > 0) {
                throw ServiceError.from('ServiceRegistry', 'Service initialization failed', {
                    failedServices: errors
                });
            }
    
            console.log('ServiceRegistry: All services initialized successfully');
    
        } finally {
            this.isInitializing = false;
        }
    }

    /**
     * Initialize a single service by its ID
     * @param id Service ID
     */
    private async initializeService(id: string): Promise<void> {
        const registration = this.services.get(id)!;

        if (registration.status === RegistrationStatus.Initialized) {
            return;
        }

        registration.status = RegistrationStatus.Initializing;

        try {
            if (!registration.instance) {
                if (registration.factory) {
                    registration.instance = registration.factory();
                } else if (registration.constructor) {
                    registration.instance = new registration.constructor();
                } else {
                    throw new ServiceError(
                        'ServiceRegistry',
                        `No factory or constructor provided for service ${id}`
                    );
                }
            }

            await registration.instance.initialize();
            registration.status = RegistrationStatus.Initialized;
            registration.error = undefined;

            console.log(`ServiceRegistry: Service ${id} initialized`);

        } catch (error) {
            registration.status = RegistrationStatus.Error;
            registration.error = ServiceError.from('ServiceRegistry', error);
            throw error;
        }
    }

    /**
     * Get an initialized service by its ID
     * @param id Service ID
     * @returns Service instance
     */
    public getService<T extends IService>(id: string): T {
        const registration = this.services.get(id);

        if (!registration) {
            throw ServiceError.from('ServiceRegistry', `Service ${id} not found`);
        }

        if (registration.status !== RegistrationStatus.Initialized || !registration.instance) {
            throw ServiceError.from('ServiceRegistry', `Service ${id} not initialized`);
        }

        return registration.instance as T;
    }

    /**
     * Cleanup all services by destroying them
     */
    public async destroyServices(): Promise<void> {
        const errors: RegistrationError[] = [];
        const serviceIds = Array.from(this.services.keys()).reverse(); // Destroy in reverse order

        for (const id of serviceIds) {
            const registration = this.services.get(id);
            if (registration?.instance) {
                try {
                    await registration.instance.destroy();
                    registration.status = RegistrationStatus.Registered;
                    registration.instance = null;
                    console.log(`ServiceRegistry: Service ${id} destroyed`);
                } catch (error) {
                    errors.push({ 
                        id, 
                        error: ServiceError.from('ServiceRegistry', error, {
                            operation: 'destroy',
                            serviceId: id
                        })
                    });
                }
            }
        }

        if (errors.length > 0) {
            throw ServiceError.from('ServiceRegistry', 'Service destruction failed', {
                failedServices: errors
            });
        }

        console.log('ServiceRegistry: All services destroyed successfully');
    }

    /**
     * Get the current initialization status of services
     * @returns Initialization status summary
     */
    public getInitializationStatus(): InitializationStatus {
        const initialized = Array.from(this.services.values())
            .filter(reg => reg.status === RegistrationStatus.Initialized)
            .length;

        const pending = Array.from(this.services.entries())
            .filter(([_, reg]) => reg.status !== RegistrationStatus.Initialized)
            .map(([id]) => id);

        const failed = Array.from(this.services.entries())
            .filter(([_, reg]) => reg.status === RegistrationStatus.Error && reg.error)
            .map(([id, reg]) => ({
                id,
                error: reg.error as ServiceError
            }));

        return {
            totalServices: this.services.size,
            initializedServices: initialized,
            pendingServices: pending,
            failedServices: failed
        };
    }

    /**
     * Get the registration state of a specific service
     * @param id Service ID
     * @returns Service state details
     */
    public getServiceState(id: string): {
        registered: boolean;
        status: RegistrationStatus;
        dependencies: string[];
        error?: ServiceError;
    } {
        const registration = this.services.get(id);
        if (!registration) {
            throw ServiceError.from('ServiceRegistry', `Service ${id} not found`);
        }

        return {
            registered: this.services.has(id),
            status: registration.status,
            dependencies: registration.dependencies,
            error: registration.error
        };
    }

    /**
     * Check if any services are registered
     * @returns Boolean indicating if services are registered
     */
    public hasRegisteredServices(): boolean {
        return this.services.size > 0;
    }
}
