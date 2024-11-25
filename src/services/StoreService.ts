// src/services/StoreService.ts

import { IService } from './core/IService';
import { LifecycleState } from '@type/base.types';import type { Plugin } from 'obsidian';
import { 
    pluginStore,
    aiStore,
    processingStore,
    uiStore
} from '@stores/index';
import { ServiceRegistry } from '@registrations/ServiceRegistrations';
import { SettingsService } from '@services/SettingsService';
import { ServiceError } from '@services/core/ServiceError';
import { settingsStore, initializeSettingsStore } from '@stores/SettingStore';
import { PluginState } from '@type/store.types';

/**
 * StoreService manages all application stores
 * Implements the IService interface for consistency
 */
export class StoreService implements IService {
    public readonly serviceId = 'store-service';
    public readonly serviceName = 'Store Service';

    private stores: {
        plugin: typeof pluginStore;
        settings?: typeof settingsStore;
        ai: typeof aiStore;
        processing: typeof processingStore;
        ui: typeof uiStore;
    };

    /**
     * Constructor initializes non-dependent stores
     */
    constructor(private plugin: Plugin) {
        this.stores = {
            plugin: pluginStore,
            ai: aiStore,
            processing: processingStore,
            ui: uiStore
        };
    }

    /**
     * Initialize all stores
     * This should be called after ServiceRegistry is initialized
     */
    public async initialize(): Promise<void> {
        try {
            // Initialize plugin store
            console.log('🦇 [StoreService] Initializing plugin store...');
            await this.stores.plugin.initialize();
            this.stores.plugin.update((state: PluginState) => ({ 
                ...state, 
                plugin: this.plugin 
            }));
            console.log('🦇 [StoreService] Plugin store initialized');

            // Initialize settings store using ServiceRegistry
            console.log('🦇 [StoreService] Initializing settings store...');
            const settingsService = ServiceRegistry.getInstance().getService('settingsService') as SettingsService;
            if (!settingsService) {
                throw new ServiceError(
                    'StoreService',
                    'SettingsService not available in ServiceRegistry'
                );
            }
            initializeSettingsStore(this.plugin);
            this.stores.settings = settingsStore;
            await this.stores.settings.initialize();
            console.log('🦇 [StoreService] Settings store initialized');

            // Initialize AI store
            console.log('🦇 [StoreService] Initializing AI store...');
            await this.stores.ai.initialize({});
            console.log('🦇 [StoreService] AI store initialized');

            // Initialize Processing store
            console.log('🦇 [StoreService] Initializing Processing store...');
            await this.stores.processing.initialize();
            console.log('🦇 [StoreService] Processing store initialized');

            // Initialize UI store
            console.log('🦇 [StoreService] Initializing UI store...');
            await this.stores.ui.initialize();
            console.log('🦇 [StoreService] UI store initialized');
        } catch (error) {
            console.error('🦇 [StoreService] Failed to initialize stores:', error);
            throw error instanceof ServiceError ? error :
                new ServiceError('StoreService', 'Failed to initialize stores', error as Error);
        }
    }

    /**
     * Clean up resources
     * This should be called during plugin unload
     */
    public async destroy(): Promise<void> {
        try {
            console.log('🦇 [StoreService] Cleaning up stores...');
            
            // Reset all stores to initial state
            await this.stores.plugin.reset();
            await this.stores.settings?.reset();
            await this.stores.ai.reset();
            await this.stores.processing.reset();
            await this.stores.ui.reset();

            console.log('🦇 [StoreService] Stores cleaned up successfully');
        } catch (error) {
            console.error('🦇 [StoreService] Failed to clean up stores:', error);
        }
    }

    /**
     * Get all initialized stores
     */
    public getStores() {
        return this.stores;
    }

    /**
     * Check if all stores are ready
     */
    public isReady(): boolean {
        return !!this.stores.settings && 
               !!this.stores.plugin && 
               !!this.stores.ai && 
               !!this.stores.processing && 
               !!this.stores.ui;
    }

    /**
     * Get the current state
     */
    public getState() {
        return {
            state: this.isReady() ? LifecycleState.Ready : LifecycleState.Initializing,
            error: null
        };
    }
}
