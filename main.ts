import { Plugin, Notice, Menu, TFile } from 'obsidian';
import { PluginSettings, DEFAULT_SETTINGS } from './src/settings/Settings';
import { AIService } from './src/services/AIService';
import { SettingsService } from './src/services/SettingsService';
import { DatabaseService } from './src/services/DatabaseService';
import { AutoGenerateService } from './src/services/AutoGenerateService';
import { JsonValidationService } from './src/services/JsonValidationService';
import { BatchProcessor } from './src/generators/BatchProcessor';
import { GraphWeaverSettingTab } from './src/settings/GraphWeaverSettingTab';
import { FileProcessingResult } from 'src/models/ProcessingTypes';
import { KnowledgeBloomModal } from 'src/components/modals/KnowledgeBloomModal';
/**
 * Main plugin class for GraphWeaver
 * Manages plugin lifecycle and coordinates services
 */
export default class GraphWeaverPlugin extends Plugin {
    public settings: PluginSettings;
    public settingsService: SettingsService;
    public aiService: AIService;
    public databaseService: DatabaseService;
    public autoGenerateService: AutoGenerateService;
    public jsonValidationService: JsonValidationService;
    public batchProcessor: BatchProcessor;
    public hasProcessedVaultStartup: boolean = false;

    /**
     * Initialize plugin on load
     */
    async onload(): Promise<void> {
        
        try {
            await this.initializeServices();
            this.addPluginFunctionality();
        } catch (error) {
            new Notice('Error loading GraphWeaver plugin. Check console for details.');
        }
    }

    /**
     * Initialize all plugin services
     */
    public async initializeServices(): Promise<void> {
        await this.loadSettings();
        
        this.settingsService = new SettingsService(this, this.settings);
        this.jsonValidationService = new JsonValidationService();
        this.databaseService = new DatabaseService();
        
        await this.databaseService.load(this.loadData.bind(this));
        
        this.aiService = new AIService(
            this.app,
            this.settingsService,
            this.jsonValidationService,
            this.databaseService
        );

        this.batchProcessor = new BatchProcessor(
            this.aiService.getCurrentAdapter(),
            this.settingsService,
            this.aiService.frontMatterGenerator,
            this.aiService.wikilinkGenerator,
            this.databaseService,
            this.app
        );

        this.autoGenerateService = new AutoGenerateService(
            this.app,
            this.app.vault,
            this.aiService,
            this.settingsService,
            this.databaseService,
            this.jsonValidationService
        );
    }

    /**
     * Add plugin functionality
     */
    public addPluginFunctionality(): void {
        this.addSettingTab(new GraphWeaverSettingTab(this.app, this));
        this.addRibbonIcon('brain-circuit', 'GraphWeaver', this.showPluginMenu.bind(this));
        this.addCommands();
        this.registerEvents();
    }

    /**
     * Register plugin events
     */
    public registerEvents(): void {
        // Only register layout-change event for startup
        this.registerEvent(
            this.app.workspace.on('layout-change', this.onLayoutChange.bind(this))
        );
    }

    /**
     * Add plugin commands
     */
    public addCommands(): void {
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

        this.addCommand({
            id: 'generate-knowledge-bloom',
            name: 'Generate Knowledge Bloom',
            callback: this.generateKnowledgeBloom.bind(this),
        });
    }

    /**
     * Handle layout changes - only triggers vault startup processing once
     */
    public onLayoutChange(): void {
        if (this.app.workspace.layoutReady && !this.hasProcessedVaultStartup) {
            this.onVaultOpen();
        }
    }

    /**
     * Handle vault opening - processes files only on initial startup
     */
    public async onVaultOpen(): Promise<void> {
        if (this.hasProcessedVaultStartup) {
            return;
        }

        if (this.settings.frontMatter.autoGenerate) {
            console.log('Processing vault on startup');
            await this.autoGenerateService.runAutoGenerate();
            this.hasProcessedVaultStartup = true;
        }
    }

    /**
     * Show plugin menu
     */
    public showPluginMenu(evt: MouseEvent): void {
        const menu = new Menu();
        
        menu.addItem((item) => item
            .setTitle('Generate Frontmatter')
            .setIcon('file-plus')
            .onClick(this.generateFrontmatter.bind(this)));
        
        menu.addItem((item) => item
            .setTitle('Generate Wikilinks')
            .setIcon('link')
            .onClick(this.generateWikilinks.bind(this)));
        
        menu.addItem((item) => item
            .setTitle('Generate Knowledge Bloom')
            .setIcon('flower')
            .onClick(this.generateKnowledgeBloom.bind(this)));
        
        menu.showAtMouseEvent(evt);
    }

    /**
     * Process a single file
     */
    public async processFile(
        file: TFile,
        generateFrontMatter: boolean,
        generateWikilinks: boolean
    ): Promise<FileProcessingResult> {
        const result = await this.batchProcessor.generate({
            files: [file],
            generateFrontMatter,
            generateWikilinks
        });
        return result.fileResults[0];
    }

    /**
     * Generate front matter for active file
     * Handles UI interaction and coordinates between services
     */
    public async generateFrontmatter(): Promise<void> {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('No active file. Please open a file to generate frontmatter.');
            return;
        }

        try {
            new Notice('Generating frontmatter...');
            const result = await this.batchProcessor.generate({
                files: [activeFile],
                generateFrontMatter: true,
                generateWikilinks: false
            });
            
            if (result.fileResults[0].success) {
                new Notice('Frontmatter generated successfully!');
            } else if (result.fileResults[0].error) {
                new Notice(`Error: ${result.fileResults[0].error}`);
            }
        } catch (error) {
            console.error('Error generating frontmatter:', error);
            new Notice('Error generating frontmatter. Check console for details.');
        }
    }

    /**
     * Generate wikilinks for active file
     * Handles UI interaction and coordinates between services
     */
    public async generateWikilinks(): Promise<void> {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('No active file. Please open a file to generate wikilinks.');
            return;
        }

        try {
            new Notice('Generating wikilinks...');
            const result = await this.batchProcessor.generate({
                files: [activeFile],
                generateFrontMatter: false,
                generateWikilinks: true
            });
            
            if (result.fileResults[0].success) {
                new Notice('Wikilinks generated successfully!');
            } else if (result.fileResults[0].error) {
                new Notice(`Error: ${result.fileResults[0].error}`);
            }
        } catch (error) {
            console.error('Error generating wikilinks:', error);
            new Notice('Error generating wikilinks. Check console for details.');
        }
    }

    /**
     * Generate knowledge bloom for active file
     * Handles UI interaction and file operations
     */
    public async generateKnowledgeBloom(): Promise<void> {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('No active file. Please open a file to generate Knowledge Bloom.');
            return;
        }

        // Show the modal instead of directly generating
        const modal = new KnowledgeBloomModal(
            this.app,
            activeFile,
            this.settingsService,
            this.aiService
        );
        modal.open();
    }

    /**
     * Create or update a note
     */
    public async createOrUpdateNote(title: string, content: string): Promise<void> {
        const filePath = `${title}.md`;
        const file = this.app.vault.getAbstractFileByPath(filePath);
        
        if (file instanceof TFile) {
            await this.app.vault.modify(file, content);
        } else {
            await this.app.vault.create(filePath, content);
        }
    }

    /**
     * Load plugin settings
     */
    public async loadSettings(): Promise<void> {
        const data = await this.loadData();
        this.settings = { ...DEFAULT_SETTINGS, ...data };
    }

    /**
     * Save plugin settings
     */
    public async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
        await this.settingsService.updateSettings(this.settings);
    }

    /**
     * Clean up on plugin unload
     */
    async onunload(): Promise<void> {
        console.log('Unloading GraphWeaver plugin');
        
        await this.databaseService.saveData(this.saveData.bind(this));
        
        if (this.autoGenerateService) {
            this.autoGenerateService.destroy();
        }


        this.hasProcessedVaultStartup = false;
    }

    // Public getters for plugin state
    public getSettings(): PluginSettings {
        return this.settings;
    }

    public getSettingsService(): SettingsService {
        return this.settingsService;
    }

    public getAIService(): AIService {
        return this.aiService;
    }
}