<!--src/components/modals/TagEditor.svelte-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { Setting, Notice } from 'obsidian';
  import type { Tag } from '@type/metadata.types';

  export let tags: Tag[];
  export let onSubmit: (tags: Tag[]) => void;
  export let onClose: () => void;

  let localTags = [...tags];
  let selectedIndices = new Set<number>();
  let searchQuery = '';
  let sortDirection: 'asc' | 'desc' = 'asc';
  let containerEl: HTMLElement;

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

  onMount(() => {
    renderTags();
  });

  function renderTags(): void {
    if (!containerEl) return;
    containerEl.empty();

    // Search and Sort
    new Setting(containerEl)
      .addSearch(search => search
        .setPlaceholder('Search tags...')
        .setValue(searchQuery)
        .onChange(value => {
          searchQuery = value;
          renderTags();
        }))
      .addExtraButton(button => button
        .setIcon(sortDirection === 'asc' ? 'chevron-up' : 'chevron-down')
        .setTooltip(`Sort ${sortDirection === 'asc' ? 'descending' : 'ascending'}`)
        .onClick(() => {
          sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
          renderTags();
        }));

    // Select All
    new Setting(containerEl)
      .addToggle(toggle => toggle
        .setValue(selectedIndices.size === localTags.length)
        .setTooltip('Select all')
        .onChange(value => handleSelectAll(value)))
      .addButton(button => button
        .setButtonText('Delete Selected')
        .setWarning()
        .setDisabled(selectedIndices.size === 0)
        .onClick(handleDelete));

    // Tag List
    filteredTags.forEach((tag, index) => {
      new Setting(containerEl)
        .setClass('tag-item')
        .addToggle(toggle => toggle
          .setValue(selectedIndices.has(index))
          .onChange(value => handleSelect(index, value)))
        .addText(text => text
          .setValue(tag.name)
          .setPlaceholder('Tag name')
          .onChange(value => updateTag(index, 'name', value)))
        .addTextArea(text => text
          .setValue(tag.description)
          .setPlaceholder('Description')
          .onChange(value => updateTag(index, 'description', value)));
    });

    // Footer Actions
    new Setting(containerEl)
      .addButton(button => button
        .setButtonText('Save')
        .setCta()
        .onClick(handleSave))
      .addButton(button => button
        .setButtonText('Cancel')
        .onClick(onClose));
  }

  function updateTag(index: number, key: keyof Tag, value: string): void {
    const tagIndex = localTags.indexOf(filteredTags[index]);
    if (tagIndex !== -1) {
      localTags[tagIndex] = {
        ...localTags[tagIndex],
        [key]: value
      };
      localTags = [...localTags];
      renderTags();
    }
  }

  function handleSelect(index: number, selected: boolean): void {
    const tagIndex = localTags.indexOf(filteredTags[index]);
    if (tagIndex !== -1) {
      if (selected) {
        selectedIndices.add(tagIndex);
      } else {
        selectedIndices.delete(tagIndex);
      }
      selectedIndices = new Set(selectedIndices);
      renderTags();
    }
  }

  function handleSelectAll(selected: boolean): void {
    if (selected) {
      selectedIndices = new Set(filteredTags.map((_, i) => i));
    } else {
      selectedIndices.clear();
    }
    renderTags();
  }

  function handleDelete(): void {
    const indicesToDelete = Array.from(selectedIndices);
    localTags = localTags.filter((_, index) => !indicesToDelete.includes(index));
    selectedIndices.clear();
    renderTags();
  }

  function handleSave(): void {
    // Validate tags
    const invalidTag = localTags.find(t => !t.name || !t.description);
    if (invalidTag) {
      new Notice('All tags must have a name and description');
      return;
    }

    onSubmit(localTags);
    onClose();
  }
</script>

<div class="edit-tags-container" bind:this={containerEl}></div>

<style>
  .edit-tags-container {
    display: flex;
    flex-direction: column;
    gap: var(--size-2);
    padding: var(--size-4);
    max-height: 70vh;
    overflow-y: auto;
  }

  :global(.tag-item) {
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    padding: var(--size-2) var(--size-4);
    margin-bottom: var(--size-2);
  }

  :global(.setting-item-control) {
    flex-wrap: wrap;
    gap: var(--size-2);
  }

  :global(.setting-item-info) {
    display: none;
  }

  :global(.search-input) {
    width: 200px;
  }

  :global(.tag-item textarea) {
    min-height: 60px;
    resize: vertical;
  }
</style>