// src/managers/InitializationManager.ts

import { Plugin, Notice, App } from 'obsidian';
import { ServiceManager } from './ServiceManager';
import { ErrorManager } from './ErrorManager';

/**
 * Manages the plugin initialization sequence
 */
export class InitializationManager {
    constructor(
        private plugin: Plugin,
        private app: App,
        private serviceManager: ServiceManager,
        private errorManager: ErrorManager
    ) {}

    /**
     * Handle the complete initialization sequence
     */
    public async initialize(): Promise<void> {
        try {
            // Initialize all registered services
            await this.serviceManager.initializeServices();

            console.log('Initialization completed successfully');
            new Notice('GraphWeaver Plugin Initialized Successfully!');
        } catch (error) {
            this.errorManager.handleError('Initialization failed:', error);
            new Notice('GraphWeaver Plugin failed to initialize. Check console for details.');
            throw error;
        }
    }

    /**
     * Get initialization state
     */
    public getState(): {
        servicesRegistered: boolean;
        servicesInitialized: boolean;
        error?: Error;
    } {
        return {
            servicesRegistered: this.serviceManager.hasRegisteredServices(),
            servicesInitialized: this.serviceManager.isReady(),
            error: this.serviceManager.getState().error || undefined
        };
    }
}
