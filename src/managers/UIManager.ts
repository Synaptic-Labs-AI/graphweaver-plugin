// src/ui/UIManager.ts

import { App, Menu, Command } from 'obsidian';
import GraphWeaverPlugin from 'main';
import { ProcessingStatusBar } from 'src/components/status/ProcessingStatusBar';
import { DatabaseService } from 'src/services/DatabaseService';

/**
 * Interface for UI event handlers
 */
interface UIEventHandlers {
    ribbonClick: (evt: MouseEvent) => void;
    [key: string]: (...args: any[]) => any;
}

/**
 * Interface for plugin commands
 */
interface PluginCommand {
    id: string;
    name: string;
    callback: () => void;
}

/**
 * Interface for menu items
 */
interface MenuItem {
    title: string;
    icon: string;
    callback: () => void;
}

/**
 * Manages all UI-related operations for the GraphWeaver plugin
 */
export class UIManager {
    private eventHandlers: UIEventHandlers;
    private commands: Map<string, Command>;
    private statusBarEl?: HTMLElement;
    private ribbonIcon?: HTMLElement;
    private isUnloading: boolean = false;
    private statusbar?: ProcessingStatusBar;

    constructor(
        private plugin: GraphWeaverPlugin,
        private app: App,
        private databaseService: DatabaseService // Added DatabaseService
    ) {
        this.eventHandlers = {
            ribbonClick: this.openPluginMenu.bind(this)
        };
        this.commands = new Map();
    }

    /**
     * Initialize UI components with proper sequencing
     */
    public async initialize(): Promise<void> {
        if (this.isUnloading) return;

        try {
            await this.initializeStatusBar();
            this.initializeRibbonIcon();
            this.initializeCommands();

            // Register cleanup
            this.plugin.register(() => {
                this.destroy();
            });

        } catch (error) {
            throw error;
        }
    }

    /**
     * Initialize the status bar component
     */
    private async initializeStatusBar(): Promise<void> {
        if (this.isUnloading) return;

        try {
            // Cleanup existing status bar
            if (this.statusbar) {
                this.statusbar.destroy();
            }
            
            // Create new status bar element
            this.statusBarEl = this.plugin.addStatusBarItem();
            
            // Initialize status bar component
            this.statusbar = new ProcessingStatusBar(
                this.app,
                this.statusBarEl,
                this.plugin.getStateManager(),
                this.plugin.getAIService(),
                this.plugin.getSettingsService(),
                this.databaseService, // Pass DatabaseService
                { 
                    showTooltips: true, 
                    updateInterval: 1000, 
                    animationEnabled: true 
                }
            );
        } catch (error) {
            console.error('Failed to initialize status bar:', error);
            throw error;
        }
    }

    /**
     * Initialize the ribbon icon with event tracking
     */
    private initializeRibbonIcon(): void {
        if (this.isUnloading) return;

        this.ribbonIcon = this.plugin.addRibbonIcon(
            'brain-circuit',
            'GraphWeaver',
            this.eventHandlers.ribbonClick
        );
    }

    /**
     * Initialize plugin commands with registration tracking
     */
    private initializeCommands(): void {
        if (this.isUnloading) return;

        const commands: PluginCommand[] = [
            {
                id: 'generate-frontmatter',
                name: 'Generate Front Matter',
                callback: () => this.plugin.getFileManager().generateFrontmatter()
            },
            {
                id: 'generate-wikilinks',
                name: 'Generate Wikilinks',
                callback: () => this.plugin.getFileManager().generateWikilinks()
            },
            {
                id: 'generate-knowledge-bloom',
                name: 'Generate Knowledge Bloom',
                callback: () => this.plugin.getFileManager().generateKnowledgeBloom()
            },
            {
                id: 'batch-process-files',
                name: 'Batch Process Files',
                callback: () => this.plugin.getFileManager().openBatchProcessor()
            }
        ];

        commands.forEach(command => {
            const registeredCommand = this.plugin.addCommand(command);
            if (registeredCommand) {
                this.commands.set(command.id, registeredCommand);
            } else {
                console.error(`UIManager: Failed to register command '${command.id}'.`);
            }
        });
    }

    /**
     * Open the plugin menu at mouse event location
     */
    private openPluginMenu(evt: MouseEvent): void {
        if (this.isUnloading) return;

        const menu = new Menu();
        this.addMenuItems(menu);
        menu.showAtMouseEvent(evt);
    }

    /**
     * Add menu items to the plugin menu
     */
    private addMenuItems(menu: Menu): void {
        if (this.isUnloading) return;

        const fileManager = this.plugin.getFileManager();
        const menuItems: MenuItem[] = [
            { 
                title: "Generate Front Matter", 
                icon: "tag", 
                callback: () => fileManager.generateFrontmatter() 
            },
            { 
                title: "Generate Wikilinks", 
                icon: "link", 
                callback: () => fileManager.generateWikilinks() 
            },
            { 
                title: "Generate Knowledge Bloom", 
                icon: "flower", 
                callback: () => fileManager.generateKnowledgeBloom() 
            },
            { 
                title: "Batch Process Files", 
                icon: "folder-sync", 
                callback: () => fileManager.openBatchProcessor() 
            }
        ];

        menuItems.forEach(item => {
            menu.addItem((menuItem) => {
                menuItem
                    .setTitle(item.title)
                    .setIcon(item.icon)
                    .onClick(() => {
                        if (!this.isUnloading) {
                            item.callback();
                        }
                    });
            });
        });
    }

    /**
     * Clean up UI resources
     */
    public async destroy(): Promise<void> {
        this.isUnloading = true;

        // Clean up status bar with proper type checking
        if (this.statusbar) {
            this.statusbar.destroy();
            this.statusbar = undefined;  // Use undefined instead of null
        }

        // Remove status bar element
        if (this.statusBarEl) {
            this.statusBarEl.remove();
            this.statusBarEl = undefined;
        }

        // Remove ribbon icon
        if (this.ribbonIcon) {
            this.ribbonIcon.remove();
            this.ribbonIcon = undefined;
        }

        // Clean up commands
        this.commands.forEach((command, id) => {
            this.plugin.removeCommand(id);
        });
        this.commands.clear();

        // Clean up event handlers
        Object.keys(this.eventHandlers).forEach(key => {
            this.eventHandlers[key] = () => {};
        });
    }
}
