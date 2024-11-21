<script lang="ts">
    import { onMount } from 'svelte';
    import { type App } from 'obsidian';
    import { Search } from 'flowbite-svelte';
    import type { Tag } from '@type/metadata.types';
  
    export let app: App;
    export let tags: Tag[];
    export let onSubmit: (tags: Tag[]) => void;
    export let onClose: () => void;
  
    let localTags = [...tags];
    let selectAllChecked = false;
    let searchQuery = '';
    let sortDirection: 'asc' | 'desc' = 'asc';
  
    $: filteredTags = localTags
      .filter(tag => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
          tag.name.toLowerCase().includes(query) ||
          tag.description.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        const comparison = a.name.localeCompare(b.name);
        return sortDirection === 'asc' ? comparison : -comparison;
      });
  
    function toggleSort(): void {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    }
  
    function handleSelectAll(event: Event): void {
      selectAllChecked = (event.target as HTMLInputElement).checked;
    }
  
    function handleDelete(): void {
      localTags = localTags.filter((_, index) => {
        const checkbox = document.querySelector(`input[data-index="${index}"]`) as HTMLInputElement;
        return !checkbox?.checked;
      });
      selectAllChecked = false;
    }
  
    function handleSave(): void {
      onSubmit(localTags);
      onClose();
    }
  </script>
  
  <div class="edit-tags-modal">
    <header class="modal-header">
      <h2>Edit Tags</h2>
    </header>
  
    <div class="modal-content">
      <div class="search-sort-container">
        <Search
          size="md"
          placeholder="Search tags..."
          bind:value={searchQuery}
        />
        <button
          class="sort-button"
          on:click={toggleSort}
          title={`Sort ${sortDirection === 'asc' ? 'descending' : 'ascending'}`}
        >
          <div class="sort-icon" class:desc={sortDirection === 'desc'}>
            {#if sortDirection === 'asc'}
              ▲
            {:else}
              ▼
            {/if}
          </div>
          Sort A-Z
        </button>
      </div>
  
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
              <th class="align-left">Name</th>
              <th class="align-left">Description</th>
              <th class="align-center">Delete</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredTags as tag, index (tag.name)}
              <tr>
                <td>
                  <input
                    type="text"
                    bind:value={tag.name}
                    class="tag-input"
                  />
                </td>
                <td>
                  <textarea
                    bind:value={tag.description}
                    class="tag-textarea"
                    rows="2"
                  ></textarea>
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
    .edit-tags-modal {
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
  
    .search-sort-container {
      display: flex;
      gap: var(--size-4);
      margin-bottom: var(--size-4);
    }
  
    .sort-button {
      display: flex;
      align-items: center;
      gap: var(--size-2);
      padding: var(--size-2) var(--size-4);
      background-color: var(--background-secondary);
      border: 1px solid var(--background-modifier-border);
      border-radius: var(--radius-s);
      color: var(--text-normal);
      cursor: pointer;
    }
  
    .sort-button:hover {
      background-color: var(--background-modifier-hover);
    }
  
    .sort-icon {
      transition: transform 0.2s ease;
    }
  
    .sort-icon.desc {
      transform: rotate(180deg);
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
  
    .tag-input,
    .tag-textarea {
      width: 100%;
      background: var(--background-primary);
      border: 1px solid var(--background-modifier-border);
      border-radius: var(--radius-s);
      padding: var(--size-2);
      color: var(--text-normal);
    }
  
    .tag-textarea {
      resize: vertical;
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