src/
├── adapters/
│   ├── AnthropicAdapter.ts        [EDIT - Add store consumption]
│   ├── GeminiAdapter.ts           [EDIT - Add store consumption]
│   ├── GroqAdapter.ts             [EDIT - Add store consumption]
│   ├── LMStudioAdapter.ts         [EDIT - Add store consumption]
│   ├── OpenAIAdapter.ts           [EDIT - Add store consumption]
│   └── OpenRouterAdapter.ts       [EDIT - Add store consumption]
├── components/
│   ├── accordions/
│   │   ├── AdvancedAccordion.svelte           [EDIT - Use stores]
│   │   ├── BaseAccordion.svelte               [EDIT - Use stores]
│   │   ├── BatchProcessorAccordion.svelte     [EDIT - Use stores]
│   │   ├── KnowledgeBloomAccordion.svelte     [EDIT - Use stores]
│   │   ├── ModelHookupAccordion.svelte        [EDIT - Use stores]
│   │   ├── OntologyGenerationAccordion.svelte [EDIT - Use stores]
│   │   ├── PropertyManagerAccordion.svelte    [EDIT - Use stores]
│   │   └── TagManagerAccordion.svelte         [EDIT - Use stores]
│   ├── modals/
│   │   ├── BatchProcessorModal.svelte         [EDIT - Use stores]
│   │   ├── EditPropertiesModal.svelte         [EDIT - Use stores]
│   │   ├── EditTagsModal.svelte               [EDIT - Use stores]
│   │   ├── OntologyGeneratorModal.svelte      [EDIT - Use stores]
│   │   ├── StatusHistoryModal.svelte          [EDIT - Use stores]
│   │   └── StatusHistoryModal.ts              [DELETE - Merge into .svelte]
│   └── status/
│       └── ProcessingStatusBar.ts             [EDIT - Convert to .svelte]
├── generators/
│   └── [All files]                           [EDIT - Minor store integration]
├── managers/
│   ├── startup/                              [DELETE - Move to services]
│   ├── DatabaseManager.ts                    [DELETE - Move to services]
│   ├── ErrorManager.ts                       [EDIT - Minor updates]
│   ├── EventManager.ts                       [EDIT - Minor updates]
│   ├── FileManager.ts                        [EDIT - Use stores]
│   ├── InitializationManager.ts              [DELETE - Move to services]
│   ├── ServiceManager.ts                     [DELETE - Use ServiceRegistry]
│   ├── SettingsStateManager.ts               [DELETE - Replace with store]
│   ├── StateManager.ts                       [DELETE - Replace with stores]
│   └── UIManager.ts                          [EDIT - Use stores]
├── models/
│   ├── AIModels.ts                          [EDIT - Minor updates]
│   ├── OntologyTypes.ts                     [KEEP]
│   └── PropertyTag.ts                       [KEEP]
├── services/
│   ├── ai/                                  [EDIT - Most files need store updates]
│   ├── core/                                [KEEP - Core services remain]
│   ├── file/                                [EDIT - Use stores]
│   └── [Other service files]                [EDIT - Use stores]
├── settings/
│   ├── GraphWeaverSettingTab.ts             [EDIT - Use stores]
│   ├── Settings.ts                          [EDIT - Minor updates]
│   └── SettingsTab.svelte                   [EDIT - Use stores]
├── state/
│   ├── PluginState.ts                       [EDIT - Convert to store types]
│   ├── ServiceState.ts                      [KEEP]
│   └── utils/                               [DELETE - Replace with store utils]
├── stores/ [NEW]
│   ├── index.ts                             [NEW]
│   ├── plugin.ts                            [NEW]
│   ├── settings.ts                          [NEW]
│   ├── ai.ts                                [NEW]
│   ├── processing.ts                        [NEW]
│   ├── ui.ts                                [NEW]
│   └── types/                               [NEW]
│       └── store.types.ts                   [NEW]
├── types/
│   ├── OperationTypes.ts                    [EDIT - Add store types]
│   ├── ProcessingTypes.ts                   [EDIT - Add store types]
│   ├── ServiceTypes.ts                      [EDIT - Add store types]
│   └── SettingsTypes.ts                     [EDIT - Add store types]
├── registrations/ [NEW]
│   ├── index.ts                             [NEW]
│   ├── StoreRegistrations.ts               [NEW]
│   ├── CoreRegistrations.ts                [NEW]
│   ├── AIRegistrations.ts                  [NEW]
│   └── FileRegistrations.ts                [NEW]
└── main.ts                                  [EDIT - Major simplification]


# GraphWeaver Plugin for Obsidian

GraphWeaver is an AI-powered plugin for Obsidian that enhances your note-taking experience by automating metadata generation, creating connections between notes, and helping you build a comprehensive knowledge structure.

## Overview

GraphWeaver leverages advanced AI models to analyze your notes and automatically generate relevant metadata, suggest connections, and help you maintain a consistent ontology across your knowledge base.

## Key Features

1. **AI-Powered Front Matter Generation**: Automatically create and update front matter for your notes based on their content.

2. **Intelligent Wikilink Suggestions**: Get smart suggestions for wikilinks to create connections between your notes.

3. **Custom Ontology Management**: Build and maintain a tailored ontology for your knowledge base.

4. **Batch Processing**: Apply GraphWeaver's features to multiple files at once.

5. **Multi-Provider Support**: Choose from various AI providers including OpenAI, Anthropic, Google, Groq, OpenRouter, and LM Studio.

6. **Customizable Properties and Tags**: Define and manage custom properties and tags for your notes.

## How to Use GraphWeaver

### Generating Front Matter

1. Open a note in Obsidian.
2. Use the command palette (Ctrl/Cmd + P) and search for "GraphWeaver: Generate Front Matter".
3. The plugin will analyze your note and generate appropriate front matter.

### Creating Wikilinks

1. Open a note in Obsidian.
2. Use the command palette and search for "GraphWeaver: Generate Wikilinks".
3. Review and accept the suggested wikilinks.

### Managing Your Ontology

1. Go to GraphWeaver settings in Obsidian.
2. Navigate to the "Ontology Generator" section.
3. Click on "Generate Ontology" to get AI-suggested tags and structures.
4. Review and customize the suggested ontology.

### Batch Processing

1. In GraphWeaver settings, go to the "Batch Processor" section.
2. Select the files you want to process.
3. Choose the operations to perform (e.g., generate front matter, create wikilinks).
4. Click "Run Batch Processor" to apply changes to multiple files.

### Customizing Properties and Tags

1. In GraphWeaver settings, go to "Property Management" or "Tag Management".
2. Add, edit, or remove custom properties and tags.
3. These custom elements will be used in front matter generation and ontology management.

## AI Provider Configuration

GraphWeaver supports multiple AI providers. In the settings:

1. Choose your preferred AI provider.
2. Enter your API key for the selected provider.
3. Configure any provider-specific settings if needed.

## Tips for Effective Use

- Regularly generate ontologies to keep your knowledge base structure up-to-date.
- Use batch processing for consistency across multiple notes.
- Customize properties and tags to fit your specific note-taking needs.
- Experiment with different AI providers to find the best fit for your writing style and needs.

Remember, GraphWeaver is here to enhance your note-taking process. Feel free to adjust its suggestions to better fit your personal knowledge management style.

Update Settings.ts to include Knowledge Bloom settings.
Modify SettingsService.ts to handle the new settings.
Update styles.css to style any new UI components