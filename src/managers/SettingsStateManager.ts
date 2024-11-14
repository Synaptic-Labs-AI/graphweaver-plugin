import { Plugin } from 'obsidian';
import { PluginSettings, DEFAULT_SETTINGS } from '../settings/Settings';
import { TypedEventEmitter } from '../services/core/TypedEventEmitter';
import { 
    SettingsEventMap,
    NestedSettingKey,
    NestedSettingValue,
    ISettingsHandler
} from '../types/SettingsTypes';

/**
 * Manages the plugin settings state and related operations
 */
export class SettingsStateManager implements ISettingsHandler {
    private settings: PluginSettings;
    private readonly eventEmitter: TypedEventEmitter<SettingsEventMap>;
    private readonly plugin: Plugin;

    constructor(plugin: Plugin) {
        this.plugin = plugin;
        this.settings = { ...DEFAULT_SETTINGS };
        this.eventEmitter = new TypedEventEmitter();
    }

    public async initialize(): Promise<void> {
        // Load settings through Obsidian's data API
        const loadedData = await this.plugin.loadData();
        if (loadedData) {
            // Merge loaded data with defaults to ensure type safety
            this.settings = {
                ...DEFAULT_SETTINGS,
                ...loadedData
            };
            this.emit('settingsChanged', this.settings);
        } else {
            // Use defaults if no data exists
            this.settings = { ...DEFAULT_SETTINGS };
        }
    }

    public getSettings(): PluginSettings {
        return { ...this.settings };
    }

    public getSettingSection<K extends keyof PluginSettings>(
        section: K
    ): PluginSettings[K] {
        return { ...this.settings[section] };
    }

    public getNestedSetting<
        K extends keyof PluginSettings,
        N extends NestedSettingKey<K>
    >(section: K, key: N): NestedSettingValue<K, N> {
        return this.settings[section][key];
    }

    public async updateNestedSetting<
        K extends keyof PluginSettings,
        N extends NestedSettingKey<K>
    >(
        section: K,
        key: N,
        value: NestedSettingValue<K, N>
    ): Promise<void> {
        this.settings[section] = {
            ...this.settings[section],
            [key]: value
        };
        
        await this.saveSettings();
        this.emit('settingsChanged', { [section]: this.settings[section] });
    }

    public async saveSettings(): Promise<void> {
        try {
            await this.plugin.saveData(this.settings);
        } catch (error) {
            const serviceError = error instanceof Error ? error : new Error('Unknown error');
            this.emit('persistenceError', serviceError);
            throw serviceError;
        }
    }

    public on<K extends keyof SettingsEventMap>(
        event: K,
        listener: SettingsEventMap[K]
    ): void {
        this.eventEmitter.on(event, listener);
    }

    private emit<K extends keyof SettingsEventMap>(
        event: K,
        ...args: Parameters<SettingsEventMap[K]>
    ): void {
        this.eventEmitter.emit(event, ...args);
    }

    public async resetToDefault(): Promise<void> {
        this.settings = { ...DEFAULT_SETTINGS };
        await this.saveSettings();
        this.emit('settingsReset');
    }

    public async destroy(): Promise<void> {
        this.eventEmitter.removeAllListeners();
    }
}