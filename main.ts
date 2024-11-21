import { Plugin, Notice } from 'obsidian';
import { 
    initializeStores, 
    initializeCoreServices,
    registerAIServices,
    registerFileServices,
    registerUIServices,
    initializeUIServices,
    destroyUIServices
} from '@registrations/index';
import { GraphWeaverSettingTab } from '@settings/GraphWeaverSettingTab';
import { ServiceRegistry } from '@registrations/ServiceRegistrations';
import { CommandManager } from '@managers/CommandManager';
import { pluginStore } from '@stores/index';
import type { PluginCommand } from '@type/commands.types';

/**
 * GraphWeaver Plugin
 * Implements AI-powered knowledge graph generation for Obsidian
 */
export default class GraphWeaverPlugin extends Plugin {
    private readonly CONFIG = {
        INIT_RETRY_MS: 5000,
        MAX_INIT_RETRIES: 3,
        SAVE_INTERVAL_MS: 1000
    };

    private commandManager: CommandManager = new CommandManager(this);
    private initRetryCount = 0;
    private isInitialized = false;

    /**
     * Plugin load lifecycle method
     */
    async onload(): Promise<void> {

        try {
            // Core Initialization
            await this.initializeCore();
            
            // Feature Registration
            await this.registerFeatures();

            this.isInitialized = true;
            new Notice('GraphWeaver initialized successfully! 🚀');
        } catch (error) {
            await this.handleInitializationError(error);
        }
    }

    /**
     * Initialize core plugin components
     */
    private async initializeCore(): Promise<void> {
        // Load saved data and initialize stores
        const savedData = await this.loadData();
        await initializeStores({
            plugin: this,
            data: savedData
        });

        // Initialize core services and registries
        await initializeCoreServices(this);
        await registerAIServices(this.app, this);
        await registerFileServices(this.app);
        await registerUIServices();
        await initializeUIServices();
    }

    /**
     * Register plugin features and UI elements
     */
    private async registerFeatures(): Promise<void> {
        // Settings & UI
        this.addSettingTab(new GraphWeaverSettingTab(this.app, this));
        await initializeUIServices();

        // Register default commands
        const defaultCommands: PluginCommand[] = [
            {
                id: 'generate-frontmatter',
                name: 'Generate Front Matter',
                checkCallback: (checking: boolean) => this.commandManager.validateActiveFile(checking)
            }
            // ... add other commands as needed
        ];

        for (const command of defaultCommands) {
            await this.commandManager.registerCommand(command);
        }

        // Setup auto-save
        this.registerInterval(
            window.setInterval(
                () => this.saveData(pluginStore.get()),
                this.CONFIG.SAVE_INTERVAL_MS
            )
        );
    }

    /**
     * Handle initialization errors with retry logic
     */
    private async handleInitializationError(error: unknown): Promise<void> {

        if (this.initRetryCount < this.CONFIG.MAX_INIT_RETRIES) {
            this.initRetryCount++;
            new Notice(`Initialization failed. Retrying... (${this.initRetryCount}/${this.CONFIG.MAX_INIT_RETRIES})`);
            
            setTimeout(() => this.onload(), this.CONFIG.INIT_RETRY_MS);
        } else {
            new Notice('Failed to initialize plugin. Please restart Obsidian.');
            throw error;
        }
    }

    /**
     * Plugin unload lifecycle method
     */
    async onunload(): Promise<void> {
        
        try {
            // Cleanup managers
            await this.commandManager?.destroy();
            await destroyUIServices();
            await ServiceRegistry.getInstance().destroyAll();

        } catch (error) {
            console.error('Error during plugin unload:', error);
        }
    }

    /**
     * Public getter for initialization state
     */
    public isReady(): boolean {
        return this.isInitialized;
    }
}