// src/components/accordions/OntologyGenerationAccordion.ts

import { App, Setting, ButtonComponent, Notice } from "obsidian";
import { BaseAccordion } from "./BaseAccordion";
import { SettingsService } from "../../services/SettingsService";
import { AIService } from "../../services/AIService";
import { OntologyGeneratorModal } from "../modals/OntologyGeneratorModal";
import { OntologyResult } from "../../generators/OntologyGenerator";

export class OntologyGenerationAccordion extends BaseAccordion {
    public settingsService: SettingsService;
    public aiService: AIService;
    public app: App;

    constructor(app: App, containerEl: HTMLElement, settingsService: SettingsService, aiService: AIService) {
        super(containerEl);
        this.app = app;
        this.settingsService = settingsService;
        this.aiService = aiService;
    }

    public render(): void {
        const contentEl = this.createAccordion("🧠 Ontology Generator");
        this.createDescription(contentEl);
        this.createGenerateButton(contentEl);
    }

    public createDescription(containerEl: HTMLElement): void {
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

    public createGenerateButton(containerEl: HTMLElement): void {
        new Setting(containerEl)
            .addButton(button => this.setupGenerateButton(button));
    }

    public setupGenerateButton(button: ButtonComponent): void {
        button
            .setButtonText("Generate Ontology")
            .setCta()
            .onClick(() => this.openGeneratorModal());
    }

    public openGeneratorModal(): void {
        new OntologyGeneratorModal(
            this.app,
            this.aiService,
            this.handleGeneratedOntology.bind(this)
        ).open();
    }

    public async handleGeneratedOntology(generatedOntology: OntologyResult): Promise<void> {
        console.log("Ontology generated:", generatedOntology);
        
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