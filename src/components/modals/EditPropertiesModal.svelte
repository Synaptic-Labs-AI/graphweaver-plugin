<script lang="ts">
    import { type App } from 'obsidian';
    import type { PropertyTag, PropertyType } from '@type/metadata.types';
  
    export let app: App;
    export let properties: PropertyTag[];
    export let onSubmit: (properties: PropertyTag[]) => void;
    export let onClose: () => void;
  
    let localProperties = [...properties];
    let selectAllChecked = false;
    let draggedIndex: number | null = null;
  
    const propertyTypes: PropertyType[] = ["string", "number", "boolean", "array", "date"];
  
    function handleSelectAll(event: Event): void {
      selectAllChecked = (event.target as HTMLInputElement).checked;
    }
  
    function handleDelete(): void {
      localProperties = localProperties.filter((_, index) => {
        const checkbox = document.querySelector(`input[data-index="${index}"]`) as HTMLInputElement;
        return !checkbox?.checked;
      });
      selectAllChecked = false;
    }
  
    function handleSave(): void {
      onSubmit(localProperties);
      onClose();
    }
  
    function handleDragStart(event: DragEvent, index: number): void {
      draggedIndex = index;
      event.dataTransfer?.setData('text/plain', index.toString());
      const target = event.target as HTMLElement;
      target.classList.add('dragging');
    }
  
    function handleDragOver(event: DragEvent): void {
      event.preventDefault();
      const target = event.target as HTMLElement;
      target.closest('tr')?.classList.add('drag-over');
    }
  
    function handleDrop(event: DragEvent, toIndex: number): void {
      event.preventDefault();
      
      document.querySelectorAll('.dragging, .drag-over').forEach(el => {
        el.classList.remove('dragging', 'drag-over');
      });
  
      if (draggedIndex !== null && draggedIndex !== toIndex) {
        const [movedItem] = localProperties.splice(draggedIndex, 1);
        localProperties.splice(toIndex, 0, movedItem);
        localProperties = [...localProperties]; // Trigger reactivity
      }
      
      draggedIndex = null;
    }
  </script>
  
  <div class="edit-properties-modal">
    <header class="modal-header">
      <h2>Edit Properties</h2>
    </header>
  
    <div class="modal-content">
      <div class="select-all-container">
        <label class="select-all-label">
          <input
            type="checkbox"
            bind:checked={selectAllChecked}
            on:change={handleSelectAll}
          />
          <span>Select All</span>
        </label>
      </div>
  
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th class="align-center">Drag</th>
              <th class="align-left">Name</th>
              <th class="align-left">Description</th>
              <th class="align-left">Type</th>
              <th class="align-center">Delete</th>
            </tr>
          </thead>
          <tbody>
            {#each localProperties as property, index (property.name)}
              <tr
                draggable="true"
                on:dragstart={(e) => handleDragStart(e, index)}
                on:dragover={handleDragOver}
                on:drop={(e) => handleDrop(e, index)}
                data-index={index}
              >
                <td class="align-center drag-handle">≡</td>
                <td>
                  <input
                    type="text"
                    bind:value={property.name}
                    class="property-input"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    bind:value={property.description}
                    class="property-input"
                  />
                </td>
                <td>
                  <select
                    bind:value={property.type}
                    class="property-select"
                  >
                    {#each propertyTypes as type}
                      <option value={type}>{type}</option>
                    {/each}
                  </select>
                </td>
                <td class="align-center">
                  <input
                    type="checkbox"
                    checked={selectAllChecked}
                    data-index={index}
                  />
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
  
      <div class="modal-footer">
        <button
          class="mod-warning"
          on:click={handleDelete}
        >
          Delete Selected
        </button>
        <button
          class="mod-cta"
          on:click={handleSave}
        >
          Save
        </button>
        <button
          class="mod-cancel"
          on:click={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
  
  <style>
    .edit-properties-modal {
      display: flex;
      flex-direction: column;
      gap: var(--size-4);
      padding: var(--size-4);
      max-width: 800px;
      width: 100%;
    }
  
    .modal-header {
      border-bottom: 1px solid var(--background-modifier-border);
      padding-bottom: var(--size-4);
    }
  
    .modal-header h2 {
      margin: 0;
      color: var(--text-normal);
      font-size: var(--font-ui-large);
    }
  
    .select-all-container {
      margin-bottom: var(--size-4);
    }
  
    .select-all-label {
      display: flex;
      align-items: center;
      gap: var(--size-2);
      cursor: pointer;
    }
  
    .table-container {
      overflow-x: auto;
      margin-bottom: var(--size-4);
    }
  
    table {
      width: 100%;
      border-collapse: collapse;
    }
  
    th, td {
      padding: var(--size-2) var(--size-4);
      border-bottom: 1px solid var(--background-modifier-border);
    }
  
    .align-center {
      text-align: center;
    }
  
    .align-left {
      text-align: left;
    }
  
    .drag-handle {
      cursor: move;
      user-select: none;
    }
  
    .property-input,
    .property-select {
      width: 100%;
      background: var(--background-primary);
      border: 1px solid var(--background-modifier-border);
      border-radius: var(--radius-s);
      padding: var(--size-2);
      color: var(--text-normal);
    }
  
    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: var(--size-4);
      padding-top: var(--size-4);
      border-top: 1px solid var(--background-modifier-border);
    }
  
    button {
      padding: var(--size-2) var(--size-4);
      border-radius: var(--radius-s);
      border: none;
      cursor: pointer;
      font-weight: var(--font-bold);
    }
  
    button.mod-cta {
      background-color: var(--interactive-accent);
      color: var(--text-on-accent);
    }
  
    button.mod-warning {
      background-color: var(--background-modifier-error);
      color: var(--text-on-accent);
    }
  
    button.mod-cancel {
      background-color: var(--background-modifier-border);
      color: var(--text-normal);
    }
  
    button:hover:not(:disabled) {
      opacity: 0.8;
    }
  </style>