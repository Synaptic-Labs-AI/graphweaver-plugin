// src/settings/Settings.ts

import { AIProvider } from "../models/AIModels";
import { PropertyTag, Tag } from "../models/PropertyTag";

export interface KnowledgeBloomSettings {
    outputFolder: string;
    overwriteExisting: boolean;
    defaultPrompt: string;
    selectedModel: string; // Add this line
}

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
        customProperties: [],
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
        delayBetweenChunks: 1000,  // Added with default value
        maxRetries: 3,             // Added with default value
        maxConcurrentProcessing: 3  // Added with default value
    },
    ontology: {
        lastGenerated: ''
    },
    knowledgeBloom: {
        selectedModel: 'string',
        outputFolder: '',
        overwriteExisting: false,
        defaultPrompt: 'Generate a comprehensive note about {LINK}. Include key concepts, definitions, and relevant examples if applicable.'
    }
};
