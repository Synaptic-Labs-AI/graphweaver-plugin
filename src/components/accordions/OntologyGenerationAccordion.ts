import { App, Notice, ButtonComponent } from 'obsidian';
import { BaseAccordion } from './BaseAccordion';
import { SettingsService } from '../../services/SettingsService';
import { AIGenerationService } from '../../services/ai/AIGenerationService';
import { AdapterRegistry } from '../../services/ai/AdapterRegistry';
import { OntologyGeneratorModal } from '../modals/OntologyGeneratorModal';
import { OntologyResult } from '../../models/OntologyTypes';
import { TagManagementService } from '../../services/ai/AITagManagementService';
import { AIAdapter } from 'src/models/AIModels';
import { EditTagsModal } from '../modals/EditTagsModal';
import { Tag, PropertyType } from '../../models/PropertyTag';

interface AccordionDependencies {
    app: App;
    settingsService: SettingsService;
    aiAdapter: AIAdapter;
    generationService: AIGenerationService;
    adapterRegistry: AdapterRegistry;
    tagManagementService: TagManagementService;
}

export class OntologyGenerationAccordion extends BaseAccordion {
    private modal: OntologyGeneratorModal | null = null;
    private generateButton: ButtonComponent | null = null;

    private readonly settingsService: SettingsService;
    private readonly aiAdapter: AIAdapter;
    private readonly generationService: AIGenerationService;
    private readonly adapterRegistry: AdapterRegistry;
    private readonly tagManagementService: TagManagementService;

    constructor(
        dependencies: AccordionDependencies,
        containerEl: HTMLElement
    ) {
        super(containerEl, dependencies.app);
        
        this.settingsService = dependencies.settingsService;
        this.aiAdapter = dependencies.aiAdapter;
        this.generationService = dependencies.generationService;
        this.adapterRegistry = dependencies.adapterRegistry;
        this.tagManagementService = dependencies.tagManagementService;
    }

    public render(): void {
        const contentEl = this.createAccordion(
            "🧠 Ontology Generation",
            "Generate and manage ontologies for your application."
        );
        this.createGenerateButton();
    }

    private createGenerateButton(): void {
        this.generateButton = this.addButton(
            "Generate Ontology",
            () => this.openOntologyGeneratorModal(),
            true
        );
    }

    private openOntologyGeneratorModal(): void {
        try {
            if (!this.modal) {
                this.modal = new OntologyGeneratorModal(
                    this.appInstance,
                    this.aiAdapter,
                    this.generationService,
                    this.tagManagementService,
                    (ontology: OntologyResult) => this.handleOntologyGenerated(ontology),
                    this.adapterRegistry
                );
            }
            this.modal.open();
        } catch (error) {
            console.error('Failed to open ontology generator:', error);
            new Notice(`Failed to open ontology generator: ${
                error instanceof Error ? error.message : 'Unknown error'
            }`);
        }
    }

    private handleOntologyGenerated(ontology: OntologyResult): void {
        try {
            if (!ontology?.suggestedTags?.length) {
                throw new Error('No tags suggested in ontology result');
            }

            // Convert ontology tags to the Tag format
            const existingTags = this.settingsService.getSettings().tags.customTags;
            const newTags = this.convertOntologyToTags(ontology.suggestedTags, existingTags);

            // Open EditTagsModal with combined tags
            const editTagsModal = new EditTagsModal(
                this.appInstance,
                newTags,
                async (updatedTags: Tag[]) => {
                    try {
                        await this.settingsService.updateNestedSetting(
                            'tags',
                            'customTags',
                            updatedTags
                        );
                        new Notice('Tags updated successfully');
                    } catch (error) {
                        console.error('Failed to save tags:', error);
                        new Notice(`Failed to save tags: ${
                            error instanceof Error ? error.message : 'Unknown error'
                        }`);
                    }
                }
            );

            editTagsModal.open();
            new Notice("Ontology generated successfully. Please review the suggested tags.");

        } catch (error) {
            console.error('Failed to handle generated ontology:', error);
            new Notice(`Failed to process ontology: ${
                error instanceof Error ? error.message : 'Unknown error'
            }`);
        }
    }

    /**
     * Convert ontology suggested tags to Tag format, merging with existing tags
     */
    private convertOntologyToTags(suggestedTags: Tag[], existingTags: Tag[]): Tag[] {
        // Create a map of existing tags by name for easy lookup
        const existingTagMap = new Map(existingTags.map(tag => [tag.name.toLowerCase(), tag]));
        
        // Process suggested tags
        const processedTags: Tag[] = suggestedTags.map(suggestedTag => {
            const existingTag = existingTagMap.get(suggestedTag.name.toLowerCase());
            
            if (existingTag) {
                return {
                    ...existingTag,
                    description: existingTag.description || suggestedTag.description
                };
            }

            // Create new tag with explicit PropertyType
            const newTag: Tag = {
                name: suggestedTag.name,
                description: suggestedTag.description,
                type: 'string' as PropertyType, // Explicit type assertion
                required: false,
                multipleValues: false,
                defaultValue: undefined,
                options: undefined
            };

            return newTag;
        });

        // Add remaining existing tags
        existingTags.forEach(existingTag => {
            if (!processedTags.some(tag => tag.name.toLowerCase() === existingTag.name.toLowerCase())) {
                processedTags.push({ ...existingTag });
            }
        });

        return processedTags;
    }

    /**
     * Cleanup resources
     */
    public async onunload(): Promise<void> {
        if (this.modal) {
            this.modal = null;
        }
        if (this.generateButton) {
            this.generateButton = null;
        }
        await super.onunload();
    }
}