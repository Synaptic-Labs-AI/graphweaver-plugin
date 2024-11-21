import type { Plugin } from 'obsidian';
import type { 
    StoreRegistry,
    StoreId,
    StoreInitializationData,
    StoreInitConfig,
    BaseStore
} from '@type/store.types';
import type { PluginSettings } from '@type/settings.types';

import { pluginStore } from '@stores/PluginStore';
import { 
    initializeSettingsStore as initSettingsStoreInstance, 
    settingsStore 
} from '@stores/SettingStore';
import { processingStore } from '@stores/ProcessingStore';
import { uiStore } from '@stores/UIStore';
import { aiStore } from '@stores/AIStore';
import { ServiceError } from '@services/core/ServiceError';

/**
 * Type guard to check if store has initialize method
 */
function hasInitialize(store: unknown): store is BaseStore<unknown> {
    return typeof (store as any)?.initialize === 'function';
}

/**
 * Type guard to check if store has isReady method
 */
function hasIsReady(store: unknown): store is { isReady: () => boolean } {
    return typeof (store as any)?.isReady === 'function';
}

/**
 * Store initialization sequence configuration
 */
interface StoreInitSequence {
    store: StoreRegistry[StoreId];
    id: StoreId;
    dependencies: StoreId[];
}

/**
 * Check if store dependencies are ready
 */
function checkDependencies(store: StoreRegistry[StoreId], dependencies: StoreId[]): boolean {
    return dependencies.every(depId => {
        const depStore = getStore(depId);
        return !hasIsReady(depStore) || depStore.isReady();
    });
}

/**
 * Validate and get initialization data for a store
 */
function getInitData<T>(id: StoreId, data?: StoreInitConfig): Partial<T> {
    if (!data) return {};
    if (id === 'plugin') return {};
    return (data[id as keyof StoreInitConfig] ?? {}) as Partial<T>;
}

/**
 * Initialize plugin store
 */
async function initializePluginStore(plugin: Plugin): Promise<void> {
    console.log('🦇 [StoreRegistrations] Initializing plugin store...');
    await pluginStore.initialize();
    pluginStore.update(state => ({ ...state, plugin }));
}

/**
 * Initialize settings store with configuration
 */
async function initSettingsStore(plugin: Plugin, data?: StoreInitConfig): Promise<void> {
    console.log('🦇 [StoreRegistrations] Initializing settings store...');
    
    // Initialize the store with plugin instance
    initSettingsStoreInstance(plugin);
    
    // Initialize with empty state first
    await settingsStore.initialize();
    
    // Then update with any persisted settings
    const settingsData = getInitData<PluginSettings>('settings', data);
    if (Object.keys(settingsData).length > 0) {
        await settingsStore.save({
            ...settingsStore.getSnapshot(),
            ...settingsData
        });
    }
}

/**
 * Initialize a single store
 */
async function initializeStore(
    sequence: StoreInitSequence,
    data?: StoreInitConfig
): Promise<void> {
    const { store, id, dependencies } = sequence;

    if (!hasInitialize(store)) {
        throw new Error(`Store ${id} missing initialize method`);
    }

    if (!checkDependencies(store, dependencies)) {
        throw new Error(`Dependencies not ready for ${id} store`);
    }

    console.log(`🦇 [StoreRegistrations] Initializing ${id} store...`);
    await store.initialize(getInitData(id, data));
    console.log(`🦇 [StoreRegistrations] Initialized ${id} store`);
}

/**
 * Initialize all stores
 */
export async function initializeStores(config: StoreInitializationData): Promise<void> {
    try {
        // Initialize core stores first
        await initializePluginStore(config.plugin);
        await initSettingsStore(config.plugin, config.data);

        // Define remaining store initialization sequence
        const initSequence: StoreInitSequence[] = [
            { store: aiStore, id: 'ai', dependencies: ['settings'] },
            { store: processingStore, id: 'processing', dependencies: ['plugin'] },
            { store: uiStore, id: 'ui', dependencies: [] }
        ];

        // Initialize remaining stores in sequence
        for (const sequence of initSequence) {
            try {
                await initializeStore(sequence, config.data);
            } catch (error) {
                throw new ServiceError(
                    'StoreRegistrations',
                    `Failed to initialize ${sequence.id} store`,
                    error instanceof Error ? error : undefined
                );
            }
        }

    } catch (error) {
        console.error('🦇 [StoreRegistrations] Store initialization failed:', error);
        throw error instanceof ServiceError ? error : 
            new ServiceError('StoreRegistrations', 'Store initialization failed', error as Error);
    }
}

/**
 * Reset all stores to initial state
 */
export async function resetStores(): Promise<void> {
    const stores: Array<[StoreId, StoreRegistry[StoreId]]> = [
        ['ui', uiStore],
        ['processing', processingStore],
        ['ai', aiStore],
        ['settings', settingsStore],
        ['plugin', pluginStore]
    ];

    for (const [id, store] of stores) {
        try {
            if ('reset' in store) {
                await store.reset();
                console.log(`🦇 [StoreRegistrations] Reset ${id} store`);
            }
        } catch (error) {
            console.error(`🦇 [StoreRegistrations] Failed to reset ${id} store:`, error);
        }
    }
}

/**
 * Get store by ID
 */
export function getStore<T extends StoreId>(id: T): StoreRegistry[T] {
    const stores: StoreRegistry = {
        plugin: pluginStore,
        settings: settingsStore,
        processing: processingStore,
        ui: uiStore,
        ai: aiStore
    };

    const store = stores[id];
    if (!store) {
        throw new ServiceError('StoreRegistrations', `Unknown store: ${id}`);
    }

    return store;
}

/**
 * Check if all stores are initialized and ready
 */
export function areStoresReady(): boolean {
    const storeIds: StoreId[] = ['plugin', 'settings', 'processing', 'ui', 'ai'];
    return storeIds.every(id => {
        const store = getStore(id);
        return !hasIsReady(store) || store.isReady();
    });
}