<script lang="ts">
  import { TextComponent, DropdownComponent, Notice, Setting, type App } from 'obsidian';
  import type { PropertyTag, PropertyType } from '@type/metadata.types';
  import { onMount } from 'svelte';

  export let app: App;
  export let properties: PropertyTag[];
  export let onSubmit: (properties: PropertyTag[]) => void;
  export let onClose: () => void;

  let contentEl: HTMLElement;
  let localProperties = [...properties];
  let selectedIndices = new Set<number>();
  let draggedIndex: number | null = null;

  const propertyTypes: PropertyType[] = ['string', 'number', 'boolean', 'array', 'date'];

  onMount(() => {
    console.log('🦇 PropertiesEditor.svelte mounted');
    console.log('🦇 Initial properties:', properties);
    renderProperties();
  });

  function renderProperties(): void {
    console.log('🦇 Rendering properties');
    if (!contentEl) {
      console.warn('🦇 contentEl not found');
      return;
    }
    contentEl.empty();

    // Create table
    const table = contentEl.createEl('table', { cls: 'property-table' });
    const thead = table.createEl('thead');
    const headerRow = thead.createEl('tr');

    // Select all checkbox
    const selectAllTh = headerRow.createEl('th');
    const selectAllCheckbox = selectAllTh.createEl('input', { type: 'checkbox' });
    selectAllCheckbox.checked = selectedIndices.size === localProperties.length;
    selectAllCheckbox.onchange = () => handleSelectAll(selectAllCheckbox.checked);

    // Column headers
    headerRow.createEl('th', { text: 'Name' });
    headerRow.createEl('th', { text: 'Description' });
    headerRow.createEl('th', { text: 'Type' });

    const tbody = table.createEl('tbody');

    localProperties.forEach((property, index) => {
      const row = tbody.createEl('tr');
      row.draggable = true;

      // Drag and drop handlers
      row.addEventListener('dragstart', (e) => handleDragStart(e, index));
      row.addEventListener('dragover', handleDragOver);
      row.addEventListener('drop', (e) => handleDrop(e, index));

      // Checkbox
      const selectTd = row.createEl('td');
      const checkbox = selectTd.createEl('input', { type: 'checkbox' });
      checkbox.checked = selectedIndices.has(index);
      checkbox.onchange = () => handleSelect(index, checkbox.checked);

      // Property name
      const nameTd = row.createEl('td');
      const nameInput = new TextComponent(nameTd);
      nameInput.setValue(property.name)
        .onChange(value => updateProperty(index, 'name', value));

      // Property description
      const descTd = row.createEl('td');
      const descInput = new TextComponent(descTd);
      descInput.setValue(property.description)
        .onChange(value => updateProperty(index, 'description', value));

      // Property type
      const typeTd = row.createEl('td');
      const typeDropdown = new DropdownComponent(typeTd);
      propertyTypes.forEach(type => {
        typeDropdown.addOption(type, type);
      });
      typeDropdown.setValue(property.type)
        .onChange(value => updateProperty(index, 'type', value as PropertyType));
    });

    // Footer actions
    new Setting(contentEl)
      .addButton(button => button
        .setButtonText('Delete Selected')
        .setWarning()
        .setDisabled(selectedIndices.size === 0)
        .onClick(handleDelete))
      .addButton(button => button
        .setButtonText('Save')
        .setCta()
        .onClick(handleSave))
      .addButton(button => button
        .setButtonText('Cancel')
        .onClick(onClose));
  }

  function updateProperty(index: number, key: keyof PropertyTag, value: any): void {
    localProperties[index] = {
      ...localProperties[index],
      [key]: value,
    };
    localProperties = [...localProperties];
  }

  function handleSelect(index: number, selected: boolean): void {
    if (selected) {
      selectedIndices.add(index);
    } else {
      selectedIndices.delete(index);
    }
    selectedIndices = new Set(selectedIndices);
  }

  function handleSelectAll(selected: boolean): void {
    if (selected) {
      selectedIndices = new Set(localProperties.map((_, i) => i));
    } else {
      selectedIndices.clear();
    }
  }

  function handleDelete(): void {
    localProperties = localProperties.filter((_, index) => !selectedIndices.has(index));
    selectedIndices.clear();
    renderProperties();
  }

  function handleSave(): void {
    console.log('🦇 Saving properties:', localProperties);
    // Validate properties
    const invalidProperty = localProperties.find(p => !p.name || !p.description);
    if (invalidProperty) {
      new Notice('All properties must have a name and description');
      return;
    }

    onSubmit(localProperties);
    onClose();
  }

  function handleDragStart(event: DragEvent, index: number): void {
    draggedIndex = index;
    event.dataTransfer?.setData('text/plain', index.toString());
  }

  function handleDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  function handleDrop(event: DragEvent, toIndex: number): void {
    event.preventDefault();

    if (draggedIndex !== null && draggedIndex !== toIndex) {
      const [movedItem] = localProperties.splice(draggedIndex, 1);
      localProperties.splice(toIndex, 0, movedItem);
      localProperties = [...localProperties];
      renderProperties();
    }

    draggedIndex = null;
  }
</script>

<div class="properties-editor-content" bind:this={contentEl}>
  <!-- Properties will be rendered here -->
</div>

<style>
  .properties-editor-content {
    padding: var(--size-4);
  }

  :global(.property-item) {
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    padding: var(--size-2) var(--size-4);
    margin-bottom: var(--size-2);
    display: flex;
    align-items: center;
  }

  :global(.property-item.drag-over) {
    border-color: var(--interactive-accent);
  }

  :global(.drag-handle) {
    cursor: move;
    padding: 0 var(--size-2);
    color: var(--text-muted);
    user-select: none;
  }

  :global(.dragging) {
    opacity: 0.5;
  }

  :global(.setting-item-control) {
    flex-wrap: wrap;
    gap: var(--size-2);
  }

  :global(.setting-item-info) {
    display: none;
  }

  /* Add these new styles */
  :global(.properties-editor-modal) {
    z-index: var(--layer-modal);
  }

  :global(.properties-editor-modal) :global(.setting-item-name),
  :global(.properties-editor-modal) :global(.setting-item-description) {
    color: var(--text-normal) !important;
    opacity: 1 !important;
  }

  :global(.modal-active) :global(.properties-editor-modal) {
    background-color: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
  }
</style>