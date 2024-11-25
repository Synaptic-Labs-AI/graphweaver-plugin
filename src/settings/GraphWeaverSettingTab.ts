// GraphWeaverSettingTab.ts
import { App, PluginSettingTab, Notice } from 'obsidian';
import type GraphWeaverPlugin from '../../main';
import SettingsTab from './SettingsTab.svelte';
import { debounce } from 'lodash';

/**
 * Settings tab for GraphWeaver plugin
 * Handles initialization, mounting, and lifecycle of settings components
 */
export class GraphWeaverSettingTab extends PluginSettingTab {
    private svelteComponent: SettingsTab | null = null;
    private mountElement: HTMLElement | null = null;
    private isInitialized = false;
    private initializationAttempts = 0;
    private readonly MAX_INIT_ATTEMPTS = 3;
    private readonly INIT_RETRY_DELAY = 1000; // ms

    // Debounced error handler to prevent error message spam
    private debouncedError = debounce((message: string) => {
        new Notice(`Settings Error: ${message}`);
    }, 1000, { leading: true, trailing: false });

    constructor(app: App, private plugin: GraphWeaverPlugin) {
        super(app, plugin);
        this.plugin = plugin;
        this.app = app;
    }

    /**
     * Safely initializes and displays the settings tab
     */
    async display(): Promise<void> {
        try {
            await this.ensureInitialization();
            await this.mountComponent();
        } catch (error) {
            console.error('🦇 Settings initialization failed:', error);
            await this.handleInitializationError(error);
        }
    }

    /**
     * Ensures proper initialization of required services
     */
    private async ensureInitialization(): Promise<void> {
        if (this.isInitialized) return;

        const { containerEl } = this;
        if (!containerEl) {
            throw new Error('Container element is not initialized');
        }

        // Wait for plugin services to be ready
        if (!this.plugin.isReady()) {
            await this.plugin.ensureInitialized();
        }

        containerEl.empty();
        this.isInitialized = true;
    }

    /**
     * Safely mounts the Svelte component
     */
    private async mountComponent(): Promise<void> {
        const { containerEl } = this;
        if (!containerEl || !this.isInitialized) return;

        try {
            // Create mount point with explicit parent
            const mountPoint = containerEl.createDiv();
            mountPoint.addClass('vertical-tab-content', 'graphweaver-settings');
            this.mountElement = mountPoint;

            // Only create new component if none exists
            if (!this.svelteComponent && mountPoint) {
                this.svelteComponent = new SettingsTab({
                    target: mountPoint,
                    props: {
                        app: this.app,
                        plugin: this.plugin,
                        settingsService: this.plugin.settings,
                        aiService: this.plugin.ai,
                        tagManagementService: this.plugin.tagManager,
                    }
                });
            }
        } catch (error) {
            throw new Error(`Failed to mount settings component: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Handles initialization errors with retry logic
     */
    private async handleInitializationError(error: unknown): Promise<void> {
        this.initializationAttempts++;
        
        if (this.initializationAttempts < this.MAX_INIT_ATTEMPTS) {
            console.log(`🦇 Retrying initialization (${this.initializationAttempts}/${this.MAX_INIT_ATTEMPTS})...`);
            
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, this.INIT_RETRY_DELAY));
            await this.display();
        } else {
            this.handleError(error);
            this.showFallbackUI();
        }
    }

    /**
     * Handles and displays errors
     */
    private handleError(error: unknown): void {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('🦇 Settings error:', error);
        this.debouncedError(message);
    }

    /**
     * Shows fallback UI when initialization fails
     */
    private showFallbackUI(): void {
        const { containerEl } = this;
        if (!containerEl) return;
        
        containerEl.empty();
        
        const errorEl = containerEl.createDiv();
        errorEl.addClass('settings-error');
        
        const messageEl = errorEl.createDiv();
        messageEl.setText('Failed to initialize settings. Please try reloading Obsidian.');
        
        const retryButton = errorEl.createEl('button');
        retryButton.setText('Retry');
        retryButton.onclick = async () => {
            this.initializationAttempts = 0;
            this.isInitialized = false;
            await this.display();
        };
    }

    /**
     * Safely cleans up the component and its resources
     */
    hide(): void {
        try {
            if (this.svelteComponent) {
                this.svelteComponent.$destroy();
                this.svelteComponent = null;
            }
            
            if (this.mountElement) {
                this.mountElement.empty();
                this.mountElement = null;
            }

            const { containerEl } = this;
            if (containerEl) {
                containerEl.empty();
            }

            this.isInitialized = false;
            this.initializationAttempts = 0;
        } catch (error) {
            console.error('🦇 Error during cleanup:', error);
        }
    }
}