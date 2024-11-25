<!-- ModalContainer.svelte -->
<script lang="ts">
  import { hasActiveModal } from '@stores/UIStore';
  
  // Prevent modal backdrop from interfering with content
  $: modalActive = $hasActiveModal;

  function handleBackdropClick(event: MouseEvent) {
    event.stopPropagation();
    // Optionally dispatch a close event if needed
  }
</script>

<div 
  class="modal-container" 
  class:active={modalActive}
  on:click|stopPropagation
>
  <div 
    class="modal-backdrop" 
    on:click={handleBackdropClick}
    aria-hidden="true"
  ></div>
  <div class="modal-content">
    <slot />
  </div>
</div>

<style>
  .modal-container {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 999;
    display: none;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }

  .modal-container.active {
    display: flex;
    pointer-events: auto;
  }

  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.3);
    z-index: -1;
  }

  .modal-content {
    position: relative;
    z-index: 1000;
    background: var(--background-primary);
    border-radius: var(--radius-m);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    min-width: 400px;
    max-width: 80vw;
    max-height: 80vh;
    overflow-y: auto;
    pointer-events: auto;
  }
</style>