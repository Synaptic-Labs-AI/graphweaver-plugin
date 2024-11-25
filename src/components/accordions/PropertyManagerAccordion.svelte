<!-- PropertyManagerAccordion.svelte -->
<script lang="ts">
    import { onDestroy } from 'svelte';
    import { writable, get } from 'svelte/store';
    import { Setting, Notice } from 'obsidian';
    import BaseAccordion from './BaseAccordion.svelte';
    import { PropertiesEditor } from '../modals/PropertiesEditor';
    import type { 
        PropertyTag, 
        PropertyType,
        MetadataValidationResult,
        PropertyManagerState,
    } from '@type/metadata.types';
    import type { App } from 'obsidian';
    import type { SettingsService } from '@services/SettingsService';
    import { uiStore } from '@stores/UIStore';
  
    // Props
    export let title: string;
    export let description: string = '';
    export let app: App;
    export let settingsService: SettingsService;
    export let isOpen: boolean = false;
  
    // State Management
    const propertyState = writable({
        isAddingProperty: false,
        formData: {
            name: '',
            description: '',
            type: 'string' as PropertyType,
            required: false,
            multipleValues: false
        },
        validationErrors: {} as Record<string, string>
    });
  
    let contentEl: HTMLElement | null;
    let shouldRenderContent = false;
    let modal: PropertiesEditor | null = null;
    
    const propertyTypes = {
        'string': { label: 'Text', description: 'Plain text values' },
        'number': { label: 'Number', description: 'Numeric values' },
        'boolean': { label: 'True/False', description: 'Boolean values' },
        'array': { label: 'List', description: 'Multiple values in a list' },
        'date': { label: 'Date', description: 'Date and time values' }
    } as const;

    // Cleanup on component destroy
    onDestroy(() => {
        if (modal) {
            modal.close();
            modal = null;
        }
        contentEl = null;
    });
  
    function handleAccordionToggle(event: CustomEvent<{ isOpen: boolean }>) {
        isOpen = event.detail.isOpen;
        if (isOpen) {
            shouldRenderContent = true;
        }
    }
  
    $: if (shouldRenderContent && isOpen && contentEl) {
        renderSettingsContent();
    }
  
    function renderSettingsContent() {
        if (!contentEl || !contentEl.isConnected) return;

        contentEl.empty();
  
        // Property Name Setting
        new Setting(contentEl)
            .setName('Property Name')
            .setDesc('Enter a name for the property')
            .addText(text => {
                text.setPlaceholder('Enter property name')
                    .setValue($propertyState.formData.name)
                    .onChange(value => handleFieldChange('name', value));
                return text;
            });
  
        // Property Description Setting
        new Setting(contentEl)
            .setName('Property Description')
            .setDesc('Describe what this property is used for')
            .addTextArea(text => {
                text.setPlaceholder('Enter property description')
                    .setValue($propertyState.formData.description)
                    .onChange(value => handleFieldChange('description', value));
                text.inputEl.rows = 4;
                return text;
            });
  
        // Action Buttons
        new Setting(contentEl)
            .addButton(button => {
                button.setButtonText('Edit Properties')
                    .setCta()
                    .onClick(openEditModal);
                return button;
            });
  
        shouldRenderContent = false;
    }

    function openEditModal(): void {
        if (modal) return;
        
        console.log('🔍 Opening properties editor modal');
        try {
            const properties = getCurrentPropertyState().customProperties;
            console.log('🔍 Current properties:', properties);
            
            modal = new PropertiesEditor(app);
            
            // Register the close handler
            modal.customCloseHandler = () => {
                console.log('🔍 Modal custom close handler');
                if (modal) {
                    modal.close();
                    modal = null;
                }
                uiStore.popModal();
            };
            
            // Set up the property update handler
            const handleUpdate = async (updatedProps: PropertyTag[]) => {
                console.log('🔍 Properties update handler');
                await handlePropertiesUpdate(updatedProps);
                modal?.close();
                modal = null;
                uiStore.popModal();
            };

            // Push the modal state before opening
            uiStore.pushModal('properties-editor');
            
            // Open the modal with properties
            modal.openWithProperties(properties, handleUpdate);
            
        } catch (error) {
            console.error('🔍 Error opening modal:', error);
            uiStore.popModal();
            modal?.close();
            modal = null;
            new Notice(`Failed to open properties editor: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
  
    async function handlePropertiesUpdate(updatedProperties: PropertyTag[]): Promise<void> {
        try {
            await updatePropertyState({
                customProperties: updatedProperties,
            });
            new Notice("Properties updated successfully");
            shouldRenderContent = true;
        } catch (error) {
            console.error('🦇 Error updating properties:', error);
            new Notice(`Failed to update properties: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    function getCurrentPropertyState(): PropertyManagerState {
        const settings = settingsService.getSettings();
        return {
            customProperties: settings.frontMatter.customProperties || [],
        };
    }

    async function updatePropertyState(state: PropertyManagerState): Promise<void> {
        if (!settingsService.isReady()) {
            throw new Error('Settings service not ready');
        }

        const settings = settingsService.getSettings();
        await settingsService.updateSettings({
            ...settings,
            frontMatter: {
                ...settings.frontMatter,
                customProperties: state.customProperties,
            }
        });
    }

    function validateField(field: string, value: any): string | null {
        switch (field) {
            case 'name':
                if (!value?.trim()) return 'Property name is required';
                if (value.trim().length < 2) return 'Property name must be at least 2 characters';
                break;
            case 'description':
                if (!value?.trim()) return 'Property description is required';
                if (value.trim().length < 10) return 'Property description must be at least 10 characters';
                break;
            case 'type':
                if (!value) return 'Property type is required';
                if (!Object.keys(propertyTypes).includes(value)) return 'Invalid property type';
                break;
        }
        return null;
    }
  
    function handleFieldChange(field: string, value: any): void {
        propertyState.update(s => {
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
</script>
  
<BaseAccordion
    {title}
    {description}
    {isOpen}
    on:toggle={handleAccordionToggle}
>
    <div class="property-manager-content" bind:this={contentEl}>
        <!-- Obsidian Settings will be mounted here when isOpen is true -->
    </div>
</BaseAccordion>
  
<style>
    .property-manager-content {
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