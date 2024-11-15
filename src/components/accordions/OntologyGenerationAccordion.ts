// src/components/accordions/OntologyGenerationAccordion.ts

import { App, Notice, Setting, ButtonComponent } from 'obsidian'; // Add missing imports
import { BaseAccordion } from './BaseAccordion';
import { AIService } from '../../services/ai/AIService';
import { SettingsService } from '../../services/SettingsService';
import { AIGenerationService } from '../../services/ai/AIGenerationService';
import { AdapterRegistry } from '../../services/ai/AdapterRegistry';
import { OntologyGeneratorModal } from '../modals/OntologyGeneratorModal';
import { OntologyResult } from '../../models/OntologyTypes';
import { TagManagementService } from '../../services/ai/AITagManagementService';
/**
 * Interface for accordion dependencies
 */
interface AccordionDependencies {
    app: App;
    settingsService: SettingsService;
    aiService: AIService;
    generationService: AIGenerationService;
    adapterRegistry: AdapterRegistry;
    tagManagementService: TagManagementService;
}

/**
 * Accordion for ontology generation functionality
 */
export class OntologyGenerationAccordion extends BaseAccordion {
    private modal: OntologyGeneratorModal | null = null;
    private generateButton: ButtonComponent | null = null;

    constructor(
        public app: App,
        containerEl: HTMLElement,
        private deps: AccordionDependencies
    ) {
        super(containerEl, app);
    }

    /**
     * Render the accordion content
     */
    public render(): void {
        const contentEl = this.createAccordion(
            "🕸 Ontology Generator",
            "Generate ontology tags for your knowledge base."
        );

        // Add content sections
        this.renderDescription(contentEl);
        this.renderFeatures(contentEl);
        this.renderGenerateButton(contentEl);

        // Register cleanup on close
        this.registerCleanup();
    }

    /**
     * Render the description section
     */
    private renderDescription(containerEl: HTMLElement): void {
        const descEl = containerEl.createDiv({ cls: "ontology-description" });
        
        descEl.createEl("p", { 
            text: "The Ontology Generator analyzes your vault's structure, " +
                  "including tags, file names, and folder names, to create a " +
                  "comprehensive set of suggested tags. This tool helps you:",
            cls: "ontology-description-text"
        });
    }

    /**
     * Render features list
     */
    private renderFeatures(containerEl: HTMLElement): void {
        const featuresList = containerEl.createEl("ul", { cls: "features-list" });
        
        const features = [
            "Discover new connections in your knowledge base",
            "Improve note categorization and searchability",
            "Save time on manual tagging",
            "Gain insights into your collected information"
        ];

        features.forEach(feature => {
            featuresList.createEl("li", { 
                text: feature,
                cls: "feature-item"
            });
        });
    }

    /**
     * Create and render generate button
     */
    private renderGenerateButton(containerEl: HTMLElement): void {
        const buttonContainer = containerEl.createDiv({ 
            cls: 'generate-button-container' 
        });

        new Setting(buttonContainer)
            .addButton(button => {
                this.generateButton = button;
                button
                    .setButtonText("Generate Ontology")
                    .setCta()
                    .onClick(() => this.handleGenerateClick());
                return button;
            });
    }

    /**
     * Handle generate button click
     */
    private async handleGenerateClick(): Promise<void> {
        if (!this.ensureServicesReady()) {
            return;
        }

        try {
            this.disableButton();
            await this.openGeneratorModal();
        } catch (error) {
            this.handleError("Failed to open generator modal", error);
        } finally {
            this.enableButton();
        }
    }

    /**
     * Open the generator modal
     */
    private async openGeneratorModal(): Promise<void> {
        try {
            if (this.modal) {
                this.modal.close();
            }
    
            // Reorder arguments to match modal constructor signature
            this.modal = new OntologyGeneratorModal(
                this.app,
                this.deps.aiService,
                this.deps.generationService,
                this.deps.tagManagementService, // Move tagManagementService to correct position
                this.handleGeneratedOntology.bind(this),
                this.deps.adapterRegistry  // Move adapterRegistry to last position
            );
    
            this.modal.open();
        } catch (error) {
            this.handleError("Failed to open modal", error);
        }
    }

    /**
     * Handle generated ontology result
     */
    private async handleGeneratedOntology(ontology: OntologyResult): Promise<void> {
        try {
            const currentSettings = this.deps.settingsService.getSettings();
            
            // Update settings with new ontology
            const updatedSettings = {
                ...currentSettings,
                ontology: {
                    ...currentSettings.ontology,
                    lastGenerated: JSON.stringify(ontology)
                }
            };

            await this.deps.settingsService.updateSettings(updatedSettings);
            new Notice("Ontology has been successfully generated and saved!");
        } catch (error) {
            this.handleError("Failed to save generated ontology", error);
        }
    }

    /**
     * Check if all required services are ready
     */
    private ensureServicesReady(): boolean {
        if (!this.deps.aiService.isReady()) {
            new Notice("AI Service is not ready. Please check your settings.");
            return false;
        }

        if (!this.deps.generationService || !this.deps.adapterRegistry) {
            return false;
        }

        return true;
    }

    /**
     * Handle errors consistently
     */
    private handleError(context: string, error: unknown): void {
        console.error(`Ontology Generation Error: ${context}`, error);
        new Notice(`${context}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    /**
     * Enable generate button
     */
    private enableButton(): void {
        if (this.generateButton) {
            this.generateButton.setDisabled(false);
            this.generateButton.setButtonText("Generate Ontology");
        }
    }

    /**
     * Disable generate button
     */
    private disableButton(): void {
        if (this.generateButton) {
            this.generateButton.setDisabled(true);
            this.generateButton.setButtonText("Generating...");
        }
    }

    /**
     * Register cleanup handlers
     */
    private registerCleanup(): void {
        // Register cleanup using Component's lifecycle methods
        this.register(() => {
            if (this.modal) {
                this.modal.close();
                this.modal = null;
            }
        });
    }
}