// src/components/accordions/OntologyGenerationAccordion.ts

import { App, Notice } from "obsidian";
import { BaseAccordion } from "./BaseAccordion";
import { SettingsService } from "../../services/SettingsService";
import { AIService } from "../../services/AIService";
import { OntologyGeneratorModal } from "../modals/OntologyGeneratorModal";
import { OntologyResult } from "../../generators/OntologyGenerator";

export class OntologyGenerationAccordion extends BaseAccordion {
    constructor(app: App, containerEl: HTMLElement, settingsService: SettingsService, aiService: AIService) {
        super(app, containerEl, settingsService, aiService);
    }

    public render(): void {
        const contentEl = this.createAccordion(
            "🕸 Ontology Generator",
            "Generate ontology tags for your knowledge base."
        );
        this.createDescription(contentEl);
        this.createGenerateButton(contentEl);
    }

    private createDescription(containerEl: HTMLElement): void {
        const descEl = containerEl.createDiv({ cls: "ontology-description" });
        descEl.createEl("p", { text: "The Ontology Generator analyzes your vault's structure, including tags, file names, and folder names, to create a comprehensive set of suggested tags. This tool helps you:" });
        
        const listEl = descEl.createEl("ul");
        [
            "Discover new connections in your knowledge base",
            "Improve note categorization and searchability",
            "Save time on manual tagging",
            "Gain insights into your collected information"
        ].forEach(item => {
            listEl.createEl("li", { text: item });
        });
    }

    private createGenerateButton(containerEl: HTMLElement): void {
        this.createButton(
            "",
            "",
            "Generate Ontology",
            () => this.openGeneratorModal(),
            true
        );
    }

    public openGeneratorModal(): void {
        new OntologyGeneratorModal(
            this.app,
            this.aiService,
            this.handleGeneratedOntology.bind(this)
        ).open();
    }

    public async handleGeneratedOntology(generatedOntology: OntologyResult): Promise<void> {
        
        const currentSettings = this.settingsService.getSettings();
        const updatedSettings = {
            ...currentSettings,
            ontology: {
                ...currentSettings.ontology,
                lastGenerated: JSON.stringify(generatedOntology)
            }
        };

        await this.settingsService.updateSettings(updatedSettings);

        new Notice("Ontology has been successfully generated and saved to your settings.");
    }
}