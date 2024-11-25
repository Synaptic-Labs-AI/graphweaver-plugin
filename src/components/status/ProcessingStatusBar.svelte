<!--src/components/status/ProcessingStatusBar.svelte-->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { type App, setIcon } from 'obsidian';
  import { processingStore } from '@stores/ProcessingStore';
  import { 
    ProcessingStateEnum,
    type ProcessingState,
    type ProcessingStatus 
  } from '@type/processing.types';

  export let app: App;

  let iconEl: HTMLElement;
  let status: ProcessingState;
  let tooltipTimeout: NodeJS.Timeout;

  // Convert ProcessingState to ProcessingStatus for modal
  function createProcessingStatus(state: ProcessingState): ProcessingStatus {
    return {
      state: { ...state },
      filesQueued: state.filesQueued,
      filesProcessed: state.filesProcessed,
      filesRemaining: state.filesRemaining,
      currentFile: state.currentFile ?? undefined,
      errors: state.errors,
      startTime: state.startTime ?? undefined,
      estimatedTimeRemaining: state.estimatedTimeRemaining ?? undefined
    };
  }

  // Icon and color mapping
  const statusConfig: Record<ProcessingStateEnum, { icon: string; color: string }> = {
    [ProcessingStateEnum.RUNNING]: {
      icon: 'sync',
      color: 'var(--interactive-accent)'
    },
    [ProcessingStateEnum.ERROR]: {
      icon: 'alert-circle',
      color: 'var(--color-red)'
    },
    [ProcessingStateEnum.PAUSED]: {
      icon: 'pause-circle',
      color: 'var(--text-muted)'
    },
    [ProcessingStateEnum.IDLE]: {
      icon: 'check-circle',
      color: 'var(--color-green)'
    }
  };

  const getStatusConfig = (state: ProcessingStateEnum) => 
    statusConfig[state] || { icon: 'help-circle', color: 'var(--text-muted)' };

  // Store subscription
  const unsubscribe = processingStore.subscribe(value => {
    status = value;
    updateIcon();
  });

  onDestroy(() => {
    unsubscribe();
    if (tooltipTimeout) clearTimeout(tooltipTimeout);
  });

  function updateIcon(): void {
    if (!iconEl || !status?.state) return;
    const config = getStatusConfig(status.state);
    setIcon(iconEl, config.icon);
    iconEl.style.color = config.color;
  }

  function getProgressText(): string {
    if (!status) return 'Unknown';
    if (status.currentFile) return `Processing: ${status.currentFile}`;
    return status.state || 'Unknown';
  }

  function handleClick(): void {
    // Import dynamically to avoid circular dependencies
    import('@components/modals/StatusHistoryModal.svelte').then(({ StatusHistoryModal }) => {
      const modal = new StatusHistoryModal(
        app,                                // First required argument
        createProcessingStatus(status),     // Second required argument
        []                                  // Third required argument (recentStats)
      );
      modal.open();  // Use Modal's built-in open() method instead of Svelte mounting
    }).catch(error => {
      console.error('Error opening status history:', error);
    });
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  }

  // Show extended tooltip on hover
  function handleMouseEnter(event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement;
    tooltipTimeout = setTimeout(() => {
      const tooltip = document.createElement('div');
      tooltip.className = 'status-tooltip';
      tooltip.innerHTML = `
        <div>Status: ${status?.state || 'Unknown'}</div>
        ${status?.filesQueued ? `
          <div>Progress: ${status.filesProcessed}/${status.filesQueued} files</div>
          ${status.estimatedTimeRemaining ? `
            <div>ETA: ${Math.ceil(status.estimatedTimeRemaining / 1000)}s</div>
          ` : ''}
        ` : ''}
        ${status?.errors.length ? `
          <div>Errors: ${status.errors.length}</div>
        ` : ''}
      `;
      
      // Position tooltip
      const rect = target.getBoundingClientRect();
      tooltip.style.position = 'fixed';
      tooltip.style.left = `${rect.left}px`;
      tooltip.style.top = `${rect.bottom + 5}px`;
      
      document.body.appendChild(tooltip);
      target.addEventListener('mouseleave', () => tooltip.remove(), { once: true });
    }, 500);
  }

  function handleMouseLeave(): void {
    if (tooltipTimeout) clearTimeout(tooltipTimeout);
  }
</script>

<div 
  class="processing-status-bar"
  on:click={handleClick}
  on:keydown={handleKeydown}
  on:mouseenter={handleMouseEnter}
  on:mouseleave={handleMouseLeave}
  role="button"
  tabindex="0"
  aria-label="Processing Status: {getProgressText()}"
>
  <div class="icon" bind:this={iconEl}></div>
  <div class="status-text">{getProgressText()}</div>
  {#if status?.filesProcessed !== undefined && status?.filesQueued > 0}
    <div 
      class="progress-bar"
      style="width: {(status.filesProcessed / status.filesQueued * 100)}%"
      role="progressbar"
      aria-valuenow={status.filesProcessed}
      aria-valuemin="0"
      aria-valuemax={status.filesQueued}
    ></div>
  {/if}
</div>

<style>
  .processing-status-bar {
    display: flex;
    align-items: center;
    gap: var(--size-2);
    padding: 0 var(--size-4);
    cursor: pointer;
    height: var(--status-bar-height);
    border-right: 1px solid var(--background-modifier-border);
    transition: background-color 0.2s ease;
  }

  .processing-status-bar:hover {
    background-color: var(--background-modifier-hover);
  }

  .processing-status-bar:focus {
    outline: none;
    box-shadow: inset 0 0 0 2px var(--interactive-accent);
  }

  .icon {
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.3s ease;
  }

  .status-text {
    color: var(--text-normal);
    font-size: var(--font-ui-smaller);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 150px;
  }

  .progress-bar {
    height: 2px;
    background-color: currentColor;
    transition: all 0.3s ease;
    border-radius: 2px;
    min-width: 50px;
  }

  :global(.status-tooltip) {
    background-color: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    padding: var(--size-2) var(--size-4);
    font-size: var(--font-ui-smaller);
    color: var(--text-normal);
    z-index: 1000;
    pointer-events: none;
    box-shadow: var(--shadow-s);
  }
</style>