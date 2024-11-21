// src/registrations/FileRegistrations.ts

import { App } from 'obsidian';
import { ServiceRegistry } from './ServiceRegistrations';
import { FileProcessorService } from '@services/file/FileProcessorService';
import { BatchProcessor } from '@generators/BatchProcessor';
import { AIService } from '@services/ai/AIService';
import { SettingsService } from '@services/SettingsService';
import { DatabaseService } from '@services/DatabaseService';
import { FileScannerService } from '@services/file/FileScannerService';
import { GeneratorFactory } from '@services/ai/GeneratorFactory';
import { AIOperationManager } from '@services/ai/AIOperationManager';
import { processingStore } from '@stores/ProcessingStore';
import { IService } from '@services/core/IService';

// Create a service-compliant wrapper for BatchProcessor
class BatchProcessorService implements IService {
    private batchProcessor: BatchProcessor;
    
    serviceId = 'batchProcessor';
    serviceName = 'Batch Processor Service';
    
    constructor(
        app: App,
        fileProcessor: FileProcessorService,
        operationExecutor: any,
    ) {
        this.batchProcessor = new BatchProcessor(
            app,
            fileProcessor, 
            operationExecutor,
        );
    }

    async initialize(): Promise<void> {
        // Add any initialization logic here
        return Promise.resolve();
    }

    isReady(): boolean {
        return true;
    }

    async destroy(): Promise<void> {
        // Add any cleanup logic here
        return Promise.resolve();
    }

    getState(): any {
        // Implement the logic to return the current state of batchProcessor
        return {}; // Placeholder implementation
    }

    // Expose the underlying batch processor methods
    getBatchProcessor(): BatchProcessor {
        return this.batchProcessor;
    }
}

/**
 * Register File Services
 */
export async function registerFileServices(app: App): Promise<void> {
    const registry = ServiceRegistry.getInstance();

    try {
        // Get required services
        const aiService = registry.getService<AIService>('aiService');
        const settingsService = registry.getService<SettingsService>('settingsService');
        const databaseService = registry.getService<DatabaseService>('databaseService');
        const fileScannerService = registry.getService<FileScannerService>('fileScanner');
        const generatorFactory = registry.getService<GeneratorFactory>('generatorFactory');
        const operationManager = registry.getService<AIOperationManager>('aiOperationManager');

        // Register FileProcessorService
        await registry.registerService(
            'fileProcessorService', 
            new FileProcessorService(
                app,
                aiService,
                settingsService,
                databaseService,
                fileScannerService,
                generatorFactory,
                processingStore
            )
        );

        // Register BatchProcessorService with dependencies
        await registry.registerService(
            'batchProcessor',
            new BatchProcessorService(
                app,
                registry.getService('fileProcessorService'),
                operationManager.getOperationExecutor(),
            ),
            ['fileProcessorService', 'aiOperationManager', 'generatorFactory'] // Dependencies array
        );

        console.log('🦇 File services registered successfully');
    } catch (error) {
        console.error('🦇 Failed to register file services:', error);
        throw error;
    }
}