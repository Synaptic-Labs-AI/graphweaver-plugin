<!-- KnowledgeBloomAccordion.svelte -->
<script lang="ts">
  import { writable } from 'svelte/store';
  import { onMount } from 'svelte';
  import BaseAccordion from './BaseAccordion.svelte';
  import { Notice, TFile } from 'obsidian';
  import type { 
      KnowledgeBloomProps, 
      ComponentEvents
  } from '@type/component.types';
  import type { 
      AIProvider, 
      AIModel,
      GeneratedNote
  } from '@type/ai.types';
  import { StoreState } from '@type/store.types';
  import type { ValidationResult } from '@type/base.types';
  import { LifecycleState } from '@type/base.types';
  import type { StoreError } from '@type/store.types';
  import { AIModelMap } from '@type/aiModels';

  // Props from KnowledgeBloomProps
  export let title: string;
  export let description: string;
  export let app: KnowledgeBloomProps['app'];
  export let settingsService: KnowledgeBloomProps['settingsService'];
  export let aiService: KnowledgeBloomProps['aiService'];
  export let isOpen = false;
  export let initialModel = '';

  // Component events
  export let onChange: ComponentEvents['onChange'];
  export let onBlur: ComponentEvents['onBlur'];
  export let onFocus: ComponentEvents['onFocus'];
  export let onClick: ComponentEvents['onClick'];
  export let onKeyDown: ComponentEvents['onKeyDown'];

  interface ModelInfo {
      provider: AIProvider;
      model: AIModel;
  }

  // Fixed state interface to correctly extend StoreState
  interface KnowledgeBloomState extends StoreState {
      models: ModelInfo[];
      selectedModel: string;
      userPromptInput: string;
      isGenerating: boolean;
      error?: StoreError; // Adjusted error property
      validationResult?: ValidationResult;
  }

  // Local state store with correct type
  const state = writable<KnowledgeBloomState>({
      isInitialized: false,
      models: [],
      selectedModel: initialModel,
      userPromptInput: '',
      isGenerating: false,
      lifecycle: LifecycleState.Uninitialized,
      error: undefined,
      validationResult: undefined,
      lastUpdated: Date.now()
  });

  onMount(async () => {
      try {
          await initializeComponent();
          state.update(s => ({
              ...s,
              isInitialized: true,
              lifecycle: LifecycleState.Ready
          }));
      } catch (error) {
          console.error('🦇 Failed to initialize Knowledge Bloom:', error);
          handleError(error);
      }
  });

  /**
   * Initialize models from AIModelMap
   */
  async function initializeModels(): Promise<void> {
      if (!settingsService.isReady()) {
          throw new Error('Settings service not ready');
      }

      const modelList = Object.entries(AIModelMap).flatMap(([provider, models]) =>
          models.map(model => ({
              provider: provider as AIProvider,
              model
          }))
      );

      const settings = settingsService.getSettings();
      const currentModel = settings.knowledgeBloom?.selectedModel || 
          (modelList.length > 0 ? modelList[0].model.apiName : '');

      state.update(s => ({
          ...s,
          models: modelList,
          selectedModel: currentModel,
          lastUpdated: Date.now()
      }));

      if (currentModel) {
          await updateKnowledgeBloomSettings(currentModel);
      }
  }

  /**
   * Update Knowledge Bloom settings
   */
  async function updateKnowledgeBloomSettings(model: string): Promise<void> {
      try {
          await settingsService.updateKnowledgeBloomSettings({ selectedModel: model });
          await aiService.reinitialize();
          
          state.update(s => ({ 
              ...s, 
              selectedModel: model,
              lastUpdated: Date.now()
          }));

          new Notice('AI Service reinitialized with the new model.');
          onChange?.(model);
      } catch (error) {
          console.error('🦇 Error updating settings:', error);
          handleError(error);
      }
  }

  /**
   * Handle prompt input updates
   */
  function updatePromptInput(value: string): void {
      state.update(s => ({ 
          ...s, 
          userPromptInput: value,
          lastUpdated: Date.now()
      }));
      onChange?.(value);
  }

  /**
   * Handle Knowledge Bloom generation
   */
  async function handleGenerateKnowledgeBloom(): Promise<void> {
      if ($state.isGenerating) return;

      const activeFile = app.workspace.getActiveFile();
      if (!(activeFile instanceof TFile)) {
          new Notice('No active file found.');
          return;
      }

      try {
          state.update(s => ({ ...s, isGenerating: true }));

          const generationService = aiService.getGenerationService();
          const result = await generationService.generateKnowledgeBloom(
              activeFile, 
              $state.userPromptInput
          );

          if (result?.generatedNotes?.length) {
              await createGeneratedNotes(result.generatedNotes);
              new Notice(`Generated ${result.generatedNotes.length} new notes!`);
          } else {
              new Notice('No notes were generated.');
          }
      } catch (error) {
          console.error('🦇 Error generating Knowledge Bloom:', error);
          handleError(error);
      } finally {
          state.update(s => ({ 
              ...s, 
              isGenerating: false,
              lastUpdated: Date.now()
          }));
      }
  }

  /**
   * Create generated notes
   */
  async function createGeneratedNotes(notes: GeneratedNote[]): Promise<void> {
      for (const note of notes) {
          const filePath = `${note.title}.md`;
          const existingFile = app.vault.getAbstractFileByPath(filePath);
          
          try {
              if (existingFile instanceof TFile) {
                  await app.vault.modify(existingFile, note.content);
              } else {
                  await app.vault.create(filePath, note.content);
              }
          } catch (error) {
              console.error(`🦇 Error creating/updating note ${filePath}:`, error);
              new Notice(`Failed to create/update note "${note.title}".`);
          }
      }
  }

  /**
   * Handle errors
   */
  function handleError(error: unknown): void {
      const message = error instanceof Error ? error.message : 'Unknown error';
      state.update(s => ({
          ...s,
          error: {
              message,
              timestamp: Date.now(),
              source: 'KnowledgeBloomAccordion'
          },
          lifecycle: LifecycleState.Error
      }));
      new Notice(`Knowledge Bloom Error: ${message}`);
  }

  // Implement initializeComponent function
  async function initializeComponent(): Promise<void> {
      try {
          await initializeModels();
          // ...existing code...
      } catch (error) {
          handleError(error);
      }
  }
</script>

<BaseAccordion {title} {description} {isOpen}>
  <form
      class="knowledge-bloom-settings"
      on:submit|preventDefault={handleGenerateKnowledgeBloom}
      aria-label="Knowledge Bloom Settings"
  >
      {#if $state.error}
          <div class="error-message" role="alert">
              {$state.error.message}
          </div>
      {/if}

      <div class="setting-item description-item">
          <div class="setting-item-description">
              Knowledge Bloom analyzes the current note, extracts wikilinks, and generates new notes for each link. 
              For best results, use Perplexity models for up-to-date information.
          </div>
      </div>

      <div class="setting-item">
          <div class="setting-item-info">
              <label for="model-select" class="setting-item-name">AI Model</label>
              <div class="setting-item-description">Select the AI model to use for Knowledge Bloom</div>
          </div>
          <div class="setting-item-control">
              <select 
                  id="model-select"
                  bind:value={$state.selectedModel}
                  on:change={(e) => updateKnowledgeBloomSettings(e.currentTarget.value)}
                  disabled={!$state.isInitialized || $state.isGenerating}
                  aria-disabled={!$state.isInitialized || $state.isGenerating}
              >
                  {#each $state.models as modelInfo}
                      <option value={modelInfo.model.apiName}>
                          {modelInfo.model.name}
                      </option>
                  {/each}
              </select>
          </div>
      </div>

      <div class="setting-item">
          <div class="setting-item-info">
              <label for="context-input" class="setting-item-name">Additional Context</label>
              <div class="setting-item-description">
                  Provide any additional context or instructions for note generation (optional)
              </div>
          </div>
          <div class="setting-item-control">
              <textarea 
                  id="context-input"
                  bind:value={$state.userPromptInput}
                  on:input={(e) => updatePromptInput(e.currentTarget.value)}
                  placeholder="Enter your prompts here..."
                  disabled={$state.isGenerating}
                  aria-disabled={$state.isGenerating}
              ></textarea>
          </div>
      </div>

      <div class="setting-item">
          <div class="setting-item-control">
              <button 
                  type="submit"
                  class="mod-cta" 
                  disabled={$state.isGenerating || !$state.isInitialized || $state.lifecycle !== LifecycleState.Ready}
                  aria-disabled={$state.isGenerating || !$state.isInitialized || $state.lifecycle !== LifecycleState.Ready}
              >
                  {$state.isGenerating ? 'Generating...' : 'Generate Knowledge Bloom'}
              </button>
          </div>
      </div>
  </form>
</BaseAccordion>

<style>
  /* Adjust styling to match others */
  .knowledge-bloom-settings {
      padding: var(--size-4);
      display: flex;
      flex-direction: column;
      gap: var(--size-4);
  }
</style>