<!-- BatchProcessorAccordion.svelte -->
<script lang="ts">
  import { writable } from 'svelte/store';
  import { onMount } from 'svelte';
  import BaseAccordion from './BaseAccordion.svelte';
  import { Notice } from 'obsidian';
  import type { BatchProcessorProps, ComponentEvents } from '@type/component.types';
  import type { StoreState, StoreError } from '@type/store.types';
  import { LifecycleState, ValidationResult } from '@type/base.types';
  import BatchProcessorModal from '@components/modals/BatchProcessorModal.svelte';
  import type { AIGenerationService } from '@services/ai/AIGenerationService';
  import type { Setting } from 'obsidian';

  // Props from BatchProcessorProps
  export let title: string;
  export let description: string;
  export let app: BatchProcessorProps['app'];
  export let settingsService: BatchProcessorProps['settingsService'];
  export let aiService: BatchProcessorProps['aiService'];
  export let isOpen = false;

  // Additional props
  export let generationService: AIGenerationService | undefined = undefined;

  // Component events
  export let onChange: ComponentEvents['onChange'];
  export let onBlur: ComponentEvents['onBlur'];
  export let onFocus: ComponentEvents['onFocus'];
  export let onClick: ComponentEvents['onClick'];
  export let onKeyDown: ComponentEvents['onKeyDown'];

  // Align state interface
  interface BatchProcessorState extends StoreState {
      isProcessing: boolean;
      autoGenerate: boolean;
      lifecycle: LifecycleState;
      error?: StoreError;
      validationResult?: ValidationResult;
  }

  // Initialize state with consistent pattern
  const state = writable<BatchProcessorState>({
      isInitialized: false,
      isProcessing: false,
      autoGenerate: false,
      lifecycle: LifecycleState.Uninitialized,
      error: undefined,
      validationResult: undefined,
      lastUpdated: Date.now()
  });

  let modal: BatchProcessorModal | null = null;

  // Reference to settings container
  let settingsContainer: HTMLElement;

  // Type definition for Obsidian Setting callbacks
  type SettingCallback = (setting: Setting) => void;

  onMount(async () => {
      try {
          await initializeComponent();
          state.update(s => ({
              ...s,
              isInitialized: true,
              lifecycle: LifecycleState.Ready
          }));
      } catch (error) {
          console.error('Failed to initialize BatchProcessorAccordion:', error);
          handleError(error);
      }
  });

  // Standardize event handler functions
  async function initializeComponent(): Promise<void> {
      if (!settingsService.isReady()) {
          throw new Error('Settings service not ready');
      }

      const settings = settingsService.getSettings();
      
      if (!settings.frontMatter) {
          throw new Error('Front Matter settings are missing');
      }

      state.update(s => ({
          ...s,
          autoGenerate: settings.frontMatter.autoGenerate,
          isInitialized: true,
          lastUpdated: Date.now()
      }));
  }

  async function handleAutoGenerateToggle(value: boolean): Promise<void> {
      if (!settingsService.isReady()) return;

      try {
          await settingsService.updateNestedSetting('frontMatter', 'autoGenerate', value);
          
          state.update(s => ({ 
              ...s, 
              autoGenerate: value,
              lastUpdated: Date.now()
          }));
          
          new Notice('Auto-generate Front Matter updated.');
          onChange?.(value);
      } catch (error) {
          console.error('🦇 Error updating auto-generate setting:', error);
          handleError(error);
          
          // Revert state on failure
          state.update(s => ({ ...s, autoGenerate: !value }));
      }
  }

  function openBatchProcessorModal(): void {
      if ($state.isProcessing) return;

      try {
          ensureRequiredServices();

          modal = new BatchProcessorModal({
              target: document.body,
              props: {
                  app,
                  settingsService,
                  aiService,
                  generationService,
                  onClose: handleModalClose,
                  onProcessComplete: handleProcessComplete
              }
          });

          state.update(s => ({ ...s, isProcessing: true }));
      } catch (error) {
          console.error('🦇 Error opening Batch Processor modal:', error);
          handleError(error);
      }
  }

  function ensureRequiredServices(): void {
      if (!settingsService.isReady()) {
          throw new Error('Settings service not ready');
      }

      if (!aiService.isReady()) {
          throw new Error('AI service not ready');
      }

      if (!generationService) {
          throw new Error('Generation service not provided');
      }
  }

  function handleModalClose(): void {
      modal?.$destroy();
      modal = null;
      state.update(s => ({ ...s, isProcessing: false }));
  }

  function handleProcessComplete(): void {
      new Notice('Batch processing completed successfully.');
      state.update(s => ({ ...s, isProcessing: false }));
  }

  function handleError(error: unknown): void {
      const message = error instanceof Error ? error.message : 'Unknown error';
      state.update(s => ({
          ...s,
          error: {
              message,
              timestamp: Date.now(),
              source: 'BatchProcessorAccordion'
          },
          lifecycle: LifecycleState.Error
      }));
      new Notice(`Batch Processor Error: ${message}`);
  }

  function runBatchProcessor(): void {
      openBatchProcessorModal();
  }
</script>

<BaseAccordion {title} {description} {isOpen}>
  <!-- Simplify template structure -->
  <div class="batch-processor-settings" bind:this={settingsContainer} role="region" aria-label="Batch Processor Settings" on:click={onClick} on:keydown={onKeyDown} on:focus={onFocus} on:blur={onBlur}>
      {#if $state.error}
          <div class="error-message">
              {$state.error.message}
          </div>
      {/if}

      <div class="settings-form">
          <!-- Auto-generate Setting -->
          <div class="setting-item">
              <div class="setting-item-info">
                  <div class="setting-item-name">Auto-generate Front Matter</div>
                  <div class="setting-item-description">
                      Automatically generate front matter for new or unprocessed notes when you open your vault
                  </div>
              </div>
              <div class="setting-item-control">
                  <div class="checkbox-container">
                      <input
                          type="checkbox"
                          checked={$state.autoGenerate}
                          on:change={(e) => handleAutoGenerateToggle(e.currentTarget.checked)}
                          disabled={!$state.isInitialized}
                      />
                  </div>
              </div>
          </div>

          <!-- Run Button -->
          <div class="setting-item">
              <button
                  class="mod-cta"
                  on:click={runBatchProcessor}
                  disabled={$state.isProcessing || !$state.isInitialized}
              >
                  {$state.isProcessing ? 'Running...' : 'Run Batch Processor'}
              </button>
          </div>
      </div>
  </div>
</BaseAccordion>

<style>
  /* Adjust styling to match others */
  .batch-processor-settings {
      padding: var(--size-4);
      display: flex;
      flex-direction: column;
      gap: var(--size-4);
  }

  .error-message {
      color: var(--color-red);
      font-size: var(--font-ui-small);
      padding: var(--size-2);
      background-color: var(--background-modifier-error);
      border-radius: var(--radius-s);
      margin-bottom: var(--size-2);
  }

  .settings-form {
      display: flex;
      flex-direction: column;
      gap: var(--size-4);
  }

  .setting-item {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: var(--size-2) 0;
      border-top: none !important;
  }

  .setting-item:first-child {
      padding-top: 0;
  }

  .setting-item-info {
      flex: 1;
      margin-right: var(--size-4);
  }

  .setting-item-name {
      font-weight: var(--font-medium);
      margin-bottom: var(--size-1);
  }

  .setting-item-description {
      color: var(--text-muted);
      font-size: var(--font-ui-smaller);
  }

  .setting-item-control {
      flex-shrink: 0;
  }

  button.mod-cta {
      background-color: var(--interactive-accent);
      color: var(--text-on-accent);
      padding: var(--size-2) var(--size-4);
      border-radius: var (--radius-s);
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
</style>