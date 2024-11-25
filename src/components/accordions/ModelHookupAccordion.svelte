<!-- ModelHookupAccordion.svelte -->
<script lang="ts">
  import { writable } from 'svelte/store';
  import { Setting, Notice, DropdownComponent, TextComponent, ButtonComponent } from 'obsidian';
  import BaseAccordion from './BaseAccordion.svelte';
  import type { ModelHookupProps } from '@type/component.types';
  import { AIProvider } from '@type/ai.types';
  import { AIModelMap, AIModelUtils } from '@type/aiModels';

  export let title: string;
  export let description: string;
  export let app: ModelHookupProps['app'];
  export let settingsService: ModelHookupProps['settingsService'];
  export let aiService: ModelHookupProps['aiService'];
  export let isOpen = false;

  const state = writable({
      selectedProvider: AIProvider.OpenAI,
      selectedModel: '',
      apiKey: '',
      isLoading: false
  });

  let contentEl: HTMLElement;

  $: if (contentEl && $state) {
      // Clear existing settings
      contentEl.empty();
      
      // Provider Setting
      new Setting(contentEl)
          .setName('AI Provider')
          .setDesc('Choose your AI service provider')
          .addDropdown(dropdown => {
              Object.values(AIProvider).forEach(provider => {
                  dropdown.addOption(provider, provider);
              });
              dropdown.setValue($state.selectedProvider);
              dropdown.onChange(async (value) => {
                  await handleProviderChange(value as AIProvider);
              });
              return dropdown;
          });

      // Model Setting
      new Setting(contentEl)
          .setName('AI Model')
          .setDesc('Select the AI model to use')
          .addDropdown(dropdown => {
              const models = AIModelUtils.getModelsForProvider($state.selectedProvider);
              models.forEach(model => {
                  dropdown.addOption(model.apiName, model.name);
              });
              dropdown.setValue($state.selectedModel || models[0]?.apiName);
              dropdown.onChange(async (value) => {
                  await handleModelChange(value);
              });
              return dropdown;
          });

      // API Key Setting
      new Setting(contentEl)
          .setName('API Key')
          .setDesc('Enter your API key for the selected provider')
          .addText(text => {
              text.setPlaceholder('Enter API key')
                  .setValue($state.apiKey)
                  .onChange(async (value) => {
                      await handleApiKeyChange(value);
                  });
              text.inputEl.type = 'password';
              return text;
          });

      // Test Connection Button
      new Setting(contentEl)
          .addButton(button => {
              button.setButtonText($state.isLoading ? 'Testing...' : 'Test Connection')
                  .setCta()
                  .setDisabled($state.isLoading || !$state.apiKey)
                  .onClick(handleTestConnection);
              return button;
          });
  }

  async function handleProviderChange(provider: AIProvider): Promise<void> {
      state.update(s => ({ ...s, selectedProvider: provider }));
      
      // Update settings
      const settings = settingsService.getSettings();
      await settingsService.updateNestedSetting('aiProvider', 'selected', provider);
      
      // Load provider's API key if exists
      const apiKey = settings.aiProvider.apiKeys[provider] || '';
      state.update(s => ({ ...s, apiKey }));
  }

  async function handleModelChange(modelApiName: string): Promise<void> {
      state.update(s => ({ ...s, selectedModel: modelApiName }));
      
      // Update settings
      const settings = settingsService.getSettings();
      await settingsService.updateNestedSetting('aiProvider', 'selectedModels', {
          ...settings.aiProvider.selectedModels,
          [$state.selectedProvider]: modelApiName
      });
  }

  async function handleApiKeyChange(value: string): Promise<void> {
      state.update(s => ({ ...s, apiKey: value }));
      
      // Update settings
      const settings = settingsService.getSettings();
      await settingsService.updateNestedSetting('aiProvider', 'apiKeys', {
          ...settings.aiProvider.apiKeys,
          [$state.selectedProvider]: value
      });
  }

  async function handleTestConnection(): Promise<void> {
      if ($state.isLoading) return;
      
      state.update(s => ({ ...s, isLoading: true }));
      
      try {
          const result = await aiService.testConnection($state.selectedProvider);
          const model = AIModelUtils.getModelByApiName($state.selectedModel);
          const modelName = model?.name || 'selected model';
          
          new Notice(
              result
                  ? `Successfully connected to ${modelName}`
                  : `Failed to connect to ${modelName}. Please check your settings.`
          );
      } catch (error) {
          console.error('🦇 Error testing connection:', error);
          new Notice(`Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
          state.update(s => ({ ...s, isLoading: false }));
      }
  }
</script>

<BaseAccordion {title} {description} {isOpen}>
    <div class="model-hookup-content" bind:this={contentEl}>
        <!-- Obsidian Settings will be mounted here -->
    </div>
</BaseAccordion>

<style>
    .model-hookup-content {
        padding: var(--size-4);
    }

    /* Obsidian's Setting components will handle the rest of the styling */
</style>