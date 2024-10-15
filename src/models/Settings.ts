import { AIProvider } from "./AIModels";
import { PropertyTag, Tag } from "./PropertyTag";

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
    };
    ontology: {
        lastGenerated: string;
    };
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
        maxLinksPerNote: 10
    },
    ontology: {
        lastGenerated: ''
    }
};