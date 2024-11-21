import type { Plugin } from 'obsidian';
import { 
    RegistrationStatus, 
    ServiceState,
    ServiceRegistration,
    RegistrationError
} from '@type/services.types';
import { ServiceRegistry } from '@registrations/ServiceRegistrations';
import { ServiceError } from '@services/core/ServiceError';
import type { IService } from '@services/core/IService';
import type { InitializationStatus } from '@type/services.types';
import { TypedEventEmitter, ServiceEvents } from '@type/events.types';

/**
 * Manages service lifecycle and initialization
 */
export class ServiceManager extends TypedEventEmitter<ServiceEvents> {
    private static instance: ServiceManager | null = null;
    private readonly registry: ServiceRegistry;
    private state: ServiceState = ServiceState.Uninitialized;
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
            const instance = await Promise.resolve(serviceInstance);
            await this.registry.registerService(id, instance, dependencies);
            
            const registration: ServiceRegistration<IService> = {
                id,
                name: instance.serviceName,
                instance,
                dependencies,
                status: RegistrationStatus.Registered,
                state: ServiceState.Uninitialized,
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
                error: new ServiceError('ServiceManager', 'Registration failed', error as Error),
                timestamp: Date.now(),
                recoverable: false
            };
            
            this.emit('failed', registrationError);
            throw error;
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
                this.state = ServiceState.Initializing;
                
                await Promise.race([
                    this.registry.initializeAll(),
                    this.createTimeout()
                ]);

                this.state = ServiceState.Ready;
                this.emit('ready');
            } catch (error) {
                if (retryCount < this.CONFIG.MAX_RETRIES) {
                    retryCount++;
                    console.log(`🦇 [ServiceManager] Retry ${retryCount}/${this.CONFIG.MAX_RETRIES}`);
                    await new Promise(resolve => setTimeout(resolve, this.CONFIG.RETRY_DELAY));
                    return initializeWithRetry();
                }
                
                this.state = ServiceState.Error;
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

    public getServiceState(id: string): {
        registered: boolean;
        status: RegistrationStatus;
        dependencies: string[];
        error?: ServiceError;
    } {
        return this.registry.getServiceState(id);
    }

    public getState(): ServiceState {
        return this.state;
    }

    public getError(): ServiceError | null {
        return this.error;
    }

    public async unload(): Promise<void> {
        if (this.isUnloading) return;

        this.isUnloading = true;
        this.state = ServiceState.Destroying;

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
            
            this.state = ServiceState.Destroyed;
        } catch (error) {
            this.state = ServiceState.Error;
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