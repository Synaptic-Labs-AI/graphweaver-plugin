<!-- BaseAccordion.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  // **Props**
  export let title: string;
  export let description: string = '';
  export let isOpen: boolean = false;

  // **Event Dispatcher**
  const dispatch = createEventDispatcher();

  // **Toggle Function**
  function toggleAccordion(): void {
    // Dispatch a 'toggle' event with the new isOpen state
    dispatch('toggle', { isOpen: !isOpen });
  }
</script>

<!-- **Accordion Structure** -->
<div class="graphweaver-accordion">
  <!-- **Accordion Header** -->
  <div 
    class="graphweaver-accordion-header" 
    class:is-active={isOpen}
    on:click={toggleAccordion}
    on:keydown={(e) => e.key === 'Enter' && toggleAccordion()}
    role="button"
    tabindex="0"
    aria-expanded={isOpen}
  >
    <div class="setting-item-info">
      <div class="setting-item-heading">{title}</div>
      {#if description}
        <div class="setting-item-description">{description}</div>
      {/if}
    </div>
    <div class="setting-item-control">
      <span class="graphweaver-accordion-toggle">
        {isOpen ? '➖' : '➕'}
      </span>
    </div>
  </div>

  <!-- **Accordion Content** -->
  {#if isOpen}
    <div class="graphweaver-accordion-content">
      <slot />
    </div>
  {/if}
</div>

<!-- **Styles** -->
<style>
  .graphweaver-accordion {
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-m);
    margin-bottom: var(--size-4);
    overflow: hidden;
    background-color: var(--background-modifier-hover);
  }

  .graphweaver-accordion-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--size-4) var(--size-6);
    cursor: pointer;
    user-select: none;
  }

  .graphweaver-accordion-header.is-active {
    background: var(--background-modifier-hover);
  }

  .graphweaver-accordion-toggle {
    padding: var(--size-1);
    color: var(--text-muted);
    font-size: 1.1em;
  }

  /* **Focus and Hover States** */
  .graphweaver-accordion-header:focus {
    outline: 2px solid var(--interactive-accent);
    outline-offset: -2px;
  }

  .graphweaver-accordion-header:hover {
    background-color: var(--background-modifier-hover);
  }

  .graphweaver-accordion-content {
    padding: var(--size-4);
    background-color: var(--background-primary);
  }
</style>
