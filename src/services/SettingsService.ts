import { Plugin } from 'obsidian';
import { CoreService } from './core/CoreService';
import { ServiceError } from './core/ServiceError';
import { PluginSettings, KnowledgeBloomSettings } from '../settings/Settings';
import { SettingsStateManager } from '../managers/SettingsStateManager';
import { 
    SettingsEventMap, 
    NestedSettingKey,
    NestedSettingValue,
    ISettingsHandler
} from '../types/SettingsTypes';

export class SettingsService extends CoreService implements ISettingsHandler {
    private readonly stateManager: SettingsStateManager;

    constructor(plugin: Plugin) {
        super('settings-service', 'Settings Service');
        this.stateManager = new SettingsStateManager(plugin);
    }

    protected async initializeInternal(): Promise<void> {
        try {
            await this.stateManager.initialize();
        } catch (error) {
            throw new ServiceError(
                this.serviceName,
                'Failed to initialize settings',
                error instanceof Error ? error : undefined
            );
        }
    }

    protected async destroyInternal(): Promise<void> {
        await this.stateManager.destroy();
    }

    public getSettings(): PluginSettings {
        return this.stateManager.getSettings();
    }

    public getSettingSection<K extends keyof PluginSettings>(
        section: K
    ): PluginSettings[K] {
        return this.stateManager.getSettingSection(section);
    }

    public getNestedSetting<
        K extends keyof PluginSettings,
        N extends NestedSettingKey<K>
    >(section: K, key: N): NestedSettingValue<K, N> {
        return this.stateManager.getNestedSetting(section, key);
    }

    public async updateNestedSetting<
        K extends keyof PluginSettings,
        N extends NestedSettingKey<K>
    >(
        section: K,
        key: N,
        value: NestedSettingValue<K, N>
    ): Promise<void> {
        await this.stateManager.updateNestedSetting(section, key, value);
    }

    /**
     * Update specific Knowledge Bloom settings
     */
    public async updateKnowledgeBloomSettings(
        settings: Partial<KnowledgeBloomSettings>
    ): Promise<void> {
        const currentSettings = this.getSettings();
        const updatedSettings = {
            ...currentSettings,
            knowledgeBloom: {
                ...currentSettings.knowledgeBloom,
                ...settings
            }
        };
        await this.stateManager.saveSettings;
    }

    /**
     * Update plugin settings
     */
    public async updateSettings(settings: Partial<PluginSettings>): Promise<void> {
        const currentSettings = this.getSettings();
        const updatedSettings = {
            ...currentSettings,
            ...settings
        };
        await this.stateManager.saveSettings;
    }

    public on<K extends keyof SettingsEventMap>(
        event: K,
        listener: SettingsEventMap[K]
    ): void {
        this.stateManager.on(event, listener);
    }
}