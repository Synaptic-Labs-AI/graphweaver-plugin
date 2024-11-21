<script lang="ts">
    import { onMount } from 'svelte';
    import type { App } from 'obsidian';
    import type GraphWeaverPlugin from '../../main';
    import type { AIService } from '@services/ai/AIService';
    import type { SettingsService } from '@services/SettingsService';
    import type { AIGenerationService } from '@services/ai/AIGenerationService';
    import type { AdapterRegistry } from '@services/ai/AdapterRegistry';
    import type { TagManagementService } from '@services/ai/AITagManagementService';
  
    // Import accordion components
    import ModelHookupAccordion from '@components/accordions/ModelHookupAccordion.svelte';
    import PropertyManagerAccordion from '@components/accordions/PropertyManagerAccordion.svelte';
    import TagManagerAccordion from '@components/accordions/TagManagerAccordion.svelte';
    import OntologyGenerationAccordion from '@components/accordions/OntologyGenerationAccordion.svelte';
    import BatchProcessorAccordion from '@components/accordions/BatchProcessorAccordion.svelte';
    import AdvancedAccordion from '@components/accordions/AdvancedAccordion.svelte';
    import KnowledgeBloomAccordion from '@components/accordions/KnowledgeBloomAccordion.svelte';
  
    export let app: App;
    export let plugin: GraphWeaverPlugin;
  
    let services: {
      aiService?: AIService;
      settingsService?: SettingsService;
      generationService?: AIGenerationService;
      adapterRegistry?: AdapterRegistry;
      tagManagementService?: TagManagementService;
    } = {};
  
    let isInitialized = false;
    let error: string | null = null;
  
    const accordionConfigs = [
      {
        id: 'modelHookup',
        component: ModelHookupAccordion,
        title: 'Model Hookup',
        description: 'Configure AI providers and models',
        priority: 1
      },
      {
        id: 'knowledgeBloom',
        component: KnowledgeBloomAccordion,
        title: 'Knowledge Bloom',
        description: 'Generate notes from wikilinks',
        priority: 2
      },
      {
        id: 'ontologyGeneration',
        component: OntologyGenerationAccordion,
        title: 'Ontology Generation',
        description: 'Generate and manage ontologies',
        priority: 3
      },
      {
        id: 'propertyManager',
        component: PropertyManagerAccordion,
        title: 'Property Manager',
        description: 'Manage custom properties',
        priority: 4
      },
      {
        id: 'tagManager',
        component: TagManagerAccordion,
        title: 'Tag Manager',
        description: 'Manage custom tags',
        priority: 5
      },
      {
        id: 'batchProcessor',
        component: BatchProcessorAccordion,
        title: 'Batch Processor',
        description: 'Process multiple files',
        priority: 6
      },
      {
        id: 'advanced',
        component: AdvancedAccordion,
        title: 'Advanced Settings',
        description: 'Configure advanced options',
        priority: 7
      }
    ].sort((a, b) => a.priority - b.priority);
  
    onMount(async () => {
      try {
        await initializeServices();
      } catch (e) {
        error = e instanceof Error ? e.message : 'Failed to initialize services';
      }
    });
  
    // In SettingsTab.svelte, update the service initialization:
async function initializeServices() {
    try {
        const aiService = plugin?.getAIService();
        const settingsService = plugin?.getSettingsService();
        
        if (!aiService || !settingsService) {
            throw new Error('Required services not initialized');
        }

        // Create tag management service with proper import
        const tagManagementService = await import('@services/ai/AITagManagementService')
            .then(module => new module.TagManagementService(app));

        services = {
            aiService,
            settingsService,
            tagManagementService,
            generationService: aiService.getGenerationService(),
            adapterRegistry: aiService.getAdapterRegistry()
        };
        
        isInitialized = true;
    } catch (err) {
        console.error('Failed to initialize services:', err);
        error = err instanceof Error ? err.message : 'Failed to initialize services';
    }
}
  </script>
  
  <div class="graphweaver-plugin-settings">
    <div class="settings-header">
      <h2>GraphWeaver</h2>
      <p>Configure AI models, manage properties and tags, and customize your knowledge graph generation.</p>
    </div>
  
    {#if error}
      <div class="settings-error">
        <p>{error}</p>
        <button on:click={() => initializeServices()}>Retry</button>
      </div>
    {:else if isInitialized}
      <div class="settings-accordions">
        {#each accordionConfigs as config (config.id)}
          <div class="settings-section" data-section-id={config.id}>
            <svelte:component
              this={config.component}
              {app}
              aiService={services.aiService}
              settingsService={services.settingsService}
              generationService={services.generationService}
              adapterRegistry={services.adapterRegistry}
              tagManagementService={services.tagManagementService}
            />
          </div>
        {/each}
      </div>
    {:else}
      <div class="settings-loading">
        <p>Initializing settings...</p>
      </div>
    {/if}
  </div>
  
  <style>
    .graphweaver-plugin-settings {
      padding: var(--size-4);
    }
  
    .settings-header {
      margin-bottom: var(--size-8);
    }
  
    .settings-header h2 {
      margin: 0;
      margin-bottom: var(--size-2);
      color: var(--text-normal);
      font-size: var(--font-ui-large);
    }
  
    .settings-header p {
      margin: 0;
      color: var(--text-muted);
    }
  
    .settings-accordions {
      display: flex;
      flex-direction: column;
      gap: var(--size-4);
    }
  
    .settings-section {
      border: 1px solid var(--background-modifier-border);
      border-radius: var(--radius-m);
      overflow: hidden;
    }
  
    .settings-error {
      padding: var(--size-4);
      background-color: var(--background-modifier-error);
      border-radius: var(--radius-m);
      color: var(--text-error);
    }
  
    .settings-loading {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: var(--size-8);
      color: var(--text-muted);
    }
  </style>