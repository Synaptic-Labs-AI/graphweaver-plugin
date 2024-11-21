<script lang="ts">
    import { onMount } from 'svelte';
    import { Notice, setIcon, type App, type TFile, TFolder } from 'obsidian';
    import type { AIAdapter } from '@type/ai.types';
    import type { AIGenerationService } from '@services/ai/AIGenerationService';
    import type { TagManagementService } from '@services/ai/AITagManagementService';
    import type { AdapterRegistry } from '@services/ai/AdapterRegistry';
    import type { OntologyResult, OntologyInput } from '@type/component.types';
    import { AIModelUtils } from '@type/aiModels';
  
    export let app: App;
    export let aiAdapter: AIAdapter;
    export let aiGenerationService: AIGenerationService;
    export let tagManagementService: TagManagementService;
    export let adapterRegistry: AdapterRegistry;
    export let onGenerate: (ontology: OntologyResult) => void;
    export let onClose: () => void;
  
    let fileIconEl: HTMLElement;
    let folderIconEl: HTMLElement;
    let tagIconEl: HTMLElement;
    let selectedModel: string = '';
    let userContext: string = '';
    let isGenerating: boolean = false;
  
    let vaultStats = {
      files: [] as TFile[],
      folders: [] as TFolder[],
      tags: [] as string[]
    };
  
    let availableModels = AIModelUtils.getModelsForProvider(aiAdapter.getProviderType())
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
      if (fileIconEl) setIcon(fileIconEl, 'file');
      if (folderIconEl) setIcon(folderIconEl, 'folder');
      if (tagIconEl) setIcon(tagIconEl, 'tag');
    });
  
    async function loadVaultStats(): Promise<void> {
      vaultStats.files = app.vault.getMarkdownFiles();
      vaultStats.folders = app.vault.getAllLoadedFiles().filter(
        (file): file is TFolder => file instanceof TFolder
      );
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
  
    async function handleGenerate(): Promise<void> {
      if (!selectedModel) {
        new Notice('Please select an AI model.');
        return;
      }
  
      isGenerating = true;
  
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
      }
    }
  </script>
  
  <div class="ontology-generator-modal">
    <header class="modal-header">
      <h2>Generate Ontology</h2>
      <p>Generate and manage ontologies for your vault</p>
    </header>
  
    <div class="modal-content">
      <div class="stats-container">
        <div class="stat-card">
          <div class="stat-icon" bind:this={fileIconEl}></div>
          <div class="stat-info">
            <span class="stat-label">Files</span>
            <span class="stat-count">{vaultStats.files.length}</span>
          </div>
        </div>
  
        <div class="stat-card">
          <div class="stat-icon" bind:this={folderIconEl}></div>
          <div class="stat-info">
            <span class="stat-label">Folders</span>
            <span class="stat-count">{vaultStats.folders.length}</span>
          </div>
        </div>
  
        <div class="stat-card">
          <div class="stat-icon" bind:this={tagIconEl}></div>
          <div class="stat-info">
            <span class="stat-label">Tags</span>
            <span class="stat-count">{vaultStats.tags.length}</span>
          </div>
        </div>
      </div>
  
      <div class="model-selection">
        <label for="model-select">AI Model</label>
        <select
          id="model-select"
          bind:value={selectedModel}
        >
          <option value="">Select a model...</option>
          {#each availableModels as model}
            <option value={model.model}>{model.model}</option>
          {/each}
        </select>
        <span class="description">Select the AI model to use for ontology generation</span>
      </div>
  
      <div class="context-input">
        <label for="context">Additional Context</label>
        <textarea
          id="context"
          bind:value={userContext}
          placeholder="Enter additional context here..."
          rows="4"
        ></textarea>
        <span class="description">Provide any additional context or information about your knowledge base.</span>
      </div>
  
      <div class="guided-questions">
        <h4>Consider These Questions</h4>
        <ul>
          {#each guidedQuestions as question}
            <li>{question}</li>
          {/each}
        </ul>
      </div>
  
      <div class="modal-footer">
        <button
          class="mod-cta"
          on:click={handleGenerate}
          disabled={isGenerating || !selectedModel}
        >
          {isGenerating ? 'Generating...' : 'Generate Ontology'}
        </button>
        <button
          class="mod-cancel"
          on:click={onClose}
          disabled={isGenerating}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
  
  <style>
    .ontology-generator-modal {
      display: flex;
      flex-direction: column;
      gap: var(--size-4);
      padding: var(--size-4);
      max-width: 600px;
      width: 100%;
    }
  
    .modal-header {
      border-bottom: 1px solid var(--background-modifier-border);
      padding-bottom: var(--size-4);
    }
  
    .modal-header h2 {
      margin: 0;
      margin-bottom: var(--size-2);
      color: var(--text-normal);
      font-size: var(--font-ui-large);
    }
  
    .modal-header p {
      margin: 0;
      color: var(--text-muted);
    }
  
    .stats-container {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--size-4);
      margin-bottom: var(--size-4);
    }
  
    .stat-card {
      background-color: var(--background-secondary);
      border-radius: var(--radius-m);
      padding: var(--size-4);
      display: flex;
      align-items: center;
      gap: var(--size-4);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
  
    .stat-icon {
      color: var(--text-muted);
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
    }
  
    .stat-info {
      display: flex;
      flex-direction: column;
    }
  
    .stat-label {
      font-weight: var(--font-bold);
      color: var(--text-muted);
      font-size: var(--font-ui-small);
    }
  
    .stat-count {
      font-size: 1.2em;
      color: var(--text-normal);
      font-weight: var(--font-bold);
    }
  
    .model-selection,
    .context-input {
      display: flex;
      flex-direction: column;
      gap: var(--size-2);
      margin-bottom: var(--size-4);
    }
  
    label {
      font-weight: var(--font-bold);
      color: var(--text-normal);
    }
  
    select,
    textarea {
      background: var(--background-primary);
      border: 1px solid var(--background-modifier-border);
      border-radius: var(--radius-s);
      padding: var(--size-2);
      color: var(--text-normal);
      width: 100%;
    }
  
    textarea {
      resize: vertical;
      min-height: 100px;
    }
  
    .description {
      color: var(--text-muted);
      font-size: var(--font-ui-small);
    }
  
    .guided-questions {
      background-color: var(--background-secondary);
      border-radius: var(--radius-m);
      padding: var(--size-4);
      margin-bottom: var(--size-4);
    }
  
    .guided-questions h4 {
      margin: 0;
      margin-bottom: var(--size-2);
      color: var(--text-normal);
    }
  
    .guided-questions ul {
      margin: 0;
      padding-left: var(--size-4);
      color: var(--text-muted);
    }
  
    .guided-questions li {
      margin-bottom: var(--size-2);
    }
  
    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: var(--size-4);
      margin-top: var(--size-4);
      padding-top: var(--size-4);
      border-top: 1px solid var(--background-modifier-border);
    }
  
    button {
      padding: var(--size-2) var(--size-4);
      border-radius: var(--radius-s);
      border: none;
      cursor: pointer;
      font-weight: var(--font-bold);
    }
  
    button.mod-cta {
      background-color: var(--interactive-accent);
      color: var(--text-on-accent);
    }
  
    button.mod-cta:hover:not(:disabled) {
      background-color: var(--interactive-accent-hover);
    }
  
    button.mod-cancel {
      background-color: var(--background-modifier-border);
      color: var(--text-normal);
    }
  
    button.mod-cancel:hover:not(:disabled) {
      background-color: var(--background-modifier-border-hover);
    }
  
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  </style>