import { derived } from 'svelte/store';
import type { DerivedSettingsStores } from '@type/store.types';
import { 
    DEFAULT_SETTINGS,
    type PluginSettings,
    type SettingsEventMap,
    type NestedSettingKey,
    type NestedSettingValue,
    type ISettingsHandler
} from '@type/settings.types';
import { createPersistedStore } from './StoreUtils';
import { utils as coreUtils } from './CoreStore';
import type { Plugin } from 'obsidian';
import { EventEmitter } from 'events';

export class SettingsStoreImpl implements ISettingsHandler {
    private static readonly STORAGE_KEY = 'graphweaver-settings';
    private static instance: SettingsStoreImpl | null = null;
    private readonly store;
    private readonly eventEmitter: EventEmitter;
    
    public subscribe;
    public set;
    public update;

    private constructor(private plugin: Plugin) {
        this.eventEmitter = new EventEmitter();
        this.store = createPersistedStore<PluginSettings>(
            SettingsStoreImpl.STORAGE_KEY,
            DEFAULT_SETTINGS,
            this.validateSettings
        );

        this.subscribe = this.store.subscribe;
        this.set = this.store.set;
        this.update = this.store.update;

        // Setup store subscription to handle events
        this.subscribe(settings => {
            this.emit('settingsChanged', settings);
        });
    }

    public static getInstance(plugin: Plugin): SettingsStoreImpl {
        if (!SettingsStoreImpl.instance) {
            SettingsStoreImpl.instance = new SettingsStoreImpl(plugin);
        }
        return SettingsStoreImpl.instance;
    }

    public async initialize(): Promise<void> {
        try {
            const loadedData = await this.plugin.loadData();
            if (loadedData) {
                this.update(current => ({
                    ...DEFAULT_SETTINGS,
                    ...current,
                    ...loadedData
                }));
            }
        } catch (error) {
            coreUtils.reportError('Failed to initialize settings', 'error', { error });
            this.emit('persistenceError', error instanceof Error ? error : new Error('Unknown error'));
            throw error;
        }
    }

    public getSettings(): PluginSettings {
        return this.store.getSnapshot();
    }

    public getSettingSection<K extends keyof PluginSettings>(
        section: K
    ): PluginSettings[K] {
        return { ...this.getSettings()[section] };
    }

    public getNestedSetting<
        K extends keyof PluginSettings,
        N extends NestedSettingKey<K>
    >(section: K, key: N): NestedSettingValue<K, N> {
        return this.getSettings()[section][key];
    }

    public async updateNestedSetting<
        K extends keyof PluginSettings,
        N extends NestedSettingKey<K>
    >(
        section: K,
        key: N,
        value: NestedSettingValue<K, N>
    ): Promise<void> {
        this.update(settings => ({
            ...settings,
            [section]: {
                ...settings[section],
                [key]: value
            }
        }));

        await this.save(this.getSettings());
    }

    public async save(settings: PluginSettings): Promise<void> {
        try {
            if (!this.validateSettings(settings)) {
                throw new Error('Invalid settings configuration');
            }
            await this.plugin.saveData(settings);
            this.set(settings);
        } catch (error) {
            this.emit('persistenceError', error instanceof Error ? error : new Error('Save failed'));
            throw error;
        }
    }

    public updateSetting<K extends keyof PluginSettings>(
        key: K, 
        value: PluginSettings[K]
    ): void {
        this.update(settings => ({
            ...settings,
            [key]: value
        }));
        this.emit('settingChanged', key, value);
    }

    public validateSettings(settings: Partial<PluginSettings>): boolean {
        // Required sections validation
        const requiredSections: (keyof PluginSettings)[] = [
            'aiProvider', 'frontMatter', 'tags', 'localLMStudio',
            'advanced', 'ontology', 'knowledgeBloom'
        ];

        if (!requiredSections.every(section => section in settings)) return false;

        // AI Provider validation
        const { aiProvider } = settings;
        if (!aiProvider?.selected || !aiProvider.apiKeys || !aiProvider.selectedModels) {
            return false;
        }

        // Front Matter validation
        if (settings.frontMatter?.customProperties) {
            const isValidProps = settings.frontMatter.customProperties.every(prop =>
                typeof prop.name === 'string' &&
                typeof prop.description === 'string' &&
                typeof prop.type === 'string' &&
                typeof prop.required === 'boolean' &&
                (!prop.options || Array.isArray(prop.options)) &&
                typeof prop.multipleValues === 'boolean'
            );
            if (!isValidProps) return false;
        }

        return true;
    }

    public reset(): void {
        this.set(DEFAULT_SETTINGS);
    }

    public getSnapshot(): PluginSettings {
        return this.store.getSnapshot();
    }

    public async destroy(): Promise<void> {
        this.eventEmitter.removeAllListeners();
    }

    // Event emitter methods
    private emit<K extends keyof SettingsEventMap>(
        event: K, 
        ...args: Parameters<SettingsEventMap[K]>
    ): void {
        this.eventEmitter.emit(event, ...args);
    }

    public on<K extends keyof SettingsEventMap>(
        event: K,
        listener: SettingsEventMap[K]
    ): void {
        this.eventEmitter.on(event as string, listener);
    }

    public off<K extends keyof SettingsEventMap>(
        event: K,
        listener: SettingsEventMap[K]
    ): void {
        this.eventEmitter.off(event as string, listener);
    }
}

// Export singleton instance
export let settingsStore: SettingsStoreImpl;

export function initializeSettingsStore(plugin: Plugin): void {
    settingsStore = SettingsStoreImpl.getInstance(plugin);
}

export function initializeDerivedStores(): DerivedSettingsStores {
    if (!settingsStore) {
        throw new Error('Settings store not initialized');
    }

    return {
        aiSettings: derived(settingsStore, $s => $s.aiProvider),
        frontMatterSettings: derived(settingsStore, $s => $s.frontMatter),
        advancedSettings: derived(settingsStore, $s => $s.advanced),
        knowledgeBloomSettings: derived(settingsStore, $s => $s.knowledgeBloom),
        settingsStatus: derived(settingsStore, $s => ({
            isValid: settingsStore.validateSettings($s),
            hasApiKey: !!$s.aiProvider.apiKeys[$s.aiProvider.selected],
            isConfigured: settingsStore.validateSettings($s) && 
                         !!$s.aiProvider.apiKeys[$s.aiProvider.selected],
            provider: $s.aiProvider.selected
        }))
    };
}