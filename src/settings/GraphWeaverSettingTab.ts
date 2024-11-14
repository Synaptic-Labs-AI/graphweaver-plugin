// src/settings/GraphWeaverSettingTab.ts

import { App, PluginSettingTab, Notice } from 'obsidian';
import GraphWeaverPlugin from '../../main';

// Import accordion components
import { ModelHookupAccordion } from '../components/accordions/ModelHookupAccordion';
import { PropertyManagerAccordion } from '../components/accordions/PropertyManagerAccordion';
import { TagManagerAccordion } from '../components/accordions/TagManagerAccordion';
import { OntologyGenerationAccordion } from '../components/accordions/OntologyGenerationAccordion';
import { BatchProcessorAccordion } from '../components/accordions/BatchProcessorAccordion';
import { AdvancedAccordion } from '../components/accordions/AdvancedAccordion';
import { KnowledgeBloomAccordion } from '../components/accordions/KnowledgeBloomAccordion';

// Import services
import { AIService } from '../services/ai/AIService';
import { SettingsService } from '../services/SettingsService';
import { AIGenerationService } from '../services/ai/AIGenerationService';
import { AdapterRegistry } from '../services/ai/AdapterRegistry';
import { TagManagementService } from '../services/ai/AITagManagementService';

/**
 * Interface for core services needed by accordions
 */
interface CoreServices {
    app: App;
    aiService: AIService;
    settingsService: SettingsService;
}

/**
 * Interface for optional services
 */
interface OptionalServices {
    generationService?: AIGenerationService;
    adapterRegistry?: AdapterRegistry;
    tagManagementService?: TagManagementService;
}

/**
 * Interface combining all services
 */
interface AccordionServices extends CoreServices, OptionalServices {}

/**
 * Interface for accordion sections
 */
interface AccordionSection {
    title: string;
    description?: string;
    render: (containerEl: HTMLElement) => void;
    priority?: number; // Optional priority for ordering
}

/**
 * Main settings tab for GraphWeaver plugin
 */
export class GraphWeaverSettingTab extends PluginSettingTab {
    private accordions: Map<string, AccordionSection>;
    private services: AccordionServices;
    private isInitialized: boolean = false;

    constructor(app: App, private plugin: GraphWeaverPlugin) {
        super(app, plugin);
        this.accordions = new Map();
        this.initializeServices();
        this.initializeAccordions();
    }

    /**
     * Initialize required services with null checks and safe access
     */
    private initializeServices(): void {
        try {
            // Verify plugin and core services exist first using getters
            const aiService = this.plugin?.getAIService();
            if (!aiService) {
                throw new Error('AIService not initialized');
            }

            const settingsService = this.plugin?.getSettingsService();
            if (!settingsService) {
                throw new Error('SettingsService not initialized'); 
            }

            // Initialize tag management first since it has no dependencies
            const tagManagementService = new TagManagementService(this.app);

            // Get generation service and adapter registry safely
            let generationService: AIGenerationService | undefined;
            let adapterRegistry: AdapterRegistry | undefined;

            try {
                generationService = aiService.getGenerationService();
                adapterRegistry = aiService.getAdapterRegistry();
            } catch (err) {
                console.warn('Optional services not available:', err);
                // Continue initialization without optional services
            }

            // Initialize core services
            this.services = {
                app: this.app,
                aiService: aiService,
                settingsService: settingsService,
                
                // Optional services - only set if available
                generationService,
                adapterRegistry, 
                tagManagementService
            };

            this.isInitialized = true;

        } catch (error) {
            console.error('Failed to initialize services:', error);
            new Notice('Failed to initialize settings tab services');
            
            // Set initialized to false to prevent accordion initialization
            this.isInitialized = false;
        }
    }

    /**
     * Initialize accordion sections
     */
    private initializeAccordions(): void {
        if (!this.isInitialized) {
            console.error('Cannot initialize accordions: services not initialized');
            return;
        }

        const accordionConfigs: Array<{id: string; section: AccordionSection}> = [
            {
                id: 'modelHookup',
                section: {
                    title: 'Model Hookup',
                    description: 'Configure AI providers and models',
                    priority: 1,
                    render: (containerEl) => this.createAccordion(
                        containerEl,
                        () => new ModelHookupAccordion(
                            this.services.app,
                            containerEl,
                            this.services.settingsService,
                            this.services.aiService
                        )
                    )
                }
            },
            {
                id: 'knowledgeBloom',
                section: {
                    title: 'Knowledge Bloom',
                    description: 'Generate notes from wikilinks',
                    priority: 2,
                    render: (containerEl) => this.createAccordion(
                        containerEl,
                        () => new KnowledgeBloomAccordion(
                            this.services.app,
                            containerEl,
                            this.services.settingsService,
                            this.services.aiService
                        )
                    )
                }
            },
            {
                id: 'ontologyGeneration',
                section: {
                    title: 'Ontology Generation',
                    description: 'Generate and manage ontologies',
                    priority: 3,
                    render: (containerEl) => this.createAccordion(
                        containerEl,
                        () => new OntologyGenerationAccordion(
                            this.services.app,
                            containerEl,
                            {
                                app: this.services.app,
                                settingsService: this.services.settingsService,
                                aiService: this.services.aiService,
                                generationService: this.services.generationService!,
                                adapterRegistry: this.services.adapterRegistry!,
                                tagManagementService: this.services.tagManagementService!
                            }
                        )
                    )
                }
            },
            {
                id: 'propertyManager',
                section: {
                    title: 'Property Manager',
                    description: 'Manage custom properties',
                    priority: 4,
                    render: (containerEl) => this.createAccordion(
                        containerEl,
                        () => new PropertyManagerAccordion(
                            this.services.app,
                            containerEl,
                            this.services.settingsService,
                            this.services.aiService
                        )
                    )
                }
            },
            {
                id: 'tagManager',
                section: {
                    title: 'Tag Manager',
                    description: 'Manage custom tags',
                    priority: 5,
                    render: (containerEl) => this.createAccordion(
                        containerEl,
                        () => new TagManagerAccordion(
                            this.services.app,
                            containerEl,
                            this.services.settingsService,
                            this.services.aiService
                        )
                    )
                }
            },
            {
                id: 'batchProcessor',
                section: {
                    title: 'Batch Processor',
                    description: 'Process multiple files',
                    priority: 6,
                    render: (containerEl) => this.createAccordion(
                        containerEl,
                        () => new BatchProcessorAccordion(
                            this.services.app,
                            containerEl,
                            this.services.settingsService,
                            this.services.aiService
                        )
                    )
                }
            },
            {
                id: 'advanced',
                section: {
                    title: 'Advanced Settings',
                    description: 'Configure advanced options',
                    priority: 7,
                    render: (containerEl) => this.createAccordion(
                        containerEl,
                        () => new AdvancedAccordion(
                            this.services.app,
                            containerEl,
                            this.services.settingsService,
                            this.services.aiService
                        )
                    )
                }
            }
        ];

        // Sort and add accordions
        accordionConfigs
            .sort((a, b) => (a.section.priority || 0) - (b.section.priority || 0))
            .forEach(({id, section}) => this.accordions.set(id, section));
    }

/**
 * Create an accordion with error handling
 * @param containerEl The container element
 * @param factory Factory function that creates an accordion
 */
private createAccordion<T extends { render: () => void }>(
    containerEl: HTMLElement,
    factory: () => T
): void {
    try {
        const accordion = factory();
        accordion.render();
    } catch (error) {
        console.error('Error creating accordion:', error);
        this.renderErrorState(containerEl, 'Failed to create accordion');
    }
}

    /**
     * Display settings UI
     */
    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.addClass('graphweaver-plugin-settings');

        this.createHeader(containerEl);
        this.renderAccordions(containerEl);
    }

    /**
     * Create settings header
     */
    private createHeader(containerEl: HTMLElement): void {
        const headerEl = containerEl.createEl('div', { cls: 'settings-header' });
        
        headerEl.createEl('h2', { 
            text: 'GraphWeaver Settings',
            cls: 'settings-header-title' 
        });

        headerEl.createEl('p', {
            text: 'Configure AI models, manage properties and tags, and customize your knowledge graph generation.',
            cls: 'settings-header-description'
        });
    }

    /**
     * Render all accordion sections
     */
    private renderAccordions(containerEl: HTMLElement): void {
        if (!this.isInitialized) {
            this.renderErrorState(containerEl, 'Settings not initialized');
            return;
        }

        const accordionsContainer = containerEl.createDiv({
            cls: 'settings-accordions'
        });

        for (const [id, accordion] of this.accordions) {
            const sectionEl = accordionsContainer.createDiv({
                cls: 'settings-section',
                attr: { 'data-section-id': id }
            });

            try {
                accordion.render(sectionEl);
            } catch (error) {
                console.error(`Error rendering accordion ${id}:`, error);
                this.renderErrorState(sectionEl, accordion.title);
            }
        }
    }

    /**
     * Render error state for failed accordion
     */
    private renderErrorState(containerEl: HTMLElement, title: string): void {
        const errorEl = containerEl.createDiv({ cls: 'settings-section-error' });
        
        errorEl.createEl('h3', { 
            text: title,
            cls: 'settings-section-error-title'
        });
        
        errorEl.createEl('p', {
            text: 'Failed to load this section. Please try reloading the plugin.',
            cls: 'settings-section-error-message'
        });
    }

    /**
     * Hide settings UI
     */
    hide(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.removeClass('graphweaver-plugin-settings');
    }
}