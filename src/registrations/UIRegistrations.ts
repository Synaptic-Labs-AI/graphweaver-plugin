// src/registrations/UIRegistrations.ts

import { ServiceRegistry } from './ServiceRegistrations';
import { uiStore, UIStore } from '@stores/UIStore';
import { processingStore, ProcessingStore } from '@stores/ProcessingStore';
import { ServiceError } from '@services/core/ServiceError';
import { IService } from '@services/core/IService';

/**
 * Register UI and Processing stores with service registry
 */
export async function registerUIServices(): Promise<void> {
    const registry = ServiceRegistry.getInstance();

    try {
        // Register UI store
        await registry.registerService(
            uiStore.serviceId,
            uiStore,
            [] // No dependencies
        );

        // Register Processing store
        await registry.registerService(
            processingStore.serviceId,
            processingStore,
            [uiStore.serviceId] // Depends on UI store
        );

        console.log('🦇 UI services registered successfully');
    } catch (error) {
        console.error('🦇 Failed to register UI services:', error);
        throw new ServiceError(
            'UIRegistrations',
            'Failed to register UI services',
            error instanceof Error ? error : undefined
        );
    }
}

/**
 * Initialize UI services
 */
export async function initializeUIServices(): Promise<void> {
    const registry = ServiceRegistry.getInstance();

    try {
        // Get registered services
        const ui = registry.getService<UIStore>(uiStore.serviceId);
        const processing = registry.getService<ProcessingStore>(processingStore.serviceId);

        // Initialize in dependency order
        await ui.initialize();
        await processing.initialize();

        console.log('🦇 UI services initialized successfully');
    } catch (error) {
        console.error('🦇 Failed to initialize UI services:', error);
        throw new ServiceError(
            'UIRegistrations',
            'Failed to initialize UI services',
            error instanceof Error ? error : undefined
        );
    }
}

/**
 * Clean up UI services
 */
export async function destroyUIServices(): Promise<void> {
    const registry = ServiceRegistry.getInstance();

    try {
        // Get registered services
        const ui = registry.getService<UIStore>(uiStore.serviceId);
        const processing = registry.getService<ProcessingStore>(processingStore.serviceId);

        // Destroy in reverse dependency order
        await processing.destroy();
        await ui.destroy();

        console.log('🦇 UI services destroyed successfully');
    } catch (error) {
        console.error('🦇 Failed to destroy UI services:', error);
        // Log error but don't throw during cleanup
    }
}