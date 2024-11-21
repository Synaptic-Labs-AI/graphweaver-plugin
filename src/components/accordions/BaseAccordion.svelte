// BaseAccordion.svelte
<script lang="ts">
  import { AccordionItem, Accordion } from 'flowbite-svelte';
  import { Notice } from 'obsidian';
  import type { AccordionProps } from '@type/component.types';

  // Use the existing AccordionProps interface
  export let title: AccordionProps['title'];
  export let description: AccordionProps['description'] = '';
  export let isOpen: AccordionProps['isOpen'] = false;
  export let app: AccordionProps['app'];
  export let settingsService: AccordionProps['settingsService'];
  export let aiService: AccordionProps['aiService'];

  function handleError(context: string, error: unknown): void {
    console.error(`Error in ${context}:`, error);
    new Notice(`Error in ${context}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
</script>

<Accordion class="base-accordion">
  <AccordionItem {isOpen}>
    <svelte:fragment slot="header">
      <div class="flex items-center justify-between w-full p-2">
        <div class="flex-1 min-w-0">
          <span class="text-lg font-medium">{title}</span>
          {#if description}
            <span class="ml-2 text-sm text-gray-600 dark:text-gray-400">
              {description}
            </span>
          {/if}
        </div>
        <div 
          class="flex-shrink-0 ml-4 transition-transform duration-200"
          class:rotate-90={isOpen}
          aria-hidden="true"
        >
          <svg 
            viewBox="0 0 24 24" 
            class="w-6 h-6"
          >
            <path 
              fill="currentColor" 
              d="M9.29 6.71a.996.996 0 000 1.41L13.17 12l-3.88 3.88a.996.996 0 101.41 1.41l4.59-4.59a.996.996 0 000-1.41l-4.59-4.59a.996.996 0 00-1.41 0z"
            />
          </svg>
        </div>
      </div>
    </svelte:fragment>

    <div class="p-4">
      <slot {app} {settingsService} {aiService} />
    </div>
  </AccordionItem>
</Accordion>

<style>
  :global(.base-accordion) {
    background-color: white;
    background-color: var(--tw-bg-opacity, 1) var(--tw-bg-color, #1f2937);
    border-radius: 0.5rem;
  }
</style>