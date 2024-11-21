//OntologyGenerationAccordion.svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import BaseAccordion from './BaseAccordion.svelte';
  import { Setting, Notice } from 'obsidian';
  import type { OntologyGenerationProps, TagConversionResult, OntologyResult } from '@type/component.types';
  import type { Tag, PropertyType } from '@type/metadata.types';
  import OntologyGeneratorModal from '@components/modals/OntologyGeneratorModal.svelte';
  import EditTagsModal from '@components/modals/EditTagsModal.svelte';

  export let app: OntologyGenerationProps['app'];
  export let settingsService: OntologyGenerationProps['settingsService'];
  export let aiService: OntologyGenerationProps['aiService'];
  export let aiAdapter: OntologyGenerationProps['aiAdapter'];
  export let generationService: OntologyGenerationProps['generationService'];
  export let adapterRegistry: OntologyGenerationProps['adapterRegistry'];
  export let tagManagementService: OntologyGenerationProps['tagManagementService'];

  let containerEl: HTMLElement;
  let modal: OntologyGeneratorModal | null = null;
  let isGenerating = false;

  onMount(() => {
    setupSettings();
  });

  onDestroy(() => {
    modal?.$destroy();
    modal = null;
  });

  function setupSettings(): void {
    // Description and information
    new Setting(containerEl)
      .setDesc('Generate and manage ontologies for your vault. This will analyze your notes and suggest appropriate tags and relationships.');

    // Generate button
    new Setting(containerEl)
      .addButton(button => button
        .setButtonText(isGenerating ? 'Generating...' : 'Generate Ontology')
        .setCta()
        .setDisabled(isGenerating)
        .onClick(openOntologyGeneratorModal));
  }

  function openOntologyGeneratorModal(): void {
    try {
      if (modal) return;

      modal = new OntologyGeneratorModal({
        target: document.body,
        props: {
          app,
          aiAdapter,
          aiGenerationService: generationService,
          tagManagementService,
          adapterRegistry,
          onGenerate: handleOntologyGenerated,
          onClose: () => {
            modal?.$destroy();
            modal = null;
          }
        }
      });
    } catch (error) {
      console.error('Failed to open ontology generator:', error);
      new Notice(`Failed to open ontology generator: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async function handleOntologyGenerated(ontology: OntologyResult): Promise<void> {
    try {
      if (!ontology?.tags?.length) {  // Changed from suggestedTags to tags
        throw new Error('No tags suggested in ontology result');
      }

      const existingTags = settingsService.getSettings().tags.customTags;
      const { newTags, modifiedTags } = processOntologyTags(ontology.tags, existingTags);  // Changed from suggestedTags to tags

      if (newTags.length === 0 && modifiedTags.length === 0) {
        new Notice('No new or modified tags found in the ontology.');
        return;
      }

      openEditTagsModal([...newTags, ...modifiedTags]);
      new Notice(`Found ${newTags.length} new and ${modifiedTags.length} modified tags. Please review.`);
    } catch (error) {
      console.error('Failed to handle generated ontology:', error);
      new Notice(`Failed to process ontology: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  function openEditTagsModal(tags: Tag[]): void {
    new EditTagsModal({
      target: document.body,
      props: {
        app,
        tags,
        onSubmit: async (updatedTags: Tag[]) => {
          try {
            const currentTags = settingsService.getSettings().tags.customTags;
            const mergedTags = mergeTags(currentTags, updatedTags);
            await settingsService.updateNestedSetting('tags', 'customTags', mergedTags);
            new Notice('Tags updated successfully');
          } catch (error) {
            console.error('Failed to save tags:', error);
            new Notice(`Failed to save tags: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        },
        onClose: () => null
      }
    });
  }

  function mergeTags(currentTags: Tag[], updatedTags: Tag[]): Tag[] {
    const updatedTagMap = new Map(updatedTags.map(tag => [tag.name.toLowerCase(), tag]));
    return currentTags.map(tag => 
      updatedTagMap.get(tag.name.toLowerCase()) || tag
    );
  }
</script>

<BaseAccordion
  title="🧠 Ontology Generation"
  description="Generate and manage ontologies for your vault."
  {app}
  {settingsService}
  {aiService}
>
  <div class="vertical-tab-content" bind:this={containerEl}></div>
</BaseAccordion>

<style>
  .vertical-tab-content {
    padding: var(--size-2);
  }

  :global(.setting-item) {
    border-top: none !important;
  }

  :global(.setting-item:first-child) {
    padding-top: 0;
  }
</style>