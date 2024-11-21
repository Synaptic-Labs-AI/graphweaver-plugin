//PropertyManagementAccordion.svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import BaseAccordion from './BaseAccordion.svelte';
  import { Setting, Notice, type App } from 'obsidian';
  import type { 
    PropertyTag, 
    PropertyType,
    MetadataField,
    MetadataValidationResult,
    PropertyManagerState,
    PropertyValueType
  } from '@type/metadata.types';
  import EditPropertiesModal from '../modals/EditPropertiesModal.svelte';
  import { SettingsService } from '@services/SettingsService';
  import { AIService } from '@services/ai/AIService';

  export let app: App;
  export let settingsService: SettingsService;
  export let aiService: AIService;

  let containerEl: HTMLElement;
  let isAddingProperty = false;
  let formData: Partial<PropertyTag> = {
    name: '',
    description: '',
    type: 'string',
    required: false,
    multipleValues: false
  };

  // Using type mapping for better type safety
  const propertyTypes: Record<PropertyType, { label: string; description: string }> = {
    'string': { label: 'Text', description: 'Plain text values' },
    'number': { label: 'Number', description: 'Numeric values' },
    'boolean': { label: 'True/False', description: 'Boolean values' },
    'array': { label: 'List', description: 'Multiple values in a list' },
    'date': { label: 'Date', description: 'Date and time values' }
  };

  onMount(() => {
    setupPropertyForm();
  });

  function setupPropertyForm(): void {
    // Property Name
    new Setting(containerEl)
      .setName('Property Name')
      .setDesc('The name of the property')
      .addText(text => text
        .setValue(formData.name || '')
        .setPlaceholder('Enter property name')
        .onChange(value => formData.name = value));

    // Property Description
    new Setting(containerEl)
      .setName('Property Description')
      .setDesc('A description of what the property represents')
      .addTextArea(text => text
        .setValue(formData.description || '')
        .setPlaceholder('Enter property description')
        .onChange(value => formData.description = value));

    // Property Type
    new Setting(containerEl)
      .setName('Property Type')
      .setDesc('The data type of the property')
      .addDropdown(dropdown => dropdown
        .addOptions(Object.fromEntries(
          Object.entries(propertyTypes).map(([value, { label }]) => [value, label])
        ))
        .setValue(formData.type || 'string')
        .onChange(value => formData.type = value as PropertyType));

    // Required Toggle
    new Setting(containerEl)
      .setName('Required')
      .setDesc('Make this property required')
      .addToggle(toggle => toggle
        .setValue(formData.required || false)
        .onChange(value => formData.required = value));

    // Multiple Values Toggle
    new Setting(containerEl)
      .setName('Multiple Values')
      .setDesc('Allow multiple values for this property')
      .addToggle(toggle => toggle
        .setValue(formData.multipleValues || false)
        .onChange(value => formData.multipleValues = value));

    // Action Buttons
    new Setting(containerEl)
      .addButton(button => button
        .setButtonText(isAddingProperty ? 'Adding...' : 'Add Property')
        .setCta()
        .setDisabled(isAddingProperty)
        .onClick(() => addProperty()))
      .addButton(button => button
        .setButtonText('Edit Properties')
        .onClick(() => openEditModal()));
  }

  function validateProperty(): MetadataValidationResult {
    const errors: string[] = [];
    const invalidFields: string[] = [];

    // Validate required fields
    if (!formData.name?.trim()) {
      errors.push('Property name is required');
      invalidFields.push('name');
    } else if (formData.name.trim().length < 2) {
      errors.push('Property name must be at least 2 characters');
      invalidFields.push('name');
    }

    if (!formData.description?.trim()) {
      errors.push('Property description is required');
      invalidFields.push('description');
    } else if (formData.description.trim().length < 10) {
      errors.push('Property description must be at least 10 characters');
      invalidFields.push('description');
    }

    if (!formData.type) {
      errors.push('Property type is required');
      invalidFields.push('type');
    }

    return {
      isValid: errors.length === 0,
      errors,
      invalidFields
    };
  }

  async function addProperty(): Promise<void> {
    if (isAddingProperty) return;

    try {
      isAddingProperty = true;
      const validation = validateProperty();

      if (!validation.isValid) {
        throw new Error(validation.errors?.[0] || 'Validation failed');
      }

      const newProperty: PropertyTag = {
        name: formData.name!.trim(),
        description: formData.description!.trim(),
        type: formData.type!,
        required: formData.required ?? false,
        multipleValues: formData.multipleValues ?? false
      };

      const currentState = getCurrentPropertyState();
      const updatedState = {
        ...currentState,
        customProperties: [...currentState.customProperties, newProperty],
      };

      await updatePropertyState(updatedState);
      resetForm();
      new Notice(`Property "${newProperty.name}" added successfully`);
      
      // Refresh the form
      containerEl.empty();
      setupPropertyForm();
    } catch (error) {
      console.error('Error adding property:', error);
      new Notice(`Failed to add property: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      isAddingProperty = false;
    }
  }

  function getCurrentPropertyState(): PropertyManagerState {
    const settings = settingsService.getSettings();
    return {
      customProperties: settings.frontMatter.customProperties || [],
    };
  }

  async function updatePropertyState(state: PropertyManagerState): Promise<void> {
    const settings = settingsService.getSettings();
    await settingsService.updateSettings({
      ...settings,
      frontMatter: {
        ...settings.frontMatter,
        customProperties: state.customProperties,
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
      const currentState = getCurrentPropertyState();
      
      const modal = new EditPropertiesModal({
        target: document.body,
        props: {
          app,
          properties: currentState.customProperties,
          onSubmit: handlePropertiesUpdate,
          onClose: () => modal.$destroy()
        }
      });
    } catch (error) {
      console.error('Error opening edit modal:', error);
      new Notice(`Failed to open edit modal: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async function handlePropertiesUpdate(updatedProperties: PropertyTag[]): Promise<void> {
    try {
      await updatePropertyState({
        customProperties: updatedProperties,
      });
      new Notice("Properties updated successfully");
    } catch (error) {
      console.error('Error updating properties:', error);
      new Notice(`Failed to update properties: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
</script>

<BaseAccordion
  title="📊 Property Management"
  description="Create and manage custom properties for your notes."
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