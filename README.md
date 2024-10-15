src/
├── main.ts
├── services/
│   ├── AIService.ts
│   └── SettingsService.ts
├── generators/
│   ├── BaseGenerator.ts
│   ├── FrontMatterGenerator.ts
│   ├── WikilinkGenerator.ts
│   ├── JsonSchemaGenerator.ts
│   ├── OntologyGenerator.ts
│   └── BatchProcessor.ts
├── adapters/
│   ├── AIAdapter.ts
│   ├── OpenAIAdapter.ts
│   ├── AnthropicAdapter.ts
│   ├── GoogleAdapter.ts
│   ├── GroqAdapter.ts
│   ├── OpenRouterAdapter.ts
│   └── LMStudioAdapter.ts
├── models/
│   ├── AIModels.ts
│   └── Settings.ts
├── components/
│   ├── accordions/
│   │   ├── APIIntegrationAccordion.ts
│   │   ├── PropertyManagerAccordion.ts
│   │   ├── TagManagerAccordion.ts
│   │   ├── OntologyGenerationAccordion.ts
│   │   ├── LocalIntegrationAccordion.ts
│   │   ├── BatchProcessorAccordion.ts
│   │   └── AdvancedAccordion.ts
│   └── modals/
│       ├── EditPropertiesModal.ts
│       ├── EditTagsModal.ts
│       ├── OntologyGeneratorModal.ts
│       └── BatchProcessorModal.ts
└── utils/
    ├── AIAdapterFactory.ts
    └── ErrorTypes.ts

# GraphWeaver File Descriptions

## Main Files

- `main.ts`: The entry point of the plugin. It initializes the plugin, sets up event listeners, and manages the overall plugin lifecycle.

## Services

- `AIService.ts`: Acts as a coordinator for AI-related operations. It manages instances of generators and adapters, delegating tasks to appropriate components.
- `SettingsService.ts`: Manages plugin settings, handling loading, saving, and providing access to configuration options.

## Generators

- `BaseGenerator.ts`: Defines the base interface or abstract class for all generators, ensuring a consistent structure.
- `FrontMatterGenerator.ts`: Generates front matter for notes based on content and settings.
- `WikilinkGenerator.ts`: Creates wikilinks within note content.
- `JsonSchemaGenerator.ts`: Generates JSON schemas for structured data in notes.
- `OntologyGenerator.ts`: Analyzes vault structure and generates ontology suggestions.
- `BatchProcessor.ts`: Handles processing of multiple files, coordinating with other generators as needed.

## Adapters

- `AIAdapter.ts`: Defines the interface for AI service adapters.
- `OpenAIAdapter.ts`: Adapter for OpenAI API integration.
- `AnthropicAdapter.ts`: Adapter for Anthropic API integration.
- `GoogleAdapter.ts`: Adapter for Google AI API integration.
- `GroqAdapter.ts`: Adapter for Groq API integration.
- `OpenRouterAdapter.ts`: Adapter for OpenRouter API integration.
- `LMStudioAdapter.ts`: Adapter for local LM Studio models.

## Models

- `AIModels.ts`: Defines types and interfaces related to AI models and providers.
- `Settings.ts`: Defines the structure of plugin settings.

## Components

### Accordions
- `APIIntegrationAccordion.ts`: UI component for API integration settings.
- `PropertyManagerAccordion.ts`: UI component for managing custom properties.
- `TagManagerAccordion.ts`: UI component for managing custom tags.
- `OntologyGenerationAccordion.ts`: UI component for ontology generation settings.
- `LocalIntegrationAccordion.ts`: UI component for local LM Studio integration settings.
- `BatchProcessorAccordion.ts`: UI component for batch processing settings.
- `AdvancedAccordion.ts`: UI component for advanced plugin settings.

### Modals
- `EditPropertiesModal.ts`: Modal for editing custom properties.
- `EditTagsModal.ts`: Modal for editing custom tags.
- `OntologyGeneratorModal.ts`: Modal for generating and viewing ontologies.
- `BatchProcessorModal.ts`: Modal for initiating and monitoring batch processing.

## Utils

- `AIAdapterFactory.ts`: Factory for creating appropriate AI adapters based on settings.
- `ErrorTypes.ts`: Defines custom error types for AI-related operations.