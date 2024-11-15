// src/managers/InitializationManager.ts

import { Plugin, App } from 'obsidian';
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

        } catch (error) {
            this.errorManager.handleError('Initialization failed:', error);
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
