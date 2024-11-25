<!-- TagManagerAccordion.svelte -->
<script lang="ts">
  import { onMount, getContext } from 'svelte';
  import { writable } from 'svelte/store';
  import { Setting, Notice } from 'obsidian';
  import BaseAccordion from './BaseAccordion.svelte';
  import type { Tag, PropertyType } from '@type/metadata.types';
  import EditTagsModal from '../modals/EditTagsModal.svelte';
  import type { AccordionProps } from '@type/component.types';
  import { TagManagementService } from '@services/tags/TagManagementService';
  import type GraphWeaverPlugin from 'main';

  export let title: string;
  export let description: string;
  export let app: AccordionProps['app'];
  export let settingsService: AccordionProps['settingsService'];
  export let isOpen = false;
  export let tagManagementService: TagManagementService | undefined = undefined;

  const settingsStore = getContext('settingsStore');

  const tagState = writable({
      isAddingTag: false,
      isServiceReady: false,
      formData: {
          name: '',
          description: '',
          type: 'string' as PropertyType,
          required: false,
          multipleValues: false
      },
      validationErrors: {} as Record<string, string>,
      currentTags: [] as Tag[]
  });

  const propertyTypes: Record<PropertyType, { label: string; description: string }> = {
      'string': { label: 'Text', description: 'Plain text value' },
      'number': { label: 'Number', description: 'Numeric value' },
      'boolean': { label: 'True/False', description: 'Boolean value' },
      'array': { label: 'List', description: 'Multiple values' },
      'date': { label: 'Date', description: 'Date/time value' }
  };

  let contentEl: HTMLElement;

  onMount(async () => {
      try {
          if (!app) {
              throw new Error('App instance not available');
          }

          if (!tagManagementService) {
              const plugin = getContext<GraphWeaverPlugin>('plugin');
              tagManagementService = new TagManagementService(app, plugin);
              await tagManagementService.initialize();
          }

          const currentTags = await tagManagementService.getTags();
          tagState.update(s => ({ 
              ...s, 
              isServiceReady: true,
              currentTags
          }));
      } catch (error) {
          console.error('🦇 Failed to initialize tag service:', error);
          new Notice('Failed to initialize tag management');
      }
  });

  $: if (contentEl && $tagState) {
      contentEl.empty();

      new Setting(contentEl)
          .setHeading()
          .setName('Add New Tag');

      // Tag Name
      new Setting(contentEl)
          .setName('Tag Name')
          .setDesc('Enter a name for the tag')
          .addText(text => {
              text.setPlaceholder('Enter tag name')
                  .setValue($tagState.formData.name)
                  .onChange(value => handleFieldChange('name', value));
              
              if ($tagState.validationErrors.name) {
                  text.inputEl.addClass('has-error');
                  const errorEl = contentEl.createEl('div', {
                      cls: 'setting-item-error',
                      text: $tagState.validationErrors.name
                  });
                  text.inputEl.parentElement?.appendChild(errorEl);
              }
              return text;
          });

      // Tag Description
      new Setting(contentEl)
          .setName('Description')
          .setDesc('Describe what this tag is used for')
          .addTextArea(text => {
              text.setPlaceholder('Enter tag description')
                  .setValue($tagState.formData.description)
                  .onChange(value => handleFieldChange('description', value));
              
              text.inputEl.rows = 4;
              
              if ($tagState.validationErrors.description) {
                  text.inputEl.addClass('has-error');
                  const errorEl = contentEl.createEl('div', {
                      cls: 'setting-item-error',
                      text: $tagState.validationErrors.description
                  });
                  text.inputEl.parentElement?.appendChild(errorEl);
              }
              return text;
          });

      // Tag Type
      new Setting(contentEl)
          .setName('Type')
          .setDesc('Select the type of data this tag will store')
          .addDropdown(dropdown => {
              Object.entries(propertyTypes).forEach(([value, { label }]) => {
                  dropdown.addOption(value, label);
              });
              dropdown.setValue($tagState.formData.type);
              dropdown.onChange(value => handleFieldChange('type', value));
              return dropdown;
          });

      // Required Toggle
      new Setting(contentEl)
          .setName('Required')
          .setDesc('Should this tag be required?')
          .addToggle(toggle => {
              toggle.setValue($tagState.formData.required)
                  .onChange(value => {
                      tagState.update(s => ({
                          ...s,
                          formData: { ...s.formData, required: value }
                      }));
                  });
              return toggle;
          });

      // Multiple Values Toggle
      new Setting(contentEl)
          .setName('Multiple Values')
          .setDesc('Can this tag have multiple values?')
          .addToggle(toggle => {
              toggle.setValue($tagState.formData.multipleValues)
                  .onChange(value => {
                      tagState.update(s => ({
                          ...s,
                          formData: { ...s.formData, multipleValues: value }
                      }));
                  });
              return toggle;
          });

      // Buttons
      new Setting(contentEl)
          .addButton(button => {
              button.setButtonText($tagState.isAddingTag ? 'Adding...' : 'Add Tag')
                  .setCta()
                  .setDisabled(
                      $tagState.isAddingTag || 
                      !$tagState.isServiceReady || 
                      Object.keys($tagState.validationErrors).length > 0
                  )
                  .onClick(addTag);
              return button;
          })
          .addButton(button => {
              button.setButtonText('Edit Tags')
                  .setDisabled(!$tagState.isServiceReady)
                  .onClick(openEditModal);
              return button;
          });
  }

  function validateField(field: string, value: any): string | null {
      switch (field) {
          case 'name':
              if (!value?.trim()) return 'Tag name is required';
              if (value.trim().length < 2) return 'Tag name must be at least 2 characters';
              if (!/^[a-zA-Z0-9_-]+$/.test(value.trim())) 
                  return 'Tag name can only contain letters, numbers, dashes, and underscores';
              if ($tagState.currentTags.some(t => t.name.toLowerCase() === value.trim().toLowerCase()))
                  return 'Tag name already exists';
              break;
          case 'description':
              if (!value?.trim()) return 'Tag description is required';
              if (value.trim().length < 5) return 'Tag description must be at least 5 characters';
              break;
          case 'type':
              if (!value) return 'Tag type is required';
              if (!Object.keys(propertyTypes).includes(value)) return 'Invalid tag type';
              break;
      }
      return null;
  }

  function handleFieldChange(field: string, value: any): void {
      tagState.update(s => {
          const error = validateField(field, value);
          return {
              ...s,
              formData: { ...s.formData, [field]: value },
              validationErrors: {
                  ...s.validationErrors,
                  [field]: error || ''
              }
          };
      });
  }

  async function addTag(): Promise<void> {
      if ($tagState.isAddingTag || !$tagState.isServiceReady || !tagManagementService) return;

      try {
          tagState.update(s => ({ ...s, isAddingTag: true }));

          const form = $tagState.formData;
          const newTag: Tag = {
              name: form.name.trim(),
              description: form.description.trim(),
              type: form.type,
              required: form.required,
              multipleValues: form.multipleValues
          };

          await tagManagementService.updateTags([newTag]);
          
          tagState.update(s => ({
              ...s,
              currentTags: [...s.currentTags, newTag]
          }));

          new Notice(`Tag "${newTag.name}" added successfully!`);
          resetForm();
      } catch (error) {
          console.error('🦇 Failed to add tag:', error);
          new Notice(`Error adding tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
          tagState.update(s => ({ ...s, isAddingTag: false }));
      }
  }

  async function openEditModal(): Promise<void> {
      try {
          if (!$tagState.isServiceReady || !tagManagementService) {
              throw new Error('Tag service not ready');
          }

          let modalInstance = new EditTagsModal({
              target: document.body,
              props: {
                  tags: $tagState.currentTags,
                  onSubmit: handleTagsUpdate,
                  onClose: () => modalInstance.$destroy()
              }
          });
      } catch (error) {
          console.error('🦇 Error opening edit modal:', error);
          new Notice(`Failed to open edit modal: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
  }

  async function handleTagsUpdate(updatedTags: Tag[]): Promise<void> {
      if (!tagManagementService) return;

      try {
          await tagManagementService.updateTags(updatedTags);
          tagState.update(s => ({ ...s, currentTags: updatedTags }));
          new Notice('Tags updated successfully');
      } catch (error) {
          console.error('🦇 Error updating tags:', error);
          new Notice(`Failed to update tags: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
  }

  function resetForm(): void {
      tagState.update(s => ({
          ...s,
          formData: {
              name: '',
              description: '',
              type: 'string',
              required: false,
              multipleValues: false
          },
          validationErrors: {}
      }));
  }
</script>

<BaseAccordion {title} {description} {isOpen}>
  <div class="tag-manager-content" bind:this={contentEl}>
      <!-- Obsidian Settings will be mounted here -->
  </div>
</BaseAccordion>

<style>
  .tag-manager-content {
      padding: var(--size-4);
  }

  :global(.setting-item-error) {
      color: var(--color-red);
      font-size: var(--font-ui-smaller);
      margin-top: var(--size-1);
  }

  :global(.has-error) {
      border-color: var(--color-red) !important;
  }

  :global(.setting-item:first-child) {
      padding-top: 0;
  }

  :global(.setting-item:last-child) {
      padding-bottom: 0;
      border-bottom: none;
  }
</style>