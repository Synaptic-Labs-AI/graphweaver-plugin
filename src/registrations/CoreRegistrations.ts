// src/registrations/CoreRegistrations.ts

import { Plugin } from 'obsidian';
import { ServiceRegistry } from './ServiceRegistrations';
import { ServiceError } from '@services/core/ServiceError';
import { utils } from '@stores/CoreStore';

// Core Services
import { SettingsService } from '@services/SettingsService';
import { DatabaseService } from '@services/DatabaseService';
import { FileScannerService } from '@services/file/FileScannerService';
import { WikilinkTextProcessor } from '@services/WikilinkTextProcessor';
import { JsonValidationService } from '@services/JsonValidationService';

/**
 * Interface for a managed service instance
 */
export interface ServiceInstance {
    id: string;
    service: any;
    name: string;
    initialize: () => Promise<void>;
    destroy: () => Promise<void>;
}

/**
 * Service registration configuration
 */
const CORE_SERVICES: Array<{
    id: string;
    name: string;
    factory: (plugin: Plugin) => any;
    dependencies?: string[];
}> = [
    {
        id: 'settingsService',
        name: 'Settings Service',
        factory: (plugin) => new SettingsService(plugin)
    },
    {
        id: 'jsonValidationService',
        name: 'JSON Validation Service',
        factory: (plugin) => new JsonValidationService()
    },
    {
        id: 'databaseService',
        name: 'Database Service',
        factory: (plugin) => new DatabaseService(plugin),
        dependencies: ['settingsService']
    },
    {
        id: 'wikilinkProcessor',
        name: 'Wikilink Processor',
        factory: (plugin) => new WikilinkTextProcessor()
    },
    {
        id: 'fileScanner',
        name: 'File Scanner',
        factory: (plugin) => new FileScannerService(plugin.app.vault),
        dependencies: ['settingsService']
    }
];

/**
 * Handle and report errors consistently
 */
function reportError(message: string, source: string, error?: Error): void {
    console.error(`🦇 [CoreRegistrations] ${message}:`, error);
    utils.reportError(
        error ? `${message}: ${error.message}` : message,
        'error',
        { source }
    );
}

/**
 * Initialize core services with proper dependency management
 */
export async function initializeCoreServices(plugin: Plugin): Promise<void> {
    console.log('🦇 [CoreRegistrations] Starting initialization sequence');
    
    const registry = ServiceRegistry.getInstance();
    await registry.initializeRegistry(); // Initialize registry first
    
    const registeredServices: ServiceInstance[] = [];

    try {
        // Phase 1: Register all services first
        console.log('🦇 [CoreRegistrations] Phase 1: Registering services');
        for (const config of CORE_SERVICES) {
            await registerService(config, plugin, registry, registeredServices);
        }

        // Phase 2: Validate dependencies
        console.log('🦇 [CoreRegistrations] Phase 2: Validating dependencies');
        await validateServiceDependencies(registry);

        // Phase 3: Initialize services in order
        console.log('🦇 [CoreRegistrations] Phase 3: Initializing services');
        await initializeServices(registeredServices);

        console.log('🦇 [CoreRegistrations] All services initialized successfully');
    } catch (error) {
        console.error('🦇 [CoreRegistrations] Initialization failed:', error);
        await performCleanup(registeredServices);
        throw error instanceof ServiceError ? error : 
            new ServiceError('CoreRegistrations', 'Service initialization failed', error as Error);
    }
}

/**
 * Register a single service
 */
async function registerService(
    config: typeof CORE_SERVICES[0],
    plugin: Plugin,
    registry: ServiceRegistry,
    registeredServices: ServiceInstance[]
): Promise<void> {
    console.log(`🦇 [CoreRegistrations] Registering ${config.name}`);
    
    try {
        const service = config.factory(plugin);
        await registry.registerService(config.id, service, config.dependencies);
        
        registeredServices.push({
            id: config.id,
            service,
            name: config.name,
            initialize: service.initialize.bind(service),
            destroy: service.destroy.bind(service)
        });
        
        console.log(`🦇 [CoreRegistrations] Registered ${config.name} successfully`);
    } catch (error) {
        throw new ServiceError(
            'CoreRegistrations',
            `Failed to register ${config.name}`,
            error as Error
        );
    }
}

/**
 * Validate service dependencies
 */
async function validateServiceDependencies(registry: ServiceRegistry): Promise<void> {
    console.log('🦇 [CoreRegistrations] Validating service dependencies');
    
    const serviceIds = registry.getAllServiceIds();
    for (const id of serviceIds) {
        const deps = registry.getDependencies(id);
        const missingDeps = deps.filter(dep => !registry.hasService(dep));
        
        if (missingDeps.length > 0) {
            throw new ServiceError(
                'CoreRegistrations',
                `Service ${id} missing dependencies: ${missingDeps.join(', ')}`
            );
        }
    }
}

/**
 * Initialize registered services
 */
async function initializeServices(services: ServiceInstance[]): Promise<void> {
    for (const { name, initialize } of services) {
        try {
            console.log(`🦇 [CoreRegistrations] Initializing ${name}`);
            await initialize();
            console.log(`🦇 [CoreRegistrations] Initialized ${name} successfully`);
        } catch (error) {
            throw new ServiceError(
                'CoreRegistrations',
                `Failed to initialize ${name}`,
                error as Error
            );
        }
    }
}

/**
 * Perform cleanup on initialization failure
 */
async function performCleanup(services: ServiceInstance[]): Promise<void> {
    console.log('🦇 [CoreRegistrations] Starting cleanup sequence');
    
    const reversedServices = [...services].reverse();
    for (const { name, destroy } of reversedServices) {
        try {
            await destroy();
            console.log(`🦇 [CoreRegistrations] Cleaned up ${name}`);
        } catch (error) {
            reportError(
                `Cleanup failed for ${name}`,
                'ServiceCleanup',
                error as Error
            );
        }
    }
}

/**
 * Clean up core services in reverse initialization order
 */
export async function destroyCoreServices(services: ServiceInstance[]): Promise<void> {
    if (!services?.length) return;
    await performCleanup(services);
}
