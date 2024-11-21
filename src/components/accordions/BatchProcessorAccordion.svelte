//BatchProcessorAccordion.svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import BaseAccordion from './BaseAccordion.svelte';
  import BatchProcessorModal from '@components/modals/BatchProcessorModal.svelte';
  import { Notice, ButtonComponent } from 'obsidian';
  import type { BatchProcessorProps } from '@type/component.types';
  
  export let app: BatchProcessorProps['app'];
  export let settingsService: BatchProcessorProps['settingsService'];
  export let aiService: BatchProcessorProps['aiService'];

  let autoGenerate = false;
  let isProcessing = false;
  let modal: BatchProcessorModal | null = null;
  let buttonEl: HTMLElement;

  onMount(() => {
    autoGenerate = settingsService.getSettings().frontMatter.autoGenerate;
    
    // Initialize Obsidian button component
    new ButtonComponent(buttonEl)
      .setButtonText("Run Batch Processor")
      .setClass("mod-cta")
      .onClick(openBatchProcessor);
      
    return () => {
      modal?.$destroy();
    };
  });

  async function handleAutoGenerateToggle(value: boolean): Promise<void> {
    try {
      await settingsService.updateNestedSetting('frontMatter', 'autoGenerate', value);
      autoGenerate = value;
      new Notice("Auto-generate Front Matter updated.");
    } catch (error) {
      console.error('Error updating auto-generate setting:', error);
      new Notice(`Failed to update setting: ${error instanceof Error ? error.message : 'Unknown error'}`);
      autoGenerate = !value;
    }
  }

  function openBatchProcessor(): void {
    try {
      if (isProcessing) return;
      
      isProcessing = true;
      buttonEl.querySelector('.setting-button')?.addClass('is-loading');
      
      modal = new BatchProcessorModal({
        target: app.workspace.containerEl,
        props: {
          app,
          settingsService,
          onClose: () => {
            isProcessing = false;
            buttonEl.querySelector('.setting-button')?.removeClass('is-loading');
          }
        }
      });
      
      // Handle modal close
      const originalClose = modal.onClose.bind(modal);
      modal.onClose = () => {
        originalClose();
        isProcessing = false;
        buttonEl.querySelector('.setting-button')?.removeClass('is-loading');
      };
    } catch (error) {
      console.error('Error opening batch processor:', error);
      new Notice(`Failed to open batch processor: ${error instanceof Error ? error.message : 'Unknown error'}`);
      isProcessing = false;
      buttonEl.querySelector('.setting-button')?.removeClass('is-loading');
    }
  }
</script>

<BaseAccordion
  title="🔄 Batch Processor"
  description="Process multiple files to generate front matter and wikilinks."
  {app}
  {settingsService}
  {aiService}
>
  <div class="batch-processor-container">
    <div class="setting-item">
      <div class="setting-item-info">
        <div class="setting-item-name">Auto-generate Front Matter</div>
        <div class="setting-item-description">
          Automatically generate front matter for new or unprocessed notes when you open your vault.
        </div>
      </div>
      <div class="setting-item-control">
        <div class="checkbox-container">
          <input
            type="checkbox"
            class="checkbox"
            bind:checked={autoGenerate}
            on:change={(e) => handleAutoGenerateToggle(e.currentTarget.checked)}
          />
        </div>
      </div>
    </div>

    <div class="setting-item">
      <div bind:this={buttonEl}></div>
    </div>
  </div>
</BaseAccordion>

<style>
  .batch-processor-container {
    padding: var(--size-2);
  }

  .setting-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: var(--size-2) 0;
    border-top: 1px solid var(--background-modifier-border);
  }

  .setting-item:first-child {
    border-top: none;
  }

  .setting-item-info {
    flex: 1;
    margin-right: var(--size-4);
  }

  .setting-item-name {
    font-weight: var(--font-medium);
    color: var(--text-normal);
    margin-bottom: var(--size-1);
  }

  .setting-item-description {
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
  }

  :global(.setting-button.is-loading) {
    opacity: 0.7;
    pointer-events: none;
  }
</style>