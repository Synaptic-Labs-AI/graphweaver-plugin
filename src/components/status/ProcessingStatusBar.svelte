<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { processingStore, processingStatus } from '../../stores/ProcessingStore';
    import { ProcessingStateEnum } from '../../types/processing.types';
    import { setIcon, type App } from 'obsidian';
    import StatusHistoryModal from '../modals/StatusHistoryModal.svelte';
    import type { ProcessingStatus, ProcessingState } from '../../types/processing.types';

    // Props
    export let app: App;

    // Element refs
    let iconEl: HTMLElement;

    // State from store
    let status: ProcessingState;

    const unsubscribe = processingStore.subscribe(value => {
        status = value;
    });

    onDestroy(() => {
        unsubscribe();
    });

    function getIcon(): string {
        switch(status?.state) {
            case ProcessingStateEnum.RUNNING:
                return 'sync';
            case ProcessingStateEnum.ERROR:
                return 'alert-circle';
            case ProcessingStateEnum.PAUSED:
                return 'pause-circle';
            case ProcessingStateEnum.IDLE:
                return 'check-circle';
            default:
                return 'help-circle';
        }
    }

    function getColor(): string {
        switch(status?.state) {
            case ProcessingStateEnum.RUNNING:
                return 'var(--interactive-accent)';
            case ProcessingStateEnum.ERROR:
                return 'var(--color-red)';
            case ProcessingStateEnum.PAUSED:
                return 'var(--text-muted)';
            case ProcessingStateEnum.IDLE:
                return 'var(--color-green)';
            default:
                return 'var(--text-muted)';
        }
    }

    onMount(() => {
        if (iconEl) {
            setIcon(iconEl, getIcon());
        }
    });

    $: if (iconEl && status?.state) {
        setIcon(iconEl, getIcon());
    }

    function handleClick(): void {
    const modal = new StatusHistoryModal({
        target: document.body,
        props: {
            app,
            currentStatus: {
                // ProcessingStatus requires state to be ProcessingState type
                state: {
                    isProcessing: status.isProcessing,
                    currentFile: status.currentFile,
                    queue: status.queue,
                    progress: status.progress,
                    state: status.state,
                    filesQueued: status.filesQueued,
                    filesProcessed: status.filesProcessed,
                    filesRemaining: status.filesRemaining,
                    errors: status.errors,
                    error: status.error,
                    startTime: status.startTime,
                    estimatedTimeRemaining: status.estimatedTimeRemaining
                },
                filesQueued: status.filesQueued,
                filesProcessed: status.filesProcessed,
                filesRemaining: status.filesRemaining,
                currentFile: status.currentFile ?? undefined,
                errors: status.errors,
                startTime: status.startTime ?? undefined,
                estimatedTimeRemaining: status.estimatedTimeRemaining ?? undefined
            },
            recentStats: [],
            onClose: () => modal.$destroy()
        }
    });
}

    function handleKeydown(event: KeyboardEvent): void {
        if (event.key === 'Enter' || event.key === ' ') {
            handleClick();
        }
    }
</script>

<style>
    .processing-status-bar {
        display: flex;
        align-items: center;
        gap: var(--size-2);
        padding: 0 var(--size-4);
        cursor: pointer;
    }
    .icon {
        color: var(--text-muted);
        width: 16px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .status-text {
        color: var(--text-normal);
        font-size: var(--font-ui-smaller);
    }
    .progress-bar {
        height: 2px;
        background-color: currentColor;
        transition: all 0.3s ease;
        border-radius: 2px;
        min-width: 50px;
    }
</style>

<div 
    class="processing-status-bar" 
    on:click={handleClick}
    on:keydown={handleKeydown}
    role="button"
    tabindex="0"
    aria-label="Processing Status"
>
    <div class="icon" bind:this={iconEl}></div>
    <div class="status-text">
        {#if status?.currentFile}
            Processing: {status.currentFile}
        {:else}
            {status?.state || 'Unknown'}
        {/if}
    </div>
    {#if status?.filesProcessed !== undefined && status?.filesQueued > 0}
        <div 
            class="progress-bar" 
            style="width: {(status.filesProcessed / status.filesQueued * 100)}%; background-color: {getColor()}"
            role="progressbar"
            aria-valuenow={status.filesProcessed}
            aria-valuemin="0"
            aria-valuemax={status.filesQueued}
        ></div>
    {/if}
</div>