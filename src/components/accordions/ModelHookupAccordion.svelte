//ModelHookupAccordion.svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import BaseAccordion from './BaseAccordion.svelte';
  import { Setting, Notice, ButtonComponent, type App } from 'obsidian';
  import type { ModelHookupProps } from '@type/component.types';
  import { AIProvider } from '@type/ai.types';

  export let app: ModelHookupProps['app'];
  export let settingsService: ModelHookupProps['settingsService'];
  export let aiService: ModelHookupProps['aiService'];

  let containerEl: HTMLElement;
  let isLoading = false;
  let testButtonComponent: ButtonComponent;

  const providerOptions: Record<AIProvider, string> = {
    [AIProvider.OpenAI]: "OpenAI",
    [AIProvider.Anthropic]: "Anthropic",
    [AIProvider.Google]: "Google Gemini",
    [AIProvider.Groq]: "Groq",
    [AIProvider.OpenRouter]: "OpenRouter",
    [AIProvider.LMStudio]: "LM Studio"
  };

  let selectedProvider: AIProvider;
  let apiKey: string;
  let lmStudioPort: number;

  onMount(() => {
    const settings = settingsService.getSettings().aiProvider;
    selectedProvider = settings.selected;
    apiKey = settings.apiKeys[selectedProvider] || '';
    lmStudioPort = settingsService.getSettings().localLMStudio.port;

    setupSettings();
  });

  function setupSettings(): void {
    // Provider Selection
    new Setting(containerEl)
      .setName('AI Provider')
      .setDesc('Select your AI provider')
      .addDropdown(dropdown => dropdown
        .addOptions(providerOptions)
        .setValue(selectedProvider)
        .onChange(async (value) => {
          await handleProviderChange(value as AIProvider);
        }));

    // Conditional Settings based on provider
    if (selectedProvider === AIProvider.LMStudio) {
      new Setting(containerEl)
        .setName('LM Studio Port')
        .setDesc('Port number for your local LM Studio instance')
        .addText(text => text
          .setValue(lmStudioPort.toString())
          .setPlaceholder('3000')
          .onChange(async (value) => {
            await handlePortChange(parseInt(value));
          }));
    } else {
      new Setting(containerEl)
        .setName('API Key')
        .setDesc(`Your API key for ${providerOptions[selectedProvider]}`)
        .addText(text => text
          .setValue(apiKey)
          .setPlaceholder('Enter your API key')
          .setDisabled(isLoading)
          .inputEl.type = 'password');
    }

    // Test Connection Button
    new Setting(containerEl)
      .addButton(button => {
        testButtonComponent = button
          .setButtonText('Test Connection')
          .setCta()
          .onClick(testConnection);
        return button;
      });
  }

  async function handleProviderChange(value: AIProvider): Promise<void> {
    try {
      await settingsService.updateNestedSetting('aiProvider', 'selected', value);
      selectedProvider = value;
      apiKey = settingsService.getSettings().aiProvider.apiKeys[selectedProvider] || '';
      await aiService.reinitialize();
      new Notice(`AI Service reinitialized with provider ${providerOptions[value]}.`);
      
      // Refresh settings UI
      containerEl.empty();
      setupSettings();
    } catch (error) {
      console.error('Failed to reinitialize AI Service:', error);
      new Notice(`Failed to reinitialize AI Service: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async function handleApiKeyChange(value: string): Promise<void> {
    try {
      const currentApiKeys = settingsService.getNestedSetting('aiProvider', 'apiKeys');
      await settingsService.updateNestedSetting(
        'aiProvider',
        'apiKeys',
        { ...currentApiKeys, [selectedProvider]: value }
      );
      apiKey = value;
    } catch (error) {
      console.error('Error updating API key:', error);
      new Notice(`Failed to update API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async function handlePortChange(value: number): Promise<void> {
    try {
      await settingsService.updateNestedSetting('localLMStudio', 'port', value);
      lmStudioPort = value;
    } catch (error) {
      console.error('Error updating port:', error);
      new Notice(`Failed to update port: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async function testConnection(): Promise<void> {
    if (isLoading) return;
    
    try {
      isLoading = true;
      testButtonComponent.setButtonText('Testing...').setDisabled(true);
      
      const result = await aiService.testConnection(selectedProvider);
      const providerName = providerOptions[selectedProvider];
      
      new Notice(
        result 
          ? `Successfully connected to ${providerName}` 
          : `Failed to connect to ${providerName}. Please check your settings.`
      );
    } catch (error) {
      console.error('Error testing connection:', error);
      new Notice(`Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      isLoading = false;
      testButtonComponent.setButtonText('Test Connection').setDisabled(false);
    }
  }
</script>

<BaseAccordion
  title="🔌 Model Hookup"
  description="Configure AI providers and models"
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