import type { Plugin } from 'obsidian';
import { 
    RegistrationStatus,
    ServiceRegistration,
    RegistrationError
} from '@type/services.types';
import { LifecycleState } from '@type/base.types';
import { ServiceRegistry } from '@registrations/ServiceRegistrations';
import { ServiceError } from '@services/core/ServiceError';
import type { IService } from '@services/core/IService';
import { TypedEventEmitter, ServiceEvents } from '@type/events.types';

/**
 * Manages service lifecycle and initialization
 */
export class ServiceManager extends TypedEventEmitter<ServiceEvents> {
    private static instance: ServiceManager | null = null;
    private readonly registry: ServiceRegistry;
    private state: LifecycleState = LifecycleState.Uninitialized;
    private error: ServiceError | null = null;
    private isUnloading = false;

    private readonly CONFIG = {
        MAX_RETRIES: 3,
        RETRY_DELAY: 5000,
        INIT_TIMEOUT: 30000
    };

    private constructor(private plugin: Plugin) {
        super();
        this.registry = ServiceRegistry.getInstance();
        this.setupErrorHandlers();
    }

    public static getInstance(plugin?: Plugin): ServiceManager {
        if (!ServiceManager.instance) {
            if (!plugin) {
                throw new Error('Plugin instance required for initialization');
            }
            ServiceManager.instance = new ServiceManager(plugin);
        }
        return ServiceManager.instance;
    }

    public async registerService<T extends IService>(
        id: string,
        serviceInstance: T | Promise<T>,
        dependencies: string[] = []
    ): Promise<void> {
        console.log(`🦇 [ServiceManager] Registering service: ${id}`);
        
        try {
            // Validate service instance
            if (!serviceInstance) {
                throw new ServiceError('ServiceManager', `Invalid service instance for ${id}`);
            }

            const instance = await Promise.resolve(serviceInstance);
            
            // Validate service interface implementation
            if (!instance.initialize || !instance.destroy) {
                throw new ServiceError('ServiceManager', 
                    `Service ${id} missing required interface methods`);
            }
            
            // Check for duplicate registration
            if (this.registry.hasService(id)) {
                throw new ServiceError('ServiceManager', 
                    `Service ${id} already registered`);
            }

            await this.registry.registerService(id, instance, dependencies);
            
            const registration: ServiceRegistration<IService> = {
                id,
                name: instance.serviceName || id,
                instance,
                dependencies,
                status: RegistrationStatus.Registered,
                state: LifecycleState.Uninitialized,
                lastUpdated: Date.now(),
                factory: undefined,
                constructor: undefined,
                hooks: undefined,
                metadata: undefined
            };

            this.emit('registered', registration);
        } catch (error) {
            const registrationError: RegistrationError = {
                id,
                error: ServiceError.from('ServiceManager', error, {
                    context: `Failed to register service: ${id}`
                }),
                timestamp: Date.now(),
                recoverable: false
            };
            
            this.emit('failed', registrationError);
            throw registrationError.error;
        }
    }

    public async initializeServices(): Promise<void> {
        if (this.isUnloading) {
            throw new ServiceError('ServiceManager', 'Cannot initialize while unloading');
        }

        if (!this.registry.hasRegisteredServices()) {
            throw new ServiceError('ServiceManager', 'No services registered');
        }

        let retryCount = 0;
        
        const initializeWithRetry = async (): Promise<void> => {
            try {
                this.state = LifecycleState.Initializing;
                
                await Promise.race([
                    this.registry.initializeAll(),
                    this.createTimeout()
                ]);

                this.state = LifecycleState.Ready;
                this.emit('ready');
            } catch (error) {
                if (retryCount < this.CONFIG.MAX_RETRIES) {
                    retryCount++;
                    console.log(`🦇 [ServiceManager] Retry ${retryCount}/${this.CONFIG.MAX_RETRIES}`);
                    await new Promise(resolve => setTimeout(resolve, this.CONFIG.RETRY_DELAY));
                    return initializeWithRetry();
                }
                
                this.state = LifecycleState.Error;
                this.handleError('Initialization failed', error);
                throw error;
            }
        };

        await initializeWithRetry();
    }

    public getService<T extends IService>(id: string): T {
        return this.registry.getService<T>(id);
    }

    public hasService(id: string): boolean {
        return this.registry.getServiceState(id).registered;
    }

    public getLifecycleState(id: string): {
        registered: boolean;
        status: RegistrationStatus;
        dependencies: string[];
        error?: ServiceError;
    } {
        return this.registry.getServiceState(id);
    }

    public getState(): LifecycleState {
        return this.state;
    }

    public getError(): ServiceError | null {
        return this.error;
    }

    public async unload(): Promise<void> {
        if (this.isUnloading) return;

        this.isUnloading = true;
        this.state = LifecycleState.Destroying;

        try {
            const services = Array.from(this.registry.getRegisteredServices());
            
            await Promise.all(services.reverse().map(async service => {
                try {
                    const serviceId = service.service.serviceId;
                    await service.service.destroy();
                    this.emit('destroyed', serviceId);
                } catch (error) {
                    console.error(`🦇 [ServiceManager] Unload failed for ${service.id}:`, error);
                }
            }));
            
            this.state = LifecycleState.Destroyed;
        } catch (error) {
            this.state = LifecycleState.Error;
            this.handleError('Unload failed', error);
            throw error;
        } finally {
            this.isUnloading = false;
        }
    }

    private createTimeout(): Promise<never> {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(new ServiceError(
                    'ServiceManager',
                    `Initialization timed out after ${this.CONFIG.INIT_TIMEOUT}ms`
                ));
            }, this.CONFIG.INIT_TIMEOUT);
        });
    }

    private setupErrorHandlers(): void {
        window.addEventListener('unhandledrejection', event => {
            this.handleError('Unhandled promise rejection', event.reason);
        });

        window.addEventListener('error', event => {
            this.handleError('Unhandled error', event.error);
        });
    }

    private handleError(message: string, error: unknown): void {
        this.error = error instanceof ServiceError ? error :
            new ServiceError('ServiceManager', message, error instanceof Error ? error : undefined);
        
        console.error(`🦇 [ServiceManager] ${message}:`, this.error);
    }
}