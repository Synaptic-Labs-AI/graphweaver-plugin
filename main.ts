import { Plugin, PluginSettingTab, App, Notice, Menu, TFile } from 'obsidian';
import { PluginSettings, DEFAULT_SETTINGS } from './src/models/Settings';
import { AIService } from './src/services/AIService';
import { SettingsService } from './src/services/SettingsService';
import { DatabaseService } from './src/services/DatabaseService';
import { AutoGenerateService } from './src/services/AutoGenerateService';
import { ModelHookupAccordion } from './src/components/accordions/ModelHookupAccordion';
import { PropertyManagerAccordion } from './src/components/accordions/PropertyManagerAccordion';
import { TagManagerAccordion } from './src/components/accordions/TagManagerAccordion';
import { OntologyGenerationAccordion } from './src/components/accordions/OntologyGenerationAccordion';
import { BatchProcessorAccordion } from './src/components/accordions/BatchProcessorAccordion';
import { AdvancedAccordion } from './src/components/accordions/AdvancedAccordion';
import { JsonValidationService } from './src/services/JsonValidationService';

export default class GraphWeaverPlugin extends Plugin {
    public settings: PluginSettings;
    public settingsService: SettingsService;
    public aiService: AIService;
    public databaseService: DatabaseService;
    public autoGenerateService: AutoGenerateService;
    public jsonValidationService: JsonValidationService;

    async onload() {
        await this.initializeServices();
        this.addPluginFunctionality();
    }

    public async initializeServices() {
        await this.loadSettings();
        this.settingsService = new SettingsService(this, this.settings);
        this.databaseService = new DatabaseService();
        await this.databaseService.load(this.loadData.bind(this));
        this.jsonValidationService = new JsonValidationService();
        this.aiService = new AIService(this.app, this.settingsService, this.jsonValidationService);
        this.autoGenerateService = new AutoGenerateService(
            this.app.vault,
            this.aiService,
            this.settingsService,
            this.databaseService
        );
    }

    public addPluginFunctionality() {
        this.addSettingTab(new GraphWeaverSettingTab(this.app, this));
        this.addRibbonIcon('brain-circuit', 'GraphWeaver', this.showPluginMenu.bind(this));
        this.addCommands();
        this.registerEvent(this.app.workspace.on('layout-change', this.onLayoutChange.bind(this)));
    }

    public addCommands() {
        this.addCommand({
            id: 'generate-frontmatter',
            name: 'Generate Frontmatter',
            callback: this.generateFrontmatter.bind(this),
        });
        this.addCommand({
            id: 'generate-wikilinks',
            name: 'Generate Wikilinks',
            callback: this.generateWikilinks.bind(this),
        });
    }

    async onunload() {
        await this.databaseService.save(this.saveData.bind(this));
    }

    async loadSettings() {
        const data = await this.loadData();
        this.settings = { ...DEFAULT_SETTINGS, ...data };
    }

    async saveSettings() {
        await this.saveData(this.settings);
        await this.settingsService.updateSettings(this.settings);
    }

    public onLayoutChange() {
        if (this.app.workspace.layoutReady) {
            this.onVaultOpen();
        }
    }

    public async onVaultOpen() {
        if (this.settings.frontMatter.autoGenerate) {
            await this.autoGenerateService.runAutoGenerate();
        }
    }

    public showPluginMenu(evt: MouseEvent) {
        const menu = new Menu();
        menu.addItem((item) => item.setTitle('Generate Frontmatter').setIcon('file-plus').onClick(this.generateFrontmatter.bind(this)));
        menu.addItem((item) => item.setTitle('Generate Wikilinks').setIcon('link').onClick(this.generateWikilinks.bind(this)));
        menu.showAtMouseEvent(evt);
    }

    public async generateFrontmatter() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('No active file. Please open a file to generate frontmatter.');
            return;
        }

        try {
            new Notice('Generating frontmatter...');
            const content = await this.app.vault.read(activeFile);
            const frontMatter = await this.aiService.generateFrontMatter(content);
            const updatedContent = this.addOrUpdateFrontMatter(content, frontMatter);
            await this.app.vault.modify(activeFile, updatedContent);
            this.databaseService.markFileAsProcessed(activeFile);
            new Notice('Frontmatter generated and applied successfully!');
        } catch (error) {
            console.error('Error generating frontmatter:', error);
            new Notice('Error generating frontmatter. Please check the console for details.');
        }
    }

    public async generateWikilinks() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('No active file. Please open a file to generate wikilinks.');
            return;
        }

        try {
            new Notice('Generating wikilinks...');
            const content = await this.app.vault.read(activeFile);
            const updatedContent = await this.aiService.generateWikilinks(content);
            await this.app.vault.modify(activeFile, updatedContent);
            new Notice('Wikilinks generated and applied successfully!');
        } catch (error) {
            console.error('Error generating wikilinks:', error);
            new Notice('Error generating wikilinks. Please check the console for details.');
        }
    }

    public addOrUpdateFrontMatter(content: string, newFrontMatter: string): string {
        const frontMatterRegex = /^---\n([\s\S]*?)\n---/;
        const match = content.match(frontMatterRegex);

        if (match) {
            return content.replace(frontMatterRegex, newFrontMatter);
        } else {
            return `${newFrontMatter}\n\n${content}`;
        }
    }
}

class GraphWeaverSettingTab extends PluginSettingTab {
    constructor(app: App, public plugin: GraphWeaverPlugin) {
        super(app, plugin);
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'GraphWeaver Settings' });
        this.renderAccordions(containerEl);
    }

    public renderAccordions(containerEl: HTMLElement): void {
        new ModelHookupAccordion(this.app, containerEl, this.plugin.settingsService, this.plugin.aiService).render();
        new PropertyManagerAccordion(this.app, containerEl, this.plugin.settingsService, this.plugin.aiService).render();
        new TagManagerAccordion(this.app, containerEl, this.plugin.settingsService, this.plugin.aiService).render();
        new OntologyGenerationAccordion(this.app, containerEl, this.plugin.settingsService, this.plugin.aiService).render();
        new BatchProcessorAccordion(this.app, containerEl, this.plugin.settingsService, this.plugin.aiService).render();
        new AdvancedAccordion(containerEl, this.plugin.settingsService).render();
    }
}