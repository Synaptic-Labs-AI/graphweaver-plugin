import { PluginSettings, DEFAULT_SETTINGS, KnowledgeBloomSettings } from "../settings/Settings";
import { Plugin } from "obsidian";
import { AIProvider } from "../models/AIModels";
import { Tag, PropertyTag } from "../models/PropertyTag";
import { JsonValidationService } from "./JsonValidationService";
import { BaseService, DeepPartial } from './BaseService'; 

type SettingsKey = keyof PluginSettings;
type NestedSettingsKey<T extends SettingsKey> = keyof PluginSettings[T];

export type AIProviderKeys = 'selected' | 'apiKeys' | 'selectedModels' | 'modelConfigs';
export type FrontMatterKeys = 'customProperties' | 'autoGenerate';
export type LocalLMStudioKeys = 'enabled' | 'port' | 'modelName';
export type OntologyKeys = 'lastGenerated';
export type KnowledgeBloomKeys = 'outputFolder' | 'overwriteExisting' | 'defaultPrompt' | 'selectedModel';

export type SettingSections = {
    aiProvider: AIProviderKeys;
    frontMatter: FrontMatterKeys;
    localLMStudio: LocalLMStudioKeys;
    ontology: OntologyKeys;
    knowledgeBloom: KnowledgeBloomKeys;
};

// Remove DeepPartial type definition since it's now in BaseService

export class SettingsService extends BaseService {
    public settings: PluginSettings;
    public plugin: Plugin;
    public jsonValidationService: JsonValidationService;

    constructor(plugin: Plugin, initialSettings: PluginSettings) {
        super();
        this.plugin = plugin;
        this.settings = initialSettings;
        this.jsonValidationService = new JsonValidationService();
    }

    public async loadSettings(): Promise<void> {
        const data = await this.plugin.loadData();
        const mergedSettings = this.deepMerge(DEFAULT_SETTINGS, data || {});
        // Ensure required properties are set
        this.settings = {
            ...mergedSettings,
            aiProvider: {
                ...mergedSettings.aiProvider,
                selected: mergedSettings.aiProvider?.selected || DEFAULT_SETTINGS.aiProvider.selected
            }
        };
    }

    public getSettings(): PluginSettings {
        // Ensure customProperties is always returned as an array
        const settings = { ...this.settings };
        if (settings.frontMatter?.customProperties) {
            const props = settings.frontMatter.customProperties;
            settings.frontMatter.customProperties = Array.isArray(props) ? props :
                Object.values(props).filter(v => v && typeof v === 'object' && 'name' in v) as PropertyTag[];
        }
        return settings;
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
        const mergedSettings = this.deepMerge(this.settings, newSettings);
        // Ensure required properties are maintained
        this.settings = {
            ...mergedSettings,
            aiProvider: {
                ...mergedSettings.aiProvider,
                selected: mergedSettings.aiProvider?.selected || this.settings.aiProvider.selected
            }
        };
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
        if (key === 'frontMatter' && nestedKey === 'customProperties') {
            // Replace the customProperties array instead of merging
            this.settings[key] = {
                ...this.settings[key],
                [nestedKey]: Array.isArray(value) ? value : [value]
            };
        } else if (Array.isArray(this.settings[key][nestedKey])) {
            // Handle other array types
            const currentArray = this.settings[key][nestedKey] as unknown;
            const valueAsArray = Array.isArray(value) ? value : [value];
            this.settings[key] = {
                ...this.settings[key],
                [nestedKey]: [...(currentArray as unknown[]), ...valueAsArray]
            };
        } else {
            // Handle non-array values
            this.settings[key] = {
                ...this.settings[key],
                [nestedKey]: value
            };
        }

        await this.saveSettings();
        this.emitter.emit('settingsChanged', {
            [key]: { [nestedKey]: this.settings[key][nestedKey] }
        });
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
        try {
            await this.plugin.saveData(this.settings);
        } catch (error) {
            console.error('Failed to save settings:', error);
            throw error;
        }
    }

    // Getter for JsonValidationService
    public getJsonValidationService(): JsonValidationService {
        return this.jsonValidationService;
    }
}