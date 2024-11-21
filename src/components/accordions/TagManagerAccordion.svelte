//TagManagementAccordion.svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import BaseAccordion from './BaseAccordion.svelte';
  import { Setting, Notice, type App } from 'obsidian';
  import type { 
    Tag, 
    MetadataValidationResult,
    TagManagerState 
  } from '@type/metadata.types';
  import EditTagsModal from '../modals/EditTagsModal.svelte';
  import { SettingsService } from '@services/SettingsService';
  import { AIService } from '@services/ai/AIService';

  export let app: App;
  export let settingsService: SettingsService;
  export let aiService: AIService;

  let containerEl: HTMLElement;
  let isAddingTag = false;
  let formData: Partial<Tag> = {
    name: '',
    description: '',
    type: 'string',
    required: false,
    multipleValues: false
  };

  onMount(() => {
    setupTagForm();
  });

  function setupTagForm(): void {
    // Tag Name
    new Setting(containerEl)
      .setName('Tag Name')
      .setDesc('The name of the tag')
      .addText(text => text
        .setValue(formData.name || '')
        .setPlaceholder('Enter tag name')
        .onChange(value => formData.name = value));

    // Tag Description
    new Setting(containerEl)
      .setName('Tag Description')
      .setDesc('A description of what the tag represents')
      .addTextArea(text => text
        .setValue(formData.description || '')
        .setPlaceholder('Enter tag description')
        .onChange(value => formData.description = value));

    // Action Buttons
    new Setting(containerEl)
      .addButton(button => button
        .setButtonText(isAddingTag ? 'Adding...' : 'Add Tag')
        .setCta()
        .setDisabled(isAddingTag)
        .onClick(() => addTag()))
      .addButton(button => button
        .setButtonText('Edit Tags')
        .onClick(() => openEditModal()));
  }

  function validateTag(): MetadataValidationResult {
    const errors: string[] = [];
    const invalidFields: string[] = [];

    if (!formData.name?.trim()) {
      errors.push('Tag name is required');
      invalidFields.push('name');
    } else if (formData.name.trim().length < 2) {
      errors.push('Tag name must be at least 2 characters');
      invalidFields.push('name');
    }

    if (!formData.description?.trim()) {
      errors.push('Tag description is required');
      invalidFields.push('description');
    } else if (formData.description.trim().length < 10) {
      errors.push('Tag description must be at least 10 characters');
      invalidFields.push('description');
    }

    return {
      isValid: errors.length === 0,
      errors,
      invalidFields
    };
  }

  async function addTag(): Promise<void> {
    if (isAddingTag) return;

    try {
      isAddingTag = true;
      const validation = validateTag();

      if (!validation.isValid) {
        throw new Error(validation.errors?.[0] || 'Validation failed');
      }

      const newTag: Tag = {
        name: formData.name!.trim(),
        description: formData.description!.trim(),
        type: 'string',
        required: false,
        multipleValues: false
      };

      const currentState = getCurrentTagState();
      const updatedState = {
        ...currentState,
        customTags: [...currentState.customTags, newTag],
        lastUpdated: Date.now()
      };

      await updateTagState(updatedState);
      resetForm();
      new Notice(`Tag "${newTag.name}" added successfully`);

      // Refresh the form
      containerEl.empty();
      setupTagForm();
    } catch (error) {
      console.error('Error adding tag:', error);
      new Notice(`Failed to add tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      isAddingTag = false;
    }
  }

  function getCurrentTagState(): TagManagerState {
    const settings = settingsService.getSettings();
    return {
      customTags: settings.tags.customTags
    };
  }

  async function updateTagState(state: TagManagerState): Promise<void> {
    const settings = settingsService.getSettings();
    await settingsService.updateSettings({
      ...settings,
      tags: {
        ...settings.tags,
        customTags: state.customTags
      }
    });
  }

  function resetForm(): void {
    formData = {
      name: '',
      description: '',
      type: 'string',
      required: false,
      multipleValues: false
    };
  }

  function openEditModal(): void {
    try {
      const currentState = getCurrentTagState();
      
      const modal = new EditTagsModal({
        target: document.body,
        props: {
          app,
          tags: currentState.customTags,
          onSubmit: handleTagsUpdate,
          onClose: () => modal.$destroy()
        }
      });
    } catch (error) {
      console.error('Error opening edit modal:', error);
      new Notice(`Failed to open edit modal: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async function handleTagsUpdate(updatedTags: Tag[]): Promise<void> {
    try {
      await updateTagState({
        customTags: updatedTags
      });
      new Notice("Tags updated successfully");
    } catch (error) {
      console.error('Error updating tags:', error);
      new Notice(`Failed to update tags: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
</script>

<BaseAccordion
  title="🏷️ Tag Management"
  description="Create and manage custom tags for your notes."
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

  :global(.setting-item textarea) {
    min-height: 100px;
    resize: vertical;
  }
</style>