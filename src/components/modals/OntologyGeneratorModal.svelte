<!--src/components/modals/OntologyGeneratorModal.svelte-->
<script context="module" lang="ts">
  import { Modal, Setting, Notice, type TFile, TFolder } from 'obsidian';
  import { AIModelUtils } from '@type/aiModels';

  export class OntologyGeneratorModal extends Modal {    
    constructor(
      app: App,
      private aiAdapter: AIAdapter,
      private aiGenerationService: AIGenerationService,
      private tagManagementService: TagManagementService,
      private adapterRegistry: AdapterRegistry,
      private onGenerate: (ontology: OntologyResult) => void
    ) {
      super(app);
    }

    onOpen(): void {
      this.titleEl.setText('Generate Ontology');
      
      // Use the Svelte component constructor directly
      new (this.constructor as any).$$render({
        target: this.contentEl,
        props: {
          app: this.app,
          aiAdapter: this.aiAdapter,
          aiGenerationService: this.aiGenerationService,
          tagManagementService: this.tagManagementService,
          adapterRegistry: this.adapterRegistry,
          onGenerate: this.onGenerate,
          onClose: () => this.close()
        }
      });
    }

    onClose(): void {
      this.contentEl.empty();
    }
  }
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  import { App } from 'obsidian';
  import type { AIAdapter } from '@type/ai.types';
  import type { AIGenerationService } from '@services/ai/AIGenerationService';
  import type { TagManagementService } from '@services/tags/TagManagementService';
  import type { AdapterRegistry } from '@services/ai/AdapterRegistry';
  import type { OntologyResult, OntologyInput } from '@type/component.types';

  export let app: App;
  export let aiAdapter: AIAdapter;
  export let aiGenerationService: AIGenerationService;
  export let tagManagementService: TagManagementService;
  export let adapterRegistry: AdapterRegistry;
  export let onGenerate: (ontology: OntologyResult) => void;
  export let onClose: () => void;

  let containerEl: HTMLElement;
  let isGenerating = false;
  let selectedModel = '';
  let userContext = '';

  let vaultStats = {
    files: [] as TFile[],
    folders: [] as TFolder[],
    tags: [] as string[]
  };

  const availableModels = AIModelUtils.getModelsForProvider(aiAdapter.getProviderType())
    .map(model => ({
      provider: aiAdapter.getProviderType(),
      model: model.name
    }));

  const guidedQuestions = [
    "What are the main themes or topics in your knowledge base?",
    "Are there any specific hierarchies or relationships between concepts that you want to emphasize?",
    "What are your goals for organizing your knowledge base?"
  ];

  onMount(async () => {
    await loadVaultStats();
    renderContent();
  });

  async function loadVaultStats(): Promise<void> {
    vaultStats.files = app.vault.getMarkdownFiles();
    vaultStats.folders = app.vault.getAllLoadedFiles()
      .filter((file): file is TFolder => file instanceof TFolder);
    vaultStats.tags = await getAllTags(vaultStats.files);
  }

  async function getAllTags(files: TFile[]): Promise<string[]> {
    const tagSet = new Set<string>();
    for (const file of files) {
      const content = await app.vault.read(file);
      extractTags(content).forEach(tag => tagSet.add(tag));
    }
    return Array.from(tagSet);
  }

  function extractTags(content: string): string[] {
    const tagRegex = /#(\w+)/g;
    const tags = [];
    let match;
    while ((match = tagRegex.exec(content)) !== null) {
      tags.push(match[1]);
    }
    return tags;
  }

  function renderContent(): void {
    if (!containerEl) return;
    containerEl.empty();

    // Stats Section
    const statsEl = containerEl.createDiv('stats-container');
    
    // Files Stat
    new Setting(statsEl)
      .setClass('stat-card')
      .setHeading()
      .setName('Files')
      .setDesc(vaultStats.files.length.toString())
      .addExtraButton(button => button
        .setIcon('file')
        .setDisabled(true));

    // Folders Stat
    new Setting(statsEl)
      .setClass('stat-card')
      .setHeading()
      .setName('Folders')
      .setDesc(vaultStats.folders.length.toString())
      .addExtraButton(button => button
        .setIcon('folder')
        .setDisabled(true));

    // Tags Stat
    new Setting(statsEl)
      .setClass('stat-card')
      .setHeading()
      .setName('Tags')
      .setDesc(vaultStats.tags.length.toString())
      .addExtraButton(button => button
        .setIcon('tag')
        .setDisabled(true));

    // Model Selection
    new Setting(containerEl)
      .setName('AI Model')
      .setDesc('Select the AI model to use for ontology generation')
      .addDropdown(dropdown => dropdown
        .addOptions(Object.fromEntries(
          availableModels.map(m => [m.model, m.model])
        ))
        .setValue(selectedModel)
        .onChange(value => selectedModel = value));

    // Context Input
    new Setting(containerEl)
      .setName('Additional Context')
      .setDesc('Provide any additional context or information about your knowledge base.')
      .addTextArea(text => text
        .setValue(userContext)
        .setPlaceholder('Enter additional context here...')
        .onChange(value => userContext = value));

    // Guided Questions
    const questionsEl = containerEl.createDiv('guided-questions');
    questionsEl.createEl('h4', { text: 'Consider These Questions' });
    const ul = questionsEl.createEl('ul');
    guidedQuestions.forEach(question => {
      ul.createEl('li', { text: question });
    });

    // Actions
    new Setting(containerEl)
      .addButton(button => button
        .setButtonText(isGenerating ? 'Generating...' : 'Generate Ontology')
        .setCta()
        .setDisabled(isGenerating || !selectedModel)
        .onClick(() => handleGenerate()))
      .addButton(button => button
        .setButtonText('Cancel')
        .onClick(onClose));
  }

  async function handleGenerate(): Promise<void> {
    if (!selectedModel) {
      new Notice('Please select an AI model.');
      return;
    }

    isGenerating = true;
    renderContent(); // Update UI

    try {
      const input: OntologyInput = {
        files: vaultStats.files,
        folders: vaultStats.folders,
        tags: vaultStats.tags,
        provider: aiAdapter.getProviderType(),
        modelApiName: selectedModel,
        userContext
      };

      const ontology = await aiGenerationService.generateOntology(input);
      onGenerate(ontology);
      new Notice('Ontology generated successfully.');
      onClose();
    } catch (error) {
      console.error('Error generating ontology:', error);
      new Notice(`Error generating ontology: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      isGenerating = false;
      renderContent(); // Update UI
    }
  }
</script>

<div class="ontology-generator-container" bind:this={containerEl}></div>

<style>
  .ontology-generator-container {
    display: flex;
    flex-direction: column;
    gap: var(--size-4);
    padding: var(--size-4);
  }

  :global(.stats-container) {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--size-4);
    margin-bottom: var(--size-4);
  }

  :global(.stat-card) {
    background-color: var(--background-secondary);
    border-radius: var(--radius-m);
    padding: var(--size-4);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  :global(.stat-card .setting-item-info) {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  :global(.stat-card .setting-item-name) {
    font-size: var(--font-ui-small);
    color: var(--text-muted);
  }

  :global(.stat-card .setting-item-description) {
    font-size: 1.2em;
    font-weight: var(--font-bold);
    color: var(--text-normal);
  }

  :global(.guided-questions) {
    background-color: var(--background-secondary);
    border-radius: var(--radius-m);
    padding: var(--size-4);
    margin: var(--size-4) 0;
  }

  :global(.guided-questions h4) {
    margin: 0;
    margin-bottom: var(--size-2);
    color: var(--text-normal);
  }

  :global(.guided-questions ul) {
    margin: 0;
    padding-left: var(--size-4);
    color: var(--text-muted);
  }

  :global(.guided-questions li) {
    margin-bottom: var(--size-2);
  }

  :global(.setting-item textarea) {
    min-height: 100px;
    resize: vertical;
  }
</style>