// src/registrations/AIRegistrations.ts

import { App, Plugin } from 'obsidian';
import { ServiceRegistry } from './ServiceRegistrations';
import { ServiceError } from '@services/core/ServiceError';
import { AIProvider } from '@type/ai.types';
import { utils } from '@stores/CoreStore';

// Core Services
import { SettingsService } from '@services/SettingsService';
import { JsonValidationService } from '@services/JsonValidationService';
import { DatabaseService } from '@services/DatabaseService';
import { WikilinkTextProcessor } from '@services/WikilinkTextProcessor';

// AI Services
import { MetricsTracker } from '@services/ai/MetricsTracker';
import { OperationEventEmitter } from '@services/ai/OperationEventEmitter';
import { AdapterRegistry } from '@services/ai/AdapterRegistry';
import { GeneratorFactory } from '@services/ai/GeneratorFactory';
import { QueueManagerService } from '@services/ai/QueueManagerService';
import { AIOperationManager } from '@services/ai/AIOperationManager';
import { AIService } from '@services/ai/AIService';

/**
 * Service registration configuration
 */
interface ServiceConfig {
    id: string;
    name: string;
    factory: (context: ServiceContext) => any;
    dependencies?: string[];
}

/**
 * Service initialization context
 */
interface ServiceContext {
    app: App;
    plugin: Plugin;
    registry: ServiceRegistry;
}

/**
 * AI service configurations
 */
const AI_SERVICES: ServiceConfig[] = [
    {
        id: 'metricsTracker',
        name: 'Metrics Tracker',
        factory: () => new MetricsTracker()
    },
    {
        id: 'operationEventEmitter',
        name: 'Operation Event Emitter',
        factory: () => new OperationEventEmitter()
    },
    {
        id: 'adapterRegistry',
        name: 'AI Adapter Registry',
        factory: ({ registry }) => new AdapterRegistry(
            registry.getService<SettingsService>('settingsService'),
            registry.getService<JsonValidationService>('jsonValidationService')
        ),
        dependencies: ['settingsService', 'jsonValidationService']
    },
    {
        id: 'generatorFactory',
        name: 'Generator Factory',
        factory: ({ app, registry }) => new GeneratorFactory(
            app,
            registry.getService<SettingsService>('settingsService'),
            registry.getService<AdapterRegistry>('adapterRegistry'),
            registry.getService<WikilinkTextProcessor>('wikilinkProcessor')
        ),
        dependencies: ['settingsService', 'adapterRegistry', 'wikilinkProcessor']
    },
    {
        id: 'queueManager',
        name: 'Queue Manager',
        factory: () => new QueueManagerService(async (operation) => {
            console.log('🦇 Processing operation:', operation);
            await operation.execute();
        })
    },
    {
        id: 'aiOperationManager',
        name: 'AI Operation Manager',
        factory: ({ registry }) => new AIOperationManager(
            registry.getService<AdapterRegistry>('adapterRegistry'),
            registry.getService<GeneratorFactory>('generatorFactory')
        ),
        dependencies: ['adapterRegistry', 'generatorFactory']
    },
    {
        id: 'aiService',
        name: 'AI Service',
        factory: ({ app, registry }) => new AIService(
            app,
            registry.getService<AIOperationManager>('aiOperationManager'),
            registry.getService<SettingsService>('settingsService'),
            registry.getService<JsonValidationService>('jsonValidationService'),
            registry.getService<DatabaseService>('databaseService'),
            registry.getService<WikilinkTextProcessor>('wikilinkProcessor'),
            {
                defaultProvider: AIProvider.OpenAI,
                enableNotifications: true,
                debug: false
            }
        ),
        dependencies: [
            'aiOperationManager',
            'settingsService',
            'jsonValidationService',
            'databaseService',
            'wikilinkProcessor'
        ]
    }
];

/**
 * Handle and report errors consistently
 */
function reportError(message: string, source: string, error?: Error): void {
    console.error(`🦇 [AIRegistrations] ${message}:`, error);
    utils.reportError(
        error ? `${message}: ${error.message}` : message,
        'error',
        { source }
    );
}

/**
 * Validate service dependencies
 */
async function validateDependencies(
    dependencies: string[],
    registry: ServiceRegistry
): Promise<void> {
    for (const depId of dependencies) {
        try {
            const service = registry.getService(depId);
            if (!service) {
                throw new Error(`Required dependency '${depId}' not found`);
            }
        } catch (error) {
            throw new ServiceError(
                'AIRegistrations',
                `Dependency validation failed for '${depId}'`,
                error instanceof Error ? error : undefined
            );
        }
    }
}

/**
 * Register and initialize an AI service
 */
async function registerService(
    config: ServiceConfig,
    context: ServiceContext
): Promise<void> {
    console.log(`🦇 Registering ${config.name}...`);

    try {
        // Validate dependencies if any
        if (config.dependencies?.length) {
            await validateDependencies(config.dependencies, context.registry);
        }

        // Create and register service
        const service = config.factory(context);
        await context.registry.registerService(config.id, service);

        // Initialize if service has initialize method
        if (typeof service.initialize === 'function') {
            await service.initialize();
        }

        console.log(`🦇 Initialized ${config.name}`);
    } catch (error) {
        reportError(
            `Failed to register ${config.name}`, 
            error instanceof Error ? error.message : String(error)
        );
        throw error;
    }
}

/**
 * Register AI Services
 */
export async function registerAIServices(app: App, plugin: Plugin): Promise<void> {
    console.log('🦇 Starting AI services registration');
    
    const registry = ServiceRegistry.getInstance();
    const context: ServiceContext = { app, plugin, registry };

    try {
        // Register services sequentially
        for (const serviceConfig of AI_SERVICES) {
            await registerService(serviceConfig, context);
        }
        console.log('🦇 AI Services registered successfully');
    } catch (error) {
        reportError(
            'Failed to register AI services',
            error instanceof Error ? error.message : String(error)
        );
        throw error instanceof ServiceError ? error :
            new ServiceError('AIRegistrations', 'AI services registration failed');
    }
}