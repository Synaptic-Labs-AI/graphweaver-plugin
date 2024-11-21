//AdvancedAccordion.svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import BaseAccordion from './BaseAccordion.svelte';
  import { Notice, Setting, type App } from 'obsidian';
  import type { ServiceProps } from '@type/component.types';
  
  export let app: ServiceProps['app'];
  export let settingsService: ServiceProps['settingsService'];
  export let aiService: ServiceProps['aiService'];

  let containerEl: HTMLElement;
  let settings = {
    generateWikilinks: false,
    temperature: 0.7,
    maxTokens: 2048
  };

  onMount(() => {
    const currentSettings = settingsService.getSettings().advanced;
    settings = {
      generateWikilinks: currentSettings.generateWikilinks,
      temperature: currentSettings.temperature,
      maxTokens: currentSettings.maxTokens
    };

    // Create settings using Obsidian's Setting class
    new Setting(containerEl)
      .setName('Generate Wikilinks')
      .setDesc('Automatically generate wikilinks for your notes.')
      .addToggle(toggle => toggle
        .setValue(settings.generateWikilinks)
        .onChange(async (value) => {
          await handleWikilinksUpdate(value);
        }));

    new Setting(containerEl)
      .setName('Temperature')
      .setDesc('Set the temperature for AI responses (0.0 - 1.0).')
      .addSlider(slider => slider
        .setLimits(0, 1, 0.1)
        .setValue(settings.temperature)
        .setDynamicTooltip()
        .onChange(async (value) => {
          await handleTemperatureUpdate(value);
        }));

    new Setting(containerEl)
      .setName('Max Tokens')
      .setDesc('Set the maximum number of tokens for AI responses.')
      .addText(text => text
        .setValue(settings.maxTokens.toString())
        .setPlaceholder('2048')
        .onChange(async (value) => {
          await handleMaxTokensUpdate(value);
        }));
  });

  async function handleWikilinksUpdate(value: boolean): Promise<void> {
    try {
      await settingsService.updateNestedSetting('advanced', 'generateWikilinks', value);
      settings.generateWikilinks = value;
    } catch (error) {
      console.error('Error updating wikilinks setting:', error);
      new Notice(`Failed to update setting: ${error instanceof Error ? error.message : 'Unknown error'}`);
      settings.generateWikilinks = !value;
    }
  }

  async function handleTemperatureUpdate(value: number): Promise<void> {
    try {
      if (value < 0 || value > 1) {
        throw new Error('Temperature must be between 0 and 1');
      }
      await settingsService.updateNestedSetting('advanced', 'temperature', value);
      settings.temperature = value;
    } catch (error) {
      console.error('Error updating temperature:', error);
      new Notice(`Failed to update temperature: ${error instanceof Error ? error.message : 'Unknown error'}`);
      settings.temperature = settingsService.getSettings().advanced.temperature;
    }
  }

  async function handleMaxTokensUpdate(value: string): Promise<void> {
    try {
      const tokens = parseInt(value);
      if (isNaN(tokens) || tokens <= 0) {
        throw new Error('Max tokens must be a positive number');
      }
      await settingsService.updateNestedSetting('advanced', 'maxTokens', tokens);
      settings.maxTokens = tokens;
    } catch (error) {
      console.error('Error updating max tokens:', error);
      new Notice(`Failed to update max tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
      settings.maxTokens = settingsService.getSettings().advanced.maxTokens;
    }
  }
</script>

<BaseAccordion
  title="⚙️ Advanced"
  description="Configuration options for the plugin."
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