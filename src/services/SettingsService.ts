import { Plugin } from 'obsidian';
import { CoreService } from './core/CoreService';
import { ServiceError } from './core/ServiceError';
import type { 
    PluginSettings, 
    KnowledgeBloomSettings,
    SettingsEventMap,
    NestedSettingKey,
    NestedSettingValue,
    ISettingsHandler
} from '@type/settings.types';
import { settingsStore } from '@stores/SettingStore';
import { TypedEventEmitter } from '@type/events.types';

/**
 * Service for managing plugin settings
 */
export class SettingsService extends CoreService implements ISettingsHandler {
    private eventEmitter: TypedEventEmitter<SettingsEventMap>;

    constructor(private plugin: Plugin) {
        super('settings-service', 'Settings Service');
        this.eventEmitter = new TypedEventEmitter();
    }

    /**
     * Initialize settings service
     */
    protected async initializeInternal(): Promise<void> {
        try {
            // Initialize settings store
            await settingsStore.initialize();
            
            // Subscribe to store changes
            settingsStore.subscribe(settings => {
                this.eventEmitter.emit('settingsChanged', settings);
            });
        } catch (error) {
            throw new ServiceError(
                this.serviceName,
                'Failed to initialize settings',
                error instanceof Error ? error : undefined
            );
        }
    }

    /**
     * Clean up service resources
     */
    protected async destroyInternal(): Promise<void> {
        // No cleanup needed for settings service
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