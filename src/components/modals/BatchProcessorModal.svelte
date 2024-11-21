//BatchProcessorModal.svelte
<script context="module" lang="ts">
  import { Modal, type App } from 'obsidian';
  import type { ProcessingStats } from '@type/processing.types';
  import type { SvelteComponent } from 'svelte';

  export class BatchProcessorModal extends Modal {
    private component!: SvelteComponent;
    private settingsService: SettingsService;
    
    constructor(app: App, settingsService: SettingsService) {
      super(app);
      this.settingsService = settingsService;
    }

    onOpen(): void {
      const { contentEl } = this;
      contentEl.empty();

      this.component = new (this.constructor as any)({
        target: contentEl,
        props: {
          app: this.app,
          settingsService: this.settingsService,
          onClose: () => this.close()
        }
      });
    }

    onClose(): void {
      this.component.$destroy();
      const { contentEl } = this;
      contentEl.empty();
    }
  }
</script>

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { BatchProcessor } from '@generators/BatchProcessor';
  import { CoreService } from '@services/core/CoreService';
  import { ProcessingStateEnum } from '@type/processing.types';
  import { TFile, TFolder, Notice, Setting } from 'obsidian';
  import { SettingsService } from '@services/SettingsService';

  interface FileNode {
    name: string;
    path: string;
    type: 'file' | 'folder';
    children?: FileNode[];
    selected: boolean;
    expanded?: boolean;
    level: number;
  }
  export let app: App;
  export let onClose: () => void;
  export let settingsService: SettingsService;

  let selectedPaths = new Set<string>();
  let expandedFolders = new Set<string>();
  let vaultStructure: FileNode[] = [];
  let isProcessing = false;
  let currentFile = '';
  let progress = 0;
  let processingState: ProcessingStateEnum = ProcessingStateEnum.IDLE;
  let processor: BatchProcessor;
  let containerEl: HTMLElement;

  const statusBar = {
    updateFromState: (update: { currentFile: string | null; progress: number; status: any }) => {
      currentFile = update.currentFile || '';
      progress = update.progress;
    }
  };

  onMount(() => {
    buildVaultStructure();
    initializeProcessor();
  });

  onDestroy(() => {
    processor?.removeAllListeners();
  });

  // Create a concrete implementation of CoreService
  class ProcessorCoreService extends CoreService {
    async initializeInternal(): Promise<void> {
      // Implementation
    }
    
    async destroyInternal(): Promise<void> {
      // Implementation
    }
  }

  // Update processor initialization
  function initializeProcessor(): void {
    processor = new BatchProcessor(
      app,
      new ProcessorCoreService('batchProcessor', 'Batch Processor'),
      statusBar
    );

    processor.on('stateChanged', ({ state, currentFile: file, progress: prog }) => {
      processingState = state.state;
      currentFile = file || '';
      progress = prog || 0;
    });

    processor.on('error', ({ filePath, error }) => {
      new Notice(`Error processing ${filePath}: ${error}`);
    });
  }

  function buildVaultStructure(): void {
    const rootFolder = app.vault.getRoot();
    vaultStructure = rootFolder.children
      .filter((child): child is TFolder | TFile => child instanceof TFolder || child instanceof TFile)
      .map(child => createNode(child, 0));
  }

  function createNode(item: TFolder | TFile, level: number): FileNode {
    if (item instanceof TFile) {
      return {
        name: item.name,
        path: item.path,
        type: 'file',
        selected: false,
        level
      };
    }

    return {
      name: item.name,
      path: item.path,
      type: 'folder',
      children: item.children
        .filter((child): child is TFolder | TFile => child instanceof TFolder || child instanceof TFile)
        .map(child => createNode(child, level + 1)),
      selected: false,
      expanded: expandedFolders.has(item.path),
      level
    };
  }

  function renderFileTree(container: HTMLElement, nodes: FileNode[]): void {
    nodes.forEach(node => {
      const itemSetting = new Setting(container)
        .setClass('file-tree-item')
        .addToggle(toggle => {
          toggle
            .setValue(node.selected)
            .onChange(value => handleSelection(node, value));
          return toggle;
        })
        .setName(node.name);

      if (node.type === 'folder') {
        itemSetting
          .setClass('folder-item')
          .setHeading()
          .addExtraButton(button => {
            button
              .setIcon(node.expanded ? 'chevron-down' : 'chevron-right')
              .onClick(() => toggleFolder(node));
            return button;
          });

        if (node.expanded && node.children) {
          const childContainer = container.createDiv('folder-children');
          childContainer.style.marginLeft = '20px';
          renderFileTree(childContainer, node.children);
        }
      }
    });
  }

  function refreshFileTree(): void {
    if (!containerEl) return;
    
    containerEl.empty();
    renderFileTree(containerEl, vaultStructure);
  }

  function handleSelection(node: FileNode, selected: boolean): void {
    node.selected = selected;
    
    if (selected) {
      selectedPaths.add(node.path);
    } else {
      selectedPaths.delete(node.path);
    }
    selectedPaths = selectedPaths;

    if (node.type === 'folder' && node.children) {
      node.children.forEach(child => handleSelection(child, selected));
    }

    refreshFileTree();
  }

  function toggleFolder(node: FileNode): void {
    if (node.type !== 'folder') return;

    node.expanded = !node.expanded;
    
    if (node.expanded) {
      expandedFolders.add(node.path);
    } else {
      expandedFolders.delete(node.path);
    }
    expandedFolders = expandedFolders;

    refreshFileTree();
  }

  async function handleProcess(): Promise<void> {
    if (selectedPaths.size === 0) {
      new Notice('No files selected for processing');
      return;
    }

    try {
      isProcessing = true;
      
      const settings = settingsService.getSettings();
      const result = await processor.process({
        files: Array.from(selectedPaths),
        generateFrontMatter: settings.frontMatter.autoGenerate,
        generateWikilinks: settings.advanced.generateWikilinks
      });

      showProcessingResults(result);
      onClose();
    } catch (error) {
      console.error('Error processing files:', error);
      new Notice(`Error processing files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      isProcessing = false;
    }
  }

  function showProcessingResults(stats: ProcessingStats): void {
    const duration = ((stats.endTime ?? Date.now() - stats.startTime) / 1000).toFixed(1);
    new Notice(
      `Processing complete!\n` +
      `Processed: ${stats.processedFiles}\n` +
      `Errors: ${stats.errorFiles}\n` +
      `Duration: ${duration}s`
    );
  }
</script>

<div class="batch-processor-modal">
  <div class="modal-content">
    <header class="modal-header">
      <h2>Select Files to Process</h2>
    </header>

    <div class="modal-scrollable-content" bind:this={containerEl}></div>

    {#if isProcessing}
      <div class="processing-status">
        <div class="progress-bar">
          <div class="progress-fill" style="width: {progress}%"></div>
        </div>
        <div class="status-text">
          {#if currentFile}
            Processing: {currentFile}
          {:else}
            {processingState}
          {/if}
        </div>
      </div>
    {/if}

    <footer class="modal-footer">
      <div class="footer-content">
        <span class="selection-count">
          {selectedPaths.size} items selected
        </span>
        <div class="button-container">
          <button
            class="mod-cta"
            on:click={handleProcess}
            disabled={isProcessing || selectedPaths.size === 0}
          >
            {isProcessing ? 'Processing...' : 'Process Selected'}
          </button>
          <button
            class="mod-cancel"
            on:click={onClose}
            disabled={isProcessing}
          >
            Cancel
          </button>
        </div>
      </div>
    </footer>
  </div>
</div>

<style>
  .batch-processor-modal {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: var(--size-4);
  }

  .modal-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    gap: var(--size-4);
  }

  .modal-header {
    border-bottom: 1px solid var(--background-modifier-border);
    padding-bottom: var(--size-4);
  }

  .modal-header h2 {
    margin: 0;
    color: var(--text-normal);
    font-size: var(--font-ui-large);
  }

  .modal-scrollable-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--size-2);
    min-height: 200px;
  }

  .processing-status {
    padding: var(--size-4);
    background-color: var(--background-secondary);
    border-radius: var(--radius-m);
  }

  .progress-bar {
    width: 100%;
    height: 4px;
    background-color: var(--background-modifier-border);
    border-radius: 2px;
    margin-bottom: var(--size-2);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background-color: var(--interactive-accent);
    transition: width 0.2s ease;
  }

  .status-text {
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
    text-align: center;
  }

  :global(.file-tree-item) {
    padding: var(--size-1) 0;
  }

  :global(.folder-item) {
    font-weight: var(--font-medium);
  }

  :global(.folder-children) {
    border-left: 1px solid var(--background-modifier-border);
  }

  .modal-footer {
    border-top: 1px solid var(--background-modifier-border);
    padding-top: var(--size-4);
  }

  .footer-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .selection-count {
    color: var(--text-muted);
    font-size: var(--font-ui-small);
  }

  .button-container {
    display: flex;
    gap: var(--size-4);
  }

  :global(.setting-item) {
    border-top: none !important;
    padding: var(--size-2) 0;
  }
</style>