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
        modelConfigs: Record<string, {
            temperature: number;
            maxTokens: number;
        }>;
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
        },
        modelConfigs: {}
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