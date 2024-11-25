import { Plugin } from 'obsidian';
import { CoreService } from './core/CoreService';
import { ServiceError } from './core/ServiceError';
import type { 
    PluginSettings,
    SettingsEventMap,
    NestedSettingKey,
    NestedSettingValue,
    ISettingsHandler
} from '@type/settings.types';
import { KnowledgeBloomSettings } from '@type/ai.types';
import { settingsStore, initializeSettingsStore } from '@stores/SettingStore';
import { TypedEventEmitter } from '@type/events.types';

/**
 * Service for managing plugin settings
 */
export class SettingsService extends CoreService implements ISettingsHandler {
    private eventEmitter: TypedEventEmitter<SettingsEventMap>;
    private isInitialized = false;

    constructor(private plugin: Plugin) {
        super('settings-service', 'Settings Service');
        this.eventEmitter = new TypedEventEmitter();
    }

    /**
     * Initialize settings service
     */
    protected async initializeInternal(): Promise<void> {
        try {
            if (this.isInitialized) {
                return;
            }

            if (!this.plugin) {
                throw new ServiceError(
                    this.serviceName,
                    'Plugin instance not provided'
                );
            }

            // Initialize settings store with proper error handling
            try {
                initializeSettingsStore(this.plugin);
                await settingsStore.initialize();
            } catch (error) {
                throw ServiceError.from(
                    this.serviceName,
                    error,
                    { context: 'Settings store initialization failed' }
                );
            }
            
            // Subscribe to store changes with error handling
            try {
                settingsStore.subscribe(settings => {
                    this.eventEmitter.emit('settingsChanged', settings);
                });
            } catch (error) {
                throw ServiceError.from(
                    this.serviceName,
                    error,
                    { context: 'Failed to subscribe to settings changes' }
                );
            }

            this.isInitialized = true;
            console.log('🦇 [SettingsService] Initialized successfully');
        } catch (error) {
            console.error('🦇 [SettingsService] Initialization failed:', error);
            throw ServiceError.from(
                this.serviceName,
                error,
                { context: 'Service initialization failed' }
            );
        }
    }

    /**
     * Clean up service resources
     */
    protected async destroyInternal(): Promise<void> {
        try {
            await settingsStore.destroy();
            this.eventEmitter.removeAllListeners();
            this.isInitialized = false;
        } catch (error) {
            console.error('🦇 [SettingsService] Cleanup failed:', error);
        }
    }

    /**
     * Get full settings object
     */
    public getSettings(): PluginSettings {
        return settingsStore.getSnapshot();
    }

    /**
     * Get specific settings section
     */
    public getSettingSection<K extends keyof PluginSettings>(
        section: K
    ): PluginSettings[K] {
        return settingsStore.getSettingSection(section);
    }

    /**
     * Get nested setting value
     */
    public getNestedSetting<
        K extends keyof PluginSettings,
        N extends NestedSettingKey<K>
    >(section: K, key: N): NestedSettingValue<K, N> {
        return settingsStore.getNestedSetting(section, key);
    }

    /**
     * Update nested setting with proper typing
     */
    public async updateNestedSetting<
        K extends keyof PluginSettings,
        N extends NestedSettingKey<K>
    >(
        section: K,
        key: N,
        value: NestedSettingValue<K, N>
    ): Promise<void> {
        await settingsStore.updateNestedSetting(section, key, value);
    }

    /**
     * Update specific Knowledge Bloom settings
     */
    public async updateKnowledgeBloomSettings(
        settings: Partial<KnowledgeBloomSettings>
    ): Promise<void> {
        const currentSettings = settingsStore.getSnapshot();
        await settingsStore.save({
            ...currentSettings,
            knowledgeBloom: {
                ...currentSettings.knowledgeBloom,
                ...settings
            }
        });
    }

    /**
     * Update plugin settings
     */
    public async updateSettings(settings: Partial<PluginSettings>): Promise<void> {
        const currentSettings = settingsStore.getSnapshot();
        await settingsStore.save({
            ...currentSettings,
            ...settings
        });
    }

    /**
     * Register event listener
     */
    public on<K extends keyof SettingsEventMap>(
        event: K,
        listener: SettingsEventMap[K]
    ): void {
        this.eventEmitter.on(event, listener);
    }

    /**
     * Remove event listener
     */
    public off<K extends keyof SettingsEventMap>(
        event: K,
        listener: SettingsEventMap[K]
    ): void {
        this.eventEmitter.off(event, listener);
    }
}