<!-- src/components/modals/BatchProcessorModal.svelte -->
<script context="module" lang="ts">
  import type { ProcessingStats } from '@type/processing.types';
</script>

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { BatchProcessor } from '@generators/BatchProcessor';
  import { CoreService } from '@services/core/CoreService';
  import { 
    ProcessingStateEnum, 
    type ProcessingStatus,
    type IProcessingStatusBar 
  } from '@type/processing.types';
  import { TFile, TFolder, Notice, Setting } from 'obsidian';
  import type { FileNode } from '@type/component.types';
  import type { UIState } from '@type/store.types';
  import type { BatchProcessorModalProps } from '@type/component.types';

  // Simplified props
  export let app: BatchProcessorModalProps['app'];
  export let settingsService: BatchProcessorModalProps['settingsService'];
  export let aiService: BatchProcessorModalProps['aiService'];
  export let generationService: BatchProcessorModalProps['generationService'];
  export let onClose: BatchProcessorModalProps['onClose'];
  export let onProcessComplete: BatchProcessorModalProps['onProcessComplete'];

  // State management
  let fileTree: FileNode[] = [];
  let selection = {
    paths: new Set<string>(),
    expanded: new Set<string>()
  };

  // Extend UIState with processing-specific fields
  interface ProcessingUIState extends UIState {
    file: string;
    progress: number;
    isProcessing: boolean;
  }

  let containerEl: HTMLElement;
  let processor: BatchProcessor;

  // Initialize UI state with all required fields
  let uiState: ProcessingUIState = {
    isInitialized: true,
    darkMode: false,
    activeAccordion: null,
    notifications: [],
    lastInteraction: Date.now(),
    modalStack: [],
    lastUpdated: Date.now(),
    file: '',
    progress: 0,
    isProcessing: false
  };

  // Processing state using imported type
  let processing: ProcessingStatus = {
    state: {
      isProcessing: false,
      currentFile: null,
      queue: [],
      progress: 0,
      state: ProcessingStateEnum.IDLE,
      filesQueued: 0,
      filesProcessed: 0,
      filesRemaining: 0,
      errors: [],
      error: null,
      startTime: null,
      estimatedTimeRemaining: null
    },
    filesQueued: 0,
    filesProcessed: 0,
    filesRemaining: 0,
    currentFile: undefined,
    startTime: 0,
    errors: []
  };

  const statusBar: IProcessingStatusBar = {
    updateFromState: (state: { 
      currentFile: string | null; 
      progress: number; 
      status: ProcessingStatus;
    }): void => {
      if (state.currentFile !== null) {
        uiState.file = state.currentFile;
      }
      uiState.progress = state.progress;
      uiState.isProcessing = state.status.state.isProcessing;
      Object.assign(processing, state.status);
      uiState = { ...uiState }; // Trigger Svelte reactivity
      processing = processing;
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

    processor.on('stateChanged', ({ state, currentFile, progress }) => {
      processing.state.state = state;
      processing.currentFile = currentFile ?? undefined;
      processing.state.progress = progress;
      uiState.progress = progress;
      uiState.file = currentFile ?? '';
      uiState.lastUpdated = Date.now();
      uiState = { ...uiState };
      processing = processing;
    });

    processor.on('error', ({ filePath, error }) => {
      new Notice(`Error processing ${filePath}: ${error}`);
    });
  }

  function buildVaultStructure(): FileNode[] {
    const rootFolder = app.vault.getRoot();
    return rootFolder.children
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
      expanded: selection.expanded.has(item.path),
      level
    };
  }

  function renderNodes(container: HTMLElement, nodes: FileNode[]): void {
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
          renderNodes(childContainer, node.children);
        }
      }
    });
  }

  function renderFileTree(): void {
    if (!containerEl) return;
    containerEl.empty();
    
    const tree = buildVaultStructure();
    fileTree = tree;
    renderNodes(containerEl, tree);
  }

  function handleSelection(node: FileNode, selected: boolean): void {
    node.selected = selected;
    
    if (selected) {
      selection.paths.add(node.path);
    } else {
      selection.paths.delete(node.path);
    }
    selection.paths = selection.paths;

    if (node.type === 'folder' && node.children) {
      node.children.forEach(child => handleSelection(child, selected));
    }

    renderFileTree();
  }

  function toggleFolder(node: FileNode): void {
    if (node.type !== 'folder') return;

    node.expanded = !node.expanded;
    
    if (node.expanded) {
      selection.expanded.add(node.path);
    } else {
      selection.expanded.delete(node.path);
    }
    selection.expanded = selection.expanded;

    renderFileTree();
  }

  async function handleProcess(): Promise<void> {
    if (selection.paths.size === 0) {
      new Notice('No files selected for processing');
      return;
    }

    try {
      uiState.isProcessing = true;
      uiState.lastUpdated = Date.now();
      uiState = { ...uiState };
      
      const settings = settingsService.getSettings();
      const result = await processor.process({
        files: Array.from(selection.paths),
        generateFrontMatter: settings.frontMatter.autoGenerate,
        generateWikilinks: settings.advanced.generateWikilinks
      });

      showProcessingResults(result);
      onClose();
    } catch (error) {
      console.error('Error processing files:', error);
      new Notice(`Error processing files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      uiState.isProcessing = false;
      uiState.lastUpdated = Date.now();
      uiState = { ...uiState };
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

    {#if uiState.isProcessing}
      <div class="processing-status">
        <div class="progress-bar">
          <div class="progress-fill" style="width: {uiState.progress}%"></div>
        </div>
        <div class="status-text">
          {#if uiState.file}
            Processing: {uiState.file}
          {:else}
            {processing.state.state}
          {/if}
        </div>
      </div>
    {/if}

    <footer class="modal-footer">
      <div class="footer-content">
        <span class="selection-count">
          {selection.paths.size} items selected
        </span>
        <div class="button-container">
          <button
            class="mod-cta"
            on:click={handleProcess}
            disabled={uiState.isProcessing || selection.paths.size === 0}
          >
            {uiState.isProcessing ? 'Processing...' : 'Process Selected'}
          </button>
          <button
            class="mod-cancel"
            on:click={onClose}
            disabled={uiState.isProcessing}
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