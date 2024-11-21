// src/stores/ServiceStore.ts

import { derived, get } from 'svelte/store';
import { createPersistedStore } from './StoreUtils';
import { core, utils as coreUtils } from './CoreStore';
import { 
    ServiceRegistration, 
    ServiceState, 
    RegistrationStatus 
} from '@type/services.types';
import { ServiceError } from '@services/core/ServiceError';

interface ServiceStoreState {
    registrations: Map<string, ServiceRegistration>;
    initialized: Set<string>;
    initializing: Set<string>;
    failed: Map<string, ServiceError>;
}

interface SerializationOptions<T> {
    serialize: (state: T) => string;
    deserialize: (data: string) => T;
}

export class ServiceStore {
    private static readonly STORAGE_KEY = 'graphweaver-service-state';
    private static instance: ServiceStore | null = null;
    private readonly store;
    public subscribe;

    private constructor() {
        const initialState: ServiceStoreState = {
            registrations: new Map<string, ServiceRegistration>(),
            initialized: new Set<string>(),
            initializing: new Set<string>(),
            failed: new Map<string, ServiceError>()
        };

        this.store = createPersistedStore<ServiceStoreState>(
            ServiceStore.STORAGE_KEY,
            initialState,
            (state: Partial<ServiceStoreState>) => {
                return state !== null && 
                    state.registrations instanceof Map &&
                    state.initialized instanceof Set &&
                    state.initializing instanceof Set &&
                    state.failed instanceof Map;
            }
        );

        this.subscribe = this.store.subscribe;
    }

    public static getInstance(): ServiceStore {
        if (!ServiceStore.instance) {
            ServiceStore.instance = new ServiceStore();
        }
        return ServiceStore.instance;
    }

    async initialize(): Promise<void> {
        try {
            const coreState = get(core);
            if (!coreState.initialized) {
                throw new Error('Core store must be initialized first');
            }
        } catch (error) {
            this.handleError('Failed to initialize Service Store', error);
            throw error;
        }
    }

    registerService(service: ServiceRegistration): void {
        try {
            this.store.update(state => {
                if (state.registrations.has(service.id)) {
                    throw new ServiceError('ServiceStore', `Service ${service.id} is already registered`);
                }
                
                const updatedService = {
                    ...service,
                    status: RegistrationStatus.Registered,
                    state: ServiceState.Uninitialized
                };
                
                state.registrations.set(service.id, updatedService);
                return state;
            });
        } catch (error) {
            this.handleError(`Failed to register service: ${service.id}`, error);
        }
    }

    initializeService(serviceId: string): void {
        try {
            this.store.update(state => {
                const service = state.registrations.get(serviceId);
                if (!service) {
                    throw new ServiceError('ServiceStore', `Service ${serviceId} not found`);
                }

                state.initializing.add(serviceId);
                service.state = ServiceState.Initializing;
                return state;
            });

            this.store.update(state => {
                const service = state.registrations.get(serviceId);
                if (service) {
                    state.initializing.delete(serviceId);
                    state.initialized.add(serviceId);
                    service.state = ServiceState.Ready;
                    service.status = RegistrationStatus.Initialized;
                }
                return state;
            });
        } catch (error) {
            this.store.update(state => {
                const service = state.registrations.get(serviceId);
                if (service) {
                    service.state = ServiceState.Error;
                    service.status = RegistrationStatus.Failed;
                    state.failed.set(serviceId, error as ServiceError);
                }
                return state;
            });
            this.handleError(`Failed to initialize service: ${serviceId}`, error);
        }
    }

    async reset(): Promise<void> {
        this.store.set({
            registrations: new Map<string, ServiceRegistration>(),
            initialized: new Set<string>(),
            initializing: new Set<string>(),
            failed: new Map<string, ServiceError>()
        });
    }

    getSnapshot(): ServiceStoreState {
        return get(this.store);
    }

    private handleError(message: string, error: unknown): void {
        coreUtils.reportError(message, 'error', { error });
    }
}

export const serviceStore = ServiceStore.getInstance();

export const serviceRegistrations = derived(serviceStore, $state => Array.from($state.registrations.values()));
export const initializedServices = derived(serviceStore, $state => Array.from($state.initialized));
export const initializingServices = derived(serviceStore, $state => Array.from($state.initializing));
export const failedServices = derived(serviceStore, $state => Array.from($state.failed.values()));