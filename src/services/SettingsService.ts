import { PluginSettings, DEFAULT_SETTINGS, KnowledgeBloomSettings } from "../settings/Settings";
import { EventEmitter } from "events";
import { Plugin } from "obsidian";
import { AIProvider } from "../models/AIModels";
import { Tag } from "../models/PropertyTag";
import { JsonValidationService } from "./JsonValidationService";

type SettingsKey = keyof PluginSettings;
type NestedSettingsKey<T extends SettingsKey> = keyof PluginSettings[T];

type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export class SettingsService {
    public settings: PluginSettings;
    public emitter: EventEmitter;
    public plugin: Plugin;
    public jsonValidationService: JsonValidationService;

    constructor(plugin: Plugin, initialSettings: PluginSettings) {
        this.plugin = plugin;
        this.settings = initialSettings;
        this.emitter = new EventEmitter();
        this.jsonValidationService = new JsonValidationService(); // Initialize JsonValidationService
    }

    public async loadSettings(): Promise<void> {
        const data = await this.plugin.loadData();
        this.settings = this.deepMerge(DEFAULT_SETTINGS, data as DeepPartial<PluginSettings>);
    }

    public getSettings(): PluginSettings {
        return this.settings;
    }

    public getSetting<K extends SettingsKey>(key: K): PluginSettings[K] {
        return this.settings[key];
    }

    public getNestedSetting<K extends SettingsKey, NK extends NestedSettingsKey<K>>(
        key: K,
        nestedKey: NK
    ): PluginSettings[K][NK] {
        return this.settings[key][nestedKey];
    }

    public async updateSettings(newSettings: DeepPartial<PluginSettings>): Promise<void> {
        this.settings = this.deepMerge(this.settings, newSettings);
        await this.saveSettings();
        this.emitter.emit('settingsChanged', this.settings);
    }

    public async updateSetting<K extends SettingsKey>(
        key: K,
        value: PluginSettings[K]
    ): Promise<void> {
        this.settings[key] = value;
        await this.saveSettings();
        this.emitter.emit('settingsChanged', { [key]: value });
    }

    public async updateNestedSetting<K extends SettingsKey, NK extends NestedSettingsKey<K>>(
        key: K,
        nestedKey: NK,
        value: PluginSettings[K][NK]
    ): Promise<void> {
        this.settings[key][nestedKey] = value;
        await this.saveSettings();
        this.emitter.emit('settingsChanged', { [key]: { [nestedKey]: value } });
    }

    public async updateAIProviderSettings(
        provider: AIProvider,
        settings: DeepPartial<PluginSettings['aiProvider']>
    ): Promise<void> {
        this.settings.aiProvider = this.deepMerge(this.settings.aiProvider, settings);
        await this.saveSettings();
        this.emitter.emit('settingsChanged', { aiProvider: this.settings.aiProvider });
    }

    public getAIProviderSettings(): PluginSettings['aiProvider'] {
        return this.settings.aiProvider;
    }

    public async updateLocalLMStudioSettings(
        settings: DeepPartial<PluginSettings['localLMStudio']>
    ): Promise<void> {
        this.settings.localLMStudio = this.deepMerge(this.settings.localLMStudio, settings);
        await this.saveSettings();
        this.emitter.emit('settingsChanged', { localLMStudio: this.settings.localLMStudio });
    }

    public getLocalLMStudioSettings(): PluginSettings['localLMStudio'] {
        return this.settings.localLMStudio;
    }

    public getKnowledgeBloomSettings(): KnowledgeBloomSettings {
        return this.settings.knowledgeBloom;
    }

    public async updateKnowledgeBloomSettings(
        settings: DeepPartial<KnowledgeBloomSettings>
    ): Promise<void> {
        this.settings.knowledgeBloom = this.deepMerge(this.settings.knowledgeBloom, settings);
        await this.saveSettings();
        this.emitter.emit('settingsChanged', { knowledgeBloom: this.settings.knowledgeBloom });
    }

    public async updateKnowledgeBloomSetting<K extends keyof KnowledgeBloomSettings>(
        key: K,
        value: KnowledgeBloomSettings[K]
    ): Promise<void> {
        this.settings.knowledgeBloom[key] = value;
        await this.saveSettings();
        this.emitter.emit('settingsChanged', { knowledgeBloom: { [key]: value } });
    }

    public async updateTags(newTags: Tag[]): Promise<void> {
        const existingTags = this.settings.tags.customTags || [];
        const mergedTags = [...existingTags];

        for (const newTag of newTags) {
            const existingIndex = mergedTags.findIndex(t => t.name === newTag.name);
            if (existingIndex !== -1) {
                mergedTags[existingIndex] = { ...mergedTags[existingIndex], ...newTag };
            } else {
                mergedTags.push(newTag);
            }
        }

        this.settings.tags.customTags = mergedTags;
        await this.saveSettings();
        this.emitter.emit('settingsChanged', { tags: { customTags: mergedTags } });
    }

    public async resetToDefault(): Promise<void> {
        this.settings = { ...DEFAULT_SETTINGS };
        await this.saveSettings();
        this.emitter.emit('settingsReset');
    }

    public onSettingsChanged(listener: (settings: Partial<PluginSettings>) => void): void {
        this.emitter.on('settingsChanged', listener);
    }

    public onSettingsReset(listener: () => void): void {
        this.emitter.on('settingsReset', listener);
    }

    public async saveSettings(): Promise<void> {
        await this.plugin.saveData(this.settings);
    }

    public deepMerge<T>(target: T, source: DeepPartial<T>): T {
        if (!this.isObject(target) || !this.isObject(source)) {
            return source as T;
        }
    
        const output = { ...target };
        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                if (this.isObject(source[key]) && this.isObject((target as any)[key])) {
                    (output as any)[key] = this.deepMerge(
                        (target as any)[key],
                        source[key] as DeepPartial<T[keyof T]>
                    );
                } else if (source[key] !== undefined) {
                    (output as any)[key] = source[key];
                }
            }
        }
        return output;
    }
    
    public isObject(item: unknown): item is Record<string, unknown> {
        return item !== null && typeof item === 'object' && !Array.isArray(item);
    }

    // Getter for JsonValidationService
    public getJsonValidationService(): JsonValidationService {
        return this.jsonValidationService;
    }
}
