<!-- SettingsTab.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { get } from 'svelte/store';
    import type { App } from 'obsidian';
    import type GraphWeaverPlugin from '../../main';
    import type { SettingsService } from '@services/SettingsService';
    import type { AIService } from '@services/ai/AIService';
    import type { TagManagementService } from '@services/tags/TagManagementService';
    import { uiStore, hasActiveModal } from '@stores/UIStore';
    
    // Import accordion components
    import ModelHookupAccordion from '@components/accordions/ModelHookupAccordion.svelte';
    import PropertyManagerAccordion from '@components/accordions/PropertyManagerAccordion.svelte';
    import TagManagerAccordion from '@components/accordions/TagManagerAccordion.svelte';
    import OntologyGenerationAccordion from '@components/accordions/OntologyGenerationAccordion.svelte';
    import KnowledgeBloomAccordion from '@components/accordions/KnowledgeBloomAccordion.svelte';
    import BatchProcessorAccordion from '@components/accordions/BatchProcessorAccordion.svelte';
    import AdvancedAccordion from '@components/accordions/AdvancedAccordion.svelte';
    import ModalContainer from '@components/modals/ModalContainer.svelte';

    // Props
    export let app: App;
    export let plugin: GraphWeaverPlugin;
    export let settingsService: SettingsService;
    export let aiService: AIService;
    export let tagManagementService: TagManagementService;

    // State
    let isInitialized = false;
    let activeAccordionId: string | null = null;
    let modalActive: boolean;
    let destroyed = false;

    // Reactive statement for modal state
    $: modalActive = $hasActiveModal;

    // Accordion Configuration with proper typing
    interface AccordionConfig {
        id: string;
        component: any; // We'll keep this as 'any' since Svelte components don't have a specific type
        title: string;
        description: string;
        priority: number;
        enabled: boolean;
    }

    const accordions: AccordionConfig[] = [
        {
            id: 'modelHookup',
            component: ModelHookupAccordion,
            title: '🔌 Model Hookup',
            description: 'Configure AI providers and models',
            priority: 1,
            enabled: true
        },
        {
            id: 'propertyManager',
            component: PropertyManagerAccordion,
            title: '📊 Property Manager',
            description: 'Create and manage custom properties for your notes.',
            priority: 2,
            enabled: true
        },
        {
            id: 'tagManager',
            component: TagManagerAccordion,
            title: '🏷️ Tag Manager',
            description: 'Manage custom tags',
            priority: 3,
            enabled: true
        },
        {
            id: 'ontologyGenerator',
            component: OntologyGenerationAccordion,
            title: '🧠 Ontology Generation',
            description: 'Generate and manage ontologies for your vault.',
            priority: 4,
            enabled: settingsService?.isReady() && aiService?.isReady()
        },
        {
            id: 'knowledgeBloom',
            component: KnowledgeBloomAccordion,
            title: '🌸 Knowledge Bloom',
            description: 'Enhance your knowledge graph with Bloom features.',
            priority: 5,
            enabled: settingsService?.isReady() && aiService?.isReady()
        },
        {
            id: 'batchProcessor',
            component: BatchProcessorAccordion,
            title: '🔄 Batch Processor',
            description: 'Process multiple files to generate front matter and wikilinks.',
            priority: 6,
            enabled: settingsService?.isReady()
        },
        {
            id: 'advanced',
            component: AdvancedAccordion,
            title: '⚙️ Advanced',
            description: 'Configuration options for the plugin.',
            priority: 7,
            enabled: true
        }
    ].sort((a, b) => a.priority - b.priority)
     .filter(config => config.enabled);

    // UI Store Subscription
    let unsubscribeUI: (() => void) | null = null;
    
    function subscribeToUIStore() {
        unsubscribeUI = uiStore.subscribe((state) => {
            if (!destroyed) {
                modalActive = state.modalStack.length > 0;
            }
        });
    }

    // Initialization
    async function initialize() {
        console.log('🦇 Initializing settings tab...');
        
        if (!app || !plugin || !settingsService || !aiService) {
            console.error('🦇 Required dependencies not provided');
            return;
        }

        try {
            const servicesReady = 
                settingsService.isReady() && 
                aiService.isReady() && 
                accordions.some(acc => acc.enabled);

            if (servicesReady) {
                console.log('🦇 Services ready, initializing UI...');
                isInitialized = true;
                subscribeToUIStore();
            } else {
                console.log('🦇 Waiting for services to be ready...');
                await waitForServices();
            }
        } catch (error) {
            console.error('🦇 Initialization error:', error);
            throw error;
        }
    }

    async function waitForServices(timeout = 5000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            if (settingsService.isReady() && aiService.isReady()) {
                isInitialized = true;
                subscribeToUIStore();
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error('Services initialization timeout');
    }

    // Accordion Management
    function handleAccordionToggle(accordionId: string) {
        if (modalActive) return;
        
        activeAccordionId = activeAccordionId === accordionId ? null : accordionId;
        
        // Update UI store
        uiStore.update(state => ({
            ...state,
            activeAccordion: activeAccordionId,
            lastInteraction: Date.now()
        }));
    }

    // Lifecycle Hooks
    onMount(async () => {
        if (!destroyed) {
            await initialize();
        }
    });

    onDestroy(() => {
        destroyed = true;
        if (unsubscribeUI) {
            unsubscribeUI();
        }
        isInitialized = false;
    });

    // Helper function to get common props for all accordions
    function getAccordionProps(accordion: AccordionConfig) {
        return {
            app,
            settingsService,
            aiService,
            tagManagementService,
            title: accordion.title,
            description: accordion.description,
            isOpen: activeAccordionId === accordion.id,
            plugin // This is needed for some accordions
        };
    }
</script>

{#if isInitialized && !destroyed}
    <div 
        class="graphweaver-plugin-settings" 
        class:has-modal={modalActive}
        role="region" 
        aria-label="Plugin Settings"
    >
        <!-- Header Section -->
        <header class="settings-header">
            <div class="header-content">
                <div class="header-title">
                    <h2>GraphWeaver Settings</h2>
                    <div class="plugin-version">v{plugin.manifest.version}</div>
                </div>
                <p>Configure AI models, manage properties and tags, and customize your knowledge graph generation.</p>
            </div>
            <div class="header-divider" aria-hidden="true"></div>
        </header>

        <!-- Accordions Section -->
        <div class="settings-accordions" role="list">
            {#each accordions as accordion (accordion.id)}
                <div 
                    class="accordion-wrapper"
                    class:active={activeAccordionId === accordion.id}
                    style="--animation-delay: {accordion.priority * 100}ms"
                    role="listitem"
                >
                    <svelte:component
                        this={accordion.component}
                        {...getAccordionProps(accordion)}
                        on:click={() => handleAccordionToggle(accordion.id)}
                    />
                </div>
            {/each}
        </div>

        <!-- Modal Container -->
        <ModalContainer />
    </div>
{/if}

<style>
    /* Base Container */
    .graphweaver-plugin-settings {
        padding: var(--size-4-6);
        max-width: 800px;
        margin: 0 auto;
        width: 100%;
        animation: fadeIn 0.3s ease-out;
        position: relative;
    }

    /* Modal State Handling */
    .graphweaver-plugin-settings.has-modal {
        position: relative;
    }

    /* Remove modal-specific styles from settings tab */
    .graphweaver-plugin-settings {
        position: relative;
        z-index: 1;  /* Ensure base layer is above default obsidian elements */
    }

    .accordion-wrapper {
        position: relative;
        z-index: 1;
    }

    /* Header Section */
    .settings-header {
        position: relative;
        margin-bottom: var(--size-12);
        padding: var(--size-8) var(--size-4);
        background: var(--background-primary);
    }

    .header-content {
        position: relative;
        z-index: 1;
    }

    .header-title {
        display: flex;
        align-items: center;
        gap: var(--size-4);
        margin-bottom: var(--size-4);
    }

    .header-title h2 {
        margin: 0;
        color: var(--text-normal);
        font-size: var(--font-ui-xxl);
        font-weight: var(--font-bold);
        line-height: 1.2;
    }

    .plugin-version {
        padding: var(--size-1) var(--size-2);
        background: var(--background-modifier-success);
        color: var(--text-on-accent);
        border-radius: var(--radius-s);
        font-size: var(--font-ui-smaller);
        font-weight: var(--font-medium);
    }

    .header-divider {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 2px;
        background: linear-gradient(
            to right,
            var(--background-modifier-border),
            var(--interactive-accent),
            var(--background-modifier-border)
        );
    }

    /* Accordion Section */
    .settings-accordions {
        display: flex;
        flex-direction: column;
        gap: var(--size-4);
        padding: var(--size-4);
    }

    .accordion-wrapper {
        opacity: 0;
        transform: translateY(10px);
        animation: slideIn 0.3s ease-out forwards;
        animation-delay: var(--animation-delay, 0);
    }

    .accordion-wrapper.active {
        z-index: 1;
    }

    /* Animations */
    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateY(10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    /* Dark Mode Enhancements */
    :global(.theme-dark) .settings-header {
        background: linear-gradient(
            180deg,
            var(--background-primary) 0%,
            var(--background-primary-alt) 100%
        );
    }

    :global(.theme-dark) .accordion-wrapper {
        background-color: var(--background-primary-alt);
    }

    /* Responsive Design */
    @media (max-width: 768px) {
        .graphweaver-plugin-settings {
            padding: var(--size-2);
        }

        .settings-header {
            padding: var(--size-4);
            margin-bottom: var(--size-8);
        }

        .header-title h2 {
            font-size: var(--font-ui-large);
        }
    }
</style>