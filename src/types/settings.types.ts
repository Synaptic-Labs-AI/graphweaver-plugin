// src/types/SettingsTypes.ts

import { AIProvider } from "@type/ai.types";
import { PropertyTag, Tag } from "@type/metadata.types";
import { KnowledgeBloomSettings } from "@type/ai.types";

export interface PluginSettings {
    aiProvider: {
        selected: AIProvider;
        apiKeys: Partial<Record<AIProvider, string>>;
        selectedModels: Partial<Record<AIProvider, string>>;
    };
    frontMatter: {
        customProperties: PropertyTag[];
        autoGenerate: boolean;
    };
    tags: {
        customTags: Tag[];
    };
    localLMStudio: {
        enabled: boolean;
        port: number;
        modelName: string;
    };
    advanced: {
        maxTokens: number;
        temperature: number;
        generateWikilinks: boolean;
        minWordCount: number;
        maxLinksPerNote: number;
        batchSize: number;
        delayBetweenChunks: number;  // Added
        maxRetries: number;          // Added
        maxConcurrentProcessing: number;  // Added
    };
    ontology: {
        lastGenerated: string;
    };
    knowledgeBloom: KnowledgeBloomSettings;
}

export const DEFAULT_SETTINGS: PluginSettings = {
    aiProvider: {
        selected: AIProvider.OpenAI,
        apiKeys: {},
        selectedModels: {
            [AIProvider.OpenAI]: 'gpt-4o-mini'
        }
    },
    frontMatter: {
        customProperties: [], // Initialize as PropertyTag[]
        autoGenerate: false
    },
    tags: {
        customTags: []
    },
    localLMStudio: {
        enabled: false,
        port: 1234,
        modelName: ''
    },
    advanced: {
        maxTokens: 4096,
        temperature: 0.3,
        generateWikilinks: false,
        minWordCount: 5,
        maxLinksPerNote: 10,
        batchSize: 10,
        delayBetweenChunks: 1000,  // Default value
        maxRetries: 3,             // Default value
        maxConcurrentProcessing: 3  // Default value
    },
    ontology: {
        lastGenerated: ''
    },
    knowledgeBloom: {
        selectedModel: 'string',
        defaultPrompt: 'Generate a comprehensive note about {LINK}. Include key concepts, definitions, and relevant examples if applicable.'
    }
};

/**
 * Events that can be emitted by settings service
 */
export interface SettingsEvents {
    settingsChanged: (settings: Partial<PluginSettings>) => void;
    settingChanged: <K extends keyof PluginSettings>(key: K, value: PluginSettings[K]) => void;
    settingsReset: () => void;
    validationError: (error: Error) => void;
    persistenceError: (error: Error) => void;
}

/**
 * Map of settings related events and their handler types
 */
export type SettingsEventMap = {
    [K in keyof SettingsEvents]: SettingsEvents[K]
};

/**
 * Nested settings update helper types
 */
export type NestedSettingKey<K extends keyof PluginSettings> = keyof PluginSettings[K];

export type NestedSettingValue<
    K extends keyof PluginSettings,
    N extends NestedSettingKey<K>
> = PluginSettings[K][N];

/**
 * Settings state handler interface
 */
export interface ISettingsHandler {
    initialize(): Promise<void>;
    destroy(): void;
    getSettings(): PluginSettings;
    getSettingSection<K extends keyof PluginSettings>(section: K): PluginSettings[K];
    getNestedSetting<
        K extends keyof PluginSettings,
        N extends NestedSettingKey<K>
    >(section: K, key: N): NestedSettingValue<K, N>;
    updateNestedSetting<
        K extends keyof PluginSettings,
        N extends NestedSettingKey<K>
    >(section: K, key: N, value: NestedSettingValue<K, N>): Promise<void>;
}
