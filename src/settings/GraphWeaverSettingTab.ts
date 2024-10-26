// src/settings/GraphWeaverSettingTab.ts

import { App, PluginSettingTab } from 'obsidian';
import GraphWeaverPlugin from '../../main'; // Adjust based on your project structure

// Import each accordion individually
import { ModelHookupAccordion } from '../components/accordions/ModelHookupAccordion';
import { PropertyManagerAccordion } from '../components/accordions/PropertyManagerAccordion';
import { TagManagerAccordion } from '../components/accordions/TagManagerAccordion';
import { OntologyGenerationAccordion } from '../components/accordions/OntologyGenerationAccordion';
import { BatchProcessorAccordion } from '../components/accordions/BatchProcessorAccordion';
import { AdvancedAccordion } from '../components/accordions/AdvancedAccordion';
import { KnowledgeBloomAccordion } from '../components/accordions/KnowledgeBloomAccordion';

export class GraphWeaverSettingTab extends PluginSettingTab {
    plugin: GraphWeaverPlugin; // Replace with your actual plugin type

    constructor(app: App, plugin: GraphWeaverPlugin) { // Ensure correct types
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        containerEl.createEl('h2', { text: 'GraphWeaver Settings' });

        // Instantiate and render each accordion with required arguments
        const modelHookupContainer = containerEl.createDiv();
        new ModelHookupAccordion(
            this.app,
            modelHookupContainer,
            this.plugin.settingsService,
            this.plugin.aiService
        ).render();

        const propertyManagerContainer = containerEl.createDiv();
        new PropertyManagerAccordion(
            this.app,
            propertyManagerContainer,
            this.plugin.settingsService,
            this.plugin.aiService
        ).render();

        const tagManagerContainer = containerEl.createDiv();
        new TagManagerAccordion(
            this.app,
            tagManagerContainer,
            this.plugin.settingsService,
            this.plugin.aiService
        ).render();

        const ontologyGenerationContainer = containerEl.createDiv();
        new OntologyGenerationAccordion(
            this.app,
            ontologyGenerationContainer,
            this.plugin.settingsService,
            this.plugin.aiService
        ).render();

        const batchProcessorContainer = containerEl.createDiv();
        new BatchProcessorAccordion(
            this.app,
            batchProcessorContainer,
            this.plugin.settingsService,
            this.plugin.aiService
        ).render();

        const advancedContainer = containerEl.createDiv();
        new AdvancedAccordion(
            this.app,
            advancedContainer,
            this.plugin.settingsService,
            this.plugin.aiService
        ).render();

        const knowledgeBloomContainer = containerEl.createDiv();
        new KnowledgeBloomAccordion(
            this.app,
            knowledgeBloomContainer,
            this.plugin.settingsService,
            this.plugin.aiService
        ).render();
    }
}
