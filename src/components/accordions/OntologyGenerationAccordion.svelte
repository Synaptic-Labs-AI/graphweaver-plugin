<!-- OntologyGenerationAccordion.svelte -->
<script lang="ts">
  import { writable } from 'svelte/store';
  import { onMount, onDestroy } from 'svelte';
  import BaseAccordion from './BaseAccordion.svelte';
  import { Notice } from 'obsidian';
  import type { 
      OntologyGenerationProps, 
      TagConversionResult, 
      OntologyResult,
      ComponentEvents
  } from '@type/component.types';
  import type { Tag, PropertyType } from '@type/metadata.types';
  import type { StoreError, StoreState } from '@type/store.types';
  import type { ValidationResult } from '@type/base.types';
  import { LifecycleState } from '@type/base.types';
  import OntologyGeneratorModal from '@components/modals/OntologyGeneratorModal.svelte';
  import EditTagsModal from '@components/modals/EditTagsModal.svelte';

  // Props
  export let title: string;
  export let description: string;
  export let app: OntologyGenerationProps['app'];
  export let settingsService: OntologyGenerationProps['settingsService'];
  export let aiService: OntologyGenerationProps['aiService'];
  export let aiAdapter: OntologyGenerationProps['aiAdapter'];
  export let generationService: OntologyGenerationProps['generationService'];
  export let adapterRegistry: OntologyGenerationProps['adapterRegistry'];
  export let tagManagementService: OntologyGenerationProps['tagManagementService'];
  export let isOpen = false;

  // Component events
  export let onChange: ComponentEvents['onChange'];
  export let onBlur: ComponentEvents['onBlur'];
  export let onFocus: ComponentEvents['onFocus'];
  export let onClick: ComponentEvents['onClick'];
  export let onKeyDown: ComponentEvents['onKeyDown'];

  interface OntologyState extends Omit<StoreState, 'error'> {
      isGenerating: boolean;
      processedTags: {
          new: number;
          modified: number;
          unchanged: number;
      };
      currentModal: 'generator' | 'editor' | null;
      lifecycle: LifecycleState;
      error: StoreError | null;
      validationResult: ValidationResult | null;
  }

  // Local state store
  const state = writable<OntologyState>({
      isInitialized: false,
      isGenerating: false,
      processedTags: {
          new: 0,
          modified: 0,
          unchanged: 0
      },
      currentModal: null,
      lifecycle: LifecycleState.Uninitialized,
      error: null,
      validationResult: null,
      lastUpdated: Date.now()
  });

  let modal: OntologyGeneratorModal | null = null;

  onMount(async () => {
      try {
          await initializeComponent();
          state.update(s => ({ 
              ...s, 
              lifecycle: LifecycleState.Ready,
              isInitialized: true
          }));
      } catch (error) {
          console.error('🦇 Failed to initialize Ontology Generation:', error);
          handleError(error);
      }
  });

  onDestroy(() => {
      modal?.$destroy();
      modal = null;
  });

  async function initializeComponent(): Promise<void> {
      if (!settingsService.isReady()) {
          throw new Error('Settings service not ready');
      }

      if (!tagManagementService) {
          throw new Error('Tag management service not provided');
      }
  }

  async function openOntologyGeneratorModal(): Promise<void> {
      if ($state.isGenerating || $state.currentModal) return;

      try {
          ensureServices();

          state.update(s => ({ 
              ...s, 
              isGenerating: true,
              currentModal: 'generator'
          }));

          modal = new OntologyGeneratorModal({
              target: document.body,
              props: {
                  app,
                  aiAdapter,
                  aiGenerationService: generationService,
                  tagManagementService,
                  adapterRegistry,
                  onGenerate: handleOntologyGenerated,
                  onClose: handleModalClose
              }
          });
      } catch (error) {
          console.error('🦇 Failed to open ontology generator:', error);
          handleError(error);
      }
  }

  function ensureServices(): void {
      if (!settingsService.isReady()) {
          throw new Error('Settings service not ready');
      }

      if (!aiAdapter) {
          throw new Error('AI adapter not provided');
      }

      if (!generationService) {
          throw new Error('Generation service not provided');
      }

      if (!tagManagementService) {
          throw new Error('Tag management service not provided');
      }
  }

  async function handleOntologyGenerated(ontology: OntologyResult): Promise<void> {
      try {
          if (!ontology?.tags?.length) {
              throw new Error('No tags suggested in ontology result');
          }

          const existingTags = settingsService.getSettings().tags.customTags;
          const result = processOntologyTags(ontology.tags, existingTags);

          state.update(s => ({
              ...s,
              processedTags: {
                  new: result.newTags.length,
                  modified: result.modifiedTags.length,
                  unchanged: result.unchangedTags.length
              }
          }));

          if (result.newTags.length === 0 && result.modifiedTags.length === 0) {
              new Notice('No new or modified tags found in the ontology.');
              return;
          }

          await openEditTagsModal([...result.newTags, ...result.modifiedTags]);
          new Notice(`Found ${result.newTags.length} new and ${result.modifiedTags.length} modified tags. Please review.`);
      } catch (error) {
          console.error('🦇 Failed to handle generated ontology:', error);
          handleError(error);
      }
  }

  function processOntologyTags(suggestedTags: Tag[], existingTags: Tag[]): TagConversionResult {
      const existingTagMap = new Map(existingTags.map(tag => [tag.name.toLowerCase(), tag]));
      const newTags: Tag[] = [];
      const modifiedTags: Tag[] = [];
      const unchangedTags: Tag[] = [];

      suggestedTags.forEach(suggestedTag => {
          const existingTag = existingTagMap.get(suggestedTag.name.toLowerCase());

          if (!existingTag) {
              newTags.push(createNewTag(suggestedTag));
          } else if (hasTagChanges(existingTag, suggestedTag)) {
              modifiedTags.push(mergeTagChanges(existingTag, suggestedTag));
          } else {
              unchangedTags.push(existingTag);
          }
      });

      return { newTags, modifiedTags, unchangedTags };
  }

  function createNewTag(suggestedTag: Tag): Tag {
      return {
          name: suggestedTag.name,
          description: suggestedTag.description,
          type: 'string' as PropertyType,
          required: false,
          multipleValues: false,
          defaultValue: undefined,
          options: undefined
      };
  }

  function hasTagChanges(existingTag: Tag, suggestedTag: Tag): boolean {
      return existingTag.description !== suggestedTag.description ||
             existingTag.type !== suggestedTag.type ||
             existingTag.multipleValues !== suggestedTag.multipleValues;
  }

  function mergeTagChanges(existingTag: Tag, suggestedTag: Tag): Tag {
      return {
          ...existingTag,
          description: suggestedTag.description || existingTag.description,
          type: suggestedTag.type || existingTag.type,
          multipleValues: suggestedTag.multipleValues ?? existingTag.multipleValues
      };
  }

  async function openEditTagsModal(tags: Tag[]): Promise<void> {
      state.update(s => ({ ...s, currentModal: 'editor' }));

      new EditTagsModal({
          target: document.body,
          props: {
              tags,
              onSubmit: handleTagsUpdate,
              onClose: handleModalClose
          }
      });
  }

  async function handleTagsUpdate(updatedTags: Tag[]): Promise<void> {
      try {
          const currentTags = settingsService.getSettings().tags.customTags;
          const mergedTags = mergeTags(currentTags, updatedTags);
          await settingsService.updateNestedSetting('tags', 'customTags', mergedTags);
          new Notice('Tags updated successfully');
          onChange?.(mergedTags);
      } catch (error) {
          console.error('🦇 Failed to save tags:', error);
          handleError(error);
      }
  }

  function mergeTags(currentTags: Tag[], updatedTags: Tag[]): Tag[] {
      const updatedTagMap = new Map(updatedTags.map(tag => [tag.name.toLowerCase(), tag]));
      return currentTags.map(tag => 
          updatedTagMap.get(tag.name.toLowerCase()) || tag
      );
  }

  function handleModalClose(): void {
      modal?.$destroy();
      modal = null;
      state.update(s => ({ 
          ...s, 
          isGenerating: false,
          currentModal: null
      }));
  }

  function handleError(error: unknown): void {
      const message = error instanceof Error ? error.message : 'Unknown error';
      state.update(s => ({
          ...s,
          error: {
              message,
              timestamp: Date.now(),
              source: 'OntologyGenerationAccordion',
              retryCount: 0
          },
          lifecycle: LifecycleState.Error,
          lastUpdated: Date.now()
      }));
      new Notice(`Ontology Generation Error: ${message}`);
  }
</script>

<BaseAccordion {title} {description} {isOpen}>
  <div 
      class="ontology-generation-container"
      role="region"
      aria-label="Ontology Generation"
  >
      {#if $state.error}
          <div class="error-message" role="alert">
              {$state.error.message}
          </div>
      {/if}

      <div class="description-content">
          <p class="description-text">
              Generate and manage ontologies for your vault. This will analyze your notes 
              and suggest appropriate tags and relationships.
          </p>

          {#if $state.processedTags.new > 0 || $state.processedTags.modified > 0}
              <div class="status-message">
                  Last generation found:
                  {#if $state.processedTags.new > 0}
                      <span class="tag-count new">{$state.processedTags.new} new</span>
                  {/if}
                  {#if $state.processedTags.modified > 0}
                      <span class="tag-count modified">{$state.processedTags.modified} modified</span>
                  {/if}
                  tags
              </div>
          {/if}
      </div>

      <div class="button-container">
          <button 
              class="mod-cta"
              on:click={openOntologyGeneratorModal}
              disabled={$state.isGenerating || !$state.isInitialized || $state.lifecycle !== LifecycleState.Ready}
              aria-disabled={$state.isGenerating || !$state.isInitialized || $state.lifecycle !== LifecycleState.Ready}
          >
              {$state.isGenerating ? 'Generating...' : 'Generate Ontology'}
          </button>
      </div>
  </div>
</BaseAccordion>

<style>
  .ontology-generation-container {
      display: flex;
      flex-direction: column;
      gap: var(--size-4);
      padding: var(--size-4);
  }

  .error-message {
      color: var(--color-red);
      font-size: var(--font-ui-small);
      padding: var(--size-2);
      background-color: var(--background-modifier-error);
      border-radius: var(--radius-s);
      margin-bottom: var(--size-2);
  }

  .description-content {
      margin-bottom: var(--size-4);
  }

  .description-text {
      color: var(--text-muted);
      font-size: var(--font-ui-small);
      margin: 0;
      margin-bottom: var(--size-2);
  }

  .status-message {
      font-size: var(--font-ui-small);
      color: var(--text-muted);
      margin-top: var(--size-2);
  }

  .tag-count {
      font-weight: var(--font-medium);
      padding: var(--size-1) var(--size-2);
      border-radius: var(--radius-s);
      margin: 0 var(--size-1);
  }

  .tag-count.new {
      background-color: var(--color-green-rgb);
      color: var(--text-on-accent);
  }

  .tag-count.modified {
      background-color: var(--color-yellow-rgb);
      color: var(--text-normal);
  }

  .button-container {
      display: flex;
      justify-content: flex-start;
  }

  button.mod-cta {
      background-color: var(--interactive-accent);
      color: var(--text-on-accent);
      padding: var(--size-2) var(--size-4);
      border-radius: var(--radius-s);
      font-weight: var(--font-medium);
      border: none;
      cursor: pointer;
      transition: background-color 0.2s ease;
  }

  button.mod-cta:hover:not(:disabled) {
      background-color: var(--interactive-accent-hover);
  }

  button.mod-cta:disabled {
      opacity: 0.5;
      cursor: not-allowed;
  }

  /* Dark mode support */
  :global(.theme-dark) .ontology-generation-container {
      background-color: var(--background-primary-alt);
  }
</style>