<!-- AdvancedAccordion.svelte -->
<script lang="ts">
  import { writable } from 'svelte/store';
  import { onMount } from 'svelte';
  import BaseAccordion from './BaseAccordion.svelte';
  import { Notice, TFile, App } from 'obsidian';
  import type { ComponentEvents } from '@type/component.types';
  import { StoreState } from '@type/store.types';
  import type { StoreError } from '@type/store.types';
  import type { ValidationResult } from '@type/base.types';
  import { LifecycleState } from '@type/base.types';
  import type { GeneratedNote } from '@type/ai.types';
  import { SettingsService } from '@services/SettingsService';
  import { AIService } from '@services/ai/AIService';

  // Props
  export let title: string;
  export let description: string;
  export let app: App;
  export let settingsService: SettingsService;
  export let aiService: AIService;
  export let isOpen = false;

  // Component events
  export let onChange: ComponentEvents['onChange'];
  export let onBlur: ComponentEvents['onBlur'];
  export let onFocus: ComponentEvents['onFocus'];
  export let onClick: ComponentEvents['onClick'];
  export let onKeyDown: ComponentEvents['onKeyDown'];

  interface AdvancedSettings {
      generateWikilinks: boolean;
      temperature: number;
      maxTokens: number;
  }

  const DEFAULT_SETTINGS: AdvancedSettings = {
      generateWikilinks: false,
      temperature: 0.7,
      maxTokens: 2048
  };

  // Align state interface
  interface AdvancedState extends StoreState {
      settings: AdvancedSettings;
      isGenerating: boolean;
      lifecycle: LifecycleState;
      error?: StoreError; // Adjusted error property
      validationResult?: ValidationResult;
      generatedNotes: number;
  }

  // Initialize state with consistent pattern
  const state = writable<AdvancedState>({
      isInitialized: false,
      settings: { ...DEFAULT_SETTINGS },
      isGenerating: false,
      lifecycle: LifecycleState.Uninitialized,
      error: undefined,
      validationResult: undefined,
      generatedNotes: 0,
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
          console.error('Failed to initialize AdvancedAccordion:', error);
          handleError(error);
      }
  });

  // Standardize event handler functions
  async function initializeComponent(): Promise<void> {
      if (!settingsService.isReady()) {
          throw new Error('Settings service not ready');
      }

      const currentSettings = settingsService.getSettings().advanced;
      
      state.update(s => ({
          ...s,
          settings: {
              generateWikilinks: currentSettings.generateWikilinks,
              temperature: currentSettings.temperature,
              maxTokens: currentSettings.maxTokens
          },
          lastUpdated: Date.now()
      }));
  }

  async function handleSettingChange(key: keyof AdvancedSettings, value: any): Promise<void> {
      try {
          // Validate settings
          validateSetting(key, value);

          // Update service
          await settingsService.updateNestedSetting('advanced', key, value);

          // Update local state
          state.update(s => ({
              ...s,
              settings: {
                  ...s.settings,
                  [key]: value
              },
              lastUpdated: Date.now()
          }));

          new Notice(`${key.charAt(0).toUpperCase() + key.slice(1)} setting updated.`);
          onChange?.(value);
      } catch (error) {
          console.error(`🦇 Error updating ${key} setting:`, error);
          handleError(error);
          
          // Revert to saved value
          state.update(s => ({
              ...s,
              settings: {
                  ...s.settings,
                  [key]: settingsService.getSettings().advanced[key]
              }
          }));
      }
  }

  function validateSetting(key: keyof AdvancedSettings, value: any): void {
      switch (key) {
          case 'temperature':
              if (value < 0 || value > 1) {
                  throw new Error('Temperature must be between 0 and 1');
              }
              break;
          case 'maxTokens':
              if (typeof value === 'number' && (isNaN(value) || value <= 0)) {
                  throw new Error('Max tokens must be a positive number');
              }
              break;
      }
  }

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
              $state.settings.generateWikilinks.toString()
          );

          if (result?.generatedNotes?.length) {
              await createGeneratedNotes(result.generatedNotes);
              
              state.update(s => ({
                  ...s,
                  generatedNotes: result.generatedNotes.length,
                  lastUpdated: Date.now()
              }));

              new Notice(`Generated ${result.generatedNotes.length} new notes!`);
          } else {
              new Notice('No notes were generated.');
          }
      } catch (error) {
          console.error('🦇 Error generating knowledge bloom:', error);
          handleError(error);
      } finally {
          state.update(s => ({ ...s, isGenerating: false }));
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
              console.error(`🦇 Error creating/updating note ${filePath}:`, error);
              new Notice(`Failed to create/update note "${note.title}"`);
          }
      }
  }

  function handleError(error: unknown): void {
      const message = error instanceof Error ? error.message : 'Unknown error';
      state.update(s => ({
          ...s,
          error: {
              message,
              timestamp: Date.now(),
              source: 'AdvancedAccordion'
          },
          lifecycle: LifecycleState.Error
      }));
      new Notice(`Advanced Settings Error: ${message}`);
  }
</script>

<BaseAccordion {title} {description} {isOpen}>
  <!-- Simplify template structure -->
  <form
      class="advanced-settings"
      on:submit|preventDefault={handleGenerateKnowledgeBloom}
  >
      {#if $state.error}
          <div class="error-message" role="alert">
              {$state.error.message}
          </div>
      {/if}

      <!-- Generate Wikilinks -->
      <div class="setting-item">
          <div class="setting-item-info">
              <label for="wikilinks-toggle" class="setting-item-name">Generate Wikilinks</label>
              <div class="setting-item-description">Automatically generate wikilinks for your notes</div>
          </div>
          <div class="setting-item-control">
              <input
                  id="wikilinks-toggle"
                  type="checkbox"
                  bind:checked={$state.settings.generateWikilinks}
                  on:change={(e) => handleSettingChange('generateWikilinks', e.currentTarget.checked)}
                  disabled={!$state.isInitialized}
              />
          </div>
      </div>

      <!-- Temperature -->
      <div class="setting-item">
          <div class="setting-item-info">
              <label for="temperature-slider" class="setting-item-name">Temperature</label>
              <div class="setting-item-description">Set the temperature for AI responses (0.0 - 1.0)</div>
          </div>
          <div class="setting-item-control">
              <input
                  id="temperature-slider"
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  bind:value={$state.settings.temperature}
                  on:change={(e) => handleSettingChange('temperature', parseFloat(e.currentTarget.value))}
                  disabled={!$state.isInitialized}
              />
              <span class="value-display">{$state.settings.temperature.toFixed(1)}</span>
          </div>
      </div>

      <!-- Max Tokens -->
      <div class="setting-item">
          <div class="setting-item-info">
              <label for="max-tokens-input" class="setting-item-name">Max Tokens</label>
              <div class="setting-item-description">Set the maximum number of tokens for AI responses</div>
          </div>
          <div class="setting-item-control">
              <input
                  id="max-tokens-input"
                  type="number"
                  min="1"
                  bind:value={$state.settings.maxTokens}
                  on:change={(e) => handleSettingChange('maxTokens', parseInt(e.currentTarget.value))}
                  placeholder="2048"
                  disabled={!$state.isInitialized}
              />
          </div>
      </div>

      <!-- Generate Button -->
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

      {#if $state.generatedNotes > 0}
          <div class="status-message">
              Last generation created {$state.generatedNotes} new notes.
          </div>
      {/if}
  </form>
</BaseAccordion>

<style>
  /* Adjust styling to match others */
  .advanced-settings {
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
      display: flex;
      align-items: center;
      gap: var(--size-2);
  }

  input[type="range"] {
      width: 150px;
  }

  input[type="number"] {
      width: 100px;
      padding: var(--size-2);
      border: 1px solid var(--background-modifier-border);
      border-radius: var(--radius-s);
      background: var(--background-primary);
      color: var(--text-normal);
  }

  .value-display {
      min-width: 2.5em;
      text-align: right;
      color: var (--text-muted);
  }

  .status-message {
      color: var(--text-muted);
      font-size: var(--font-ui-small);
      text-align: center;
      padding: var(--size-2);
      background-color: var(--background-secondary);
      border-radius: var(--radius-s);
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

  input:disabled {
      opacity: 0.5;
      cursor: not-allowed;
  }
</style>