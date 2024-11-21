//KnowledgeBloomAccordion.svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import BaseAccordion from './BaseAccordion.svelte';
  import { Setting, TFile, Notice, type App } from 'obsidian';
  import type { KnowledgeBloomProps, GeneratedNote } from '@type/component.types';
  import type { AIProvider, AIModel } from '@type/ai.types';
  import { AIModelMap } from '@type/aiModels';

  interface ModelInfo {
    provider: AIProvider;
    model: AIModel;
  }

  export let app: KnowledgeBloomProps['app'];
  export let settingsService: KnowledgeBloomProps['settingsService'];
  export let aiService: KnowledgeBloomProps['aiService'];

  let containerEl: HTMLElement;
  let models: ModelInfo[] = [];
  let selectedModel = '';
  let userPromptInput = '';
  let isGenerating = false;
  let buttonEl: HTMLElement;

  onMount(() => {
    initializeModels();
    setupSettings();
  });

  function initializeModels(): void {
    models = Object.entries(AIModelMap).flatMap(([provider, modelList]) =>
      modelList.map(model => ({
        provider: provider as AIProvider,
        model
      }))
    );

    selectedModel = settingsService.getSettings().knowledgeBloom?.selectedModel 
      || (models.length > 0 ? models[0].model.apiName : '');

    if (selectedModel) {
      updateKnowledgeBloomSettings(selectedModel).catch(console.error);
    }
  }

  function setupSettings(): void {
    // Description
    new Setting(containerEl)
      .setDesc('Knowledge Bloom analyzes the current note, extracts wikilinks, and generates new notes for each link. For best results, use Perplexity models for up-to-date information.');

    // Model Selector
    new Setting(containerEl)
      .setName('AI Model')
      .setDesc('Select the AI model to use for Knowledge Bloom')
      .addDropdown(dropdown => dropdown
        .addOptions(Object.fromEntries(
          models.map(m => [m.model.apiName, m.model.name])
        ))
        .setValue(selectedModel)
        .onChange(async (value) => {
          await updateKnowledgeBloomSettings(value);
        }));

    // Prompt Input
    new Setting(containerEl)
      .setName('Additional Context')
      .setDesc('Provide any additional context or instructions for note generation (optional)')
      .addTextArea(text => text
        .setValue(userPromptInput)
        .setPlaceholder('Enter your prompts here...')
        .onChange(value => {
          userPromptInput = value;
        }));

    // Generate Button
    new Setting(containerEl)
      .addButton(button => button
        .setButtonText(isGenerating ? 'Generating...' : 'Generate Knowledge Bloom')
        .setCta()
        .setDisabled(isGenerating)
        .onClick(() => {
          handleGenerateKnowledgeBloom().catch(console.error);
        }));
  }

  async function updateKnowledgeBloomSettings(model: string): Promise<void> {
    try {
      await settingsService.updateKnowledgeBloomSettings({ selectedModel: model });
      await aiService.reinitialize();
      selectedModel = model;
      new Notice('AI Service reinitialized with the new model.');
    } catch (error) {
      console.error('Error updating settings:', error);
      new Notice(`Error updating settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async function handleGenerateKnowledgeBloom(): Promise<void> {
    if (isGenerating) return;

    const activeFile = app.workspace.getActiveFile();
    if (!(activeFile instanceof TFile)) {
      new Notice('No active file found.');
      return;
    }

    try {
      isGenerating = true;
      const generationService = aiService.getGenerationService();
      const result = await generationService.generateKnowledgeBloom(activeFile, userPromptInput);

      if (result?.generatedNotes?.length) {
        await createGeneratedNotes(result.generatedNotes);
        new Notice(`Generated ${result.generatedNotes.length} new notes!`);
      } else {
        new Notice('No notes were generated.');
      }
    } catch (error) {
      console.error('Error generating knowledge bloom:', error);
      new Notice(`Error generating knowledge bloom: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      isGenerating = false;
    }
  }

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
        console.error(`Error creating/updating note ${filePath}:`, error);
        new Notice(`Failed to create/update note ${note.title}`);
      }
    }
  }
</script>

<BaseAccordion
  title="🌺 Knowledge Bloom"
  description="Generate notes from wikilinks in your current note."
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

  /* Ensure textarea has enough height */
  :global(.setting-item textarea) {
    min-height: 100px;
    resize: vertical;
  }

  /* Style the dropdown to match Obsidian */
  :global(.setting-item select) {
    max-width: 240px;
  }
</style>