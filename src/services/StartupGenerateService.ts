// src/services/StartupGenerateService.ts

import { App, TFile } from 'obsidian';
import { get, writable } from 'svelte/store';
import { FileProcessorService } from './file/FileProcessorService';
import { FileScannerService } from './file/FileScannerService';
import { SettingsService } from './SettingsService';
import { LifecycleState } from '@type/base.types';import { CoreService } from './core/CoreService';
import { ServiceError } from './core/ServiceError';

interface StartupState {
  isProcessing: boolean;
  processed: number;
  total: number;
  error?: string;
}

/**
 * Handles automatic frontmatter generation during plugin startup
 */
export class StartupGenerateService extends CoreService {
  private isInitialLoad: boolean = true;
  private startupTimeout?: number;

  // Svelte store for state management
  private startupState = writable<StartupState>({
    isProcessing: false,
    processed: 0,
    total: 0
  });

  constructor(
    private app: App,
    private settingsService: SettingsService,
    private fileScanner: FileScannerService,
    private fileProcessor: FileProcessorService
  ) {
    super('startup-generate', 'Startup Generate Service');
  }

  /**
   * Initialize service and run startup generation if enabled
   */
  protected async initializeInternal(): Promise<void> {
    try {
      if (!this.validateServices()) {
        throw new ServiceError(this.serviceName, 'Required services not initialized');
      }

      // Only run on initial load and if auto-generate is enabled
      if (this.isInitialLoad && this.shouldRunAutoGenerate()) {
        this.startupTimeout = window.setTimeout(() => {
          this.runStartupGenerate();
        }, 1000); // Brief delay to let app fully load
      }

      this.isInitialLoad = false;

    } catch (error) {
      throw new ServiceError(this.serviceName, 'Failed to initialize', error);
    }
  }

  /**
   * Run the startup generation process
   */
  private async runStartupGenerate(): Promise<void> {
    try {
      this.startupState.set({ isProcessing: true, processed: 0, total: 0 });

      // Get files needing frontmatter
      const files = await this.scanVaultFiles();
      
      if (files.length === 0) {
        this.startupState.set({ isProcessing: false, processed: 0, total: 0 });
        return;
      }

      // Process files in batches
      for (const file of files) {
        if (!this.isReady()) break;
        
        await this.fileProcessor.processSingleFile(file, {
          generateFrontMatter: true,
          generateWikilinks: false
        });

        this.startupState.update(s => ({
          ...s,
          processed: s.processed + 1
        }));
      }

      this.startupState.set({ isProcessing: false, processed: files.length, total: files.length });

    } catch (error) {
      this.startupState.update(s => ({
        ...s,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }

  /**
   * Scan vault for files needing frontmatter
   */
  private async scanVaultFiles(): Promise<TFile[]> {
    const allFiles = this.app.vault.getMarkdownFiles();
    const filesToProcess: TFile[] = [];

    for (const file of allFiles) {
      const hasFrontMatter = await this.fileScanner.hasFrontMatter(file);
      if (!hasFrontMatter) {
        filesToProcess.push(file);
      }
    }

    this.startupState.update(s => ({ ...s, total: filesToProcess.length }));
    return filesToProcess;
  }

  /**
   * Check if auto-generate should run based on settings
   */
  private shouldRunAutoGenerate(): boolean {
    const settings = this.settingsService.getSettings();
    return settings.frontMatter.autoGenerate;
  }

  /**
   * Validate required services exist
   */
  private validateServices(): boolean {
    return !!(
      this.fileProcessor &&
      this.fileScanner &&
      this.settingsService
    );
  }

  /**
   * Get current state
   */
  public getState(): { state: LifecycleState; error: ServiceError | null } {
    const startupState = get(this.startupState);
    return {
      state: startupState.error ? LifecycleState.Error : 
             startupState.isProcessing ? LifecycleState.Initializing : 
             LifecycleState.Ready,
      error: startupState.error ? new ServiceError(this.serviceName, startupState.error) : null
    };
  }

  /**
   * Clean up resources
   */
  protected async destroyInternal(): Promise<void> {
    if (this.startupTimeout) {
      clearTimeout(this.startupTimeout);
    }
    this.startupState.set({ isProcessing: false, processed: 0, total: 0 });
  }
}