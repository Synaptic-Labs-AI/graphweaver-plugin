// src/services/DatabaseService.ts

import type { Plugin, TFile } from 'obsidian';
import { CoreService } from './core/CoreService';
import { ServiceError } from './core/ServiceError';
import type { IConfigurableService } from './core/IService';
import type {
    ProcessingStats,
    ProcessingError,
    FileProcessingResult
} from '@type/processing.types';
import { processingStore } from '@stores/ProcessingStore';

/**
 * Configuration options for DatabaseService
 */
export interface DatabaseConfig {
    maxHistoryLength: number;
    pruneThreshold: number;
    processingCooldown: number;
}

/**
 * Enhanced DatabaseService that extends CoreService
 */
export class DatabaseService extends CoreService implements IConfigurableService<DatabaseConfig> {
    private static instance: DatabaseService | null = null;
    private readonly MONTH_IN_MS = 30 * 24 * 60 * 60 * 1000;
    
    private config: Required<DatabaseConfig> = {
        maxHistoryLength: 100,
        pruneThreshold: 1000,
        processingCooldown: 5000
    };

    private processedFiles: Set<string> = new Set();
    private recentlyProcessed: Map<string, number> = new Map();
    private processingQueue: Set<string> = new Set();

    constructor(private readonly plugin: Plugin) {
        super('database-service', 'Database Service');
        
        if (DatabaseService.instance) {
            return DatabaseService.instance;
        }

        DatabaseService.instance = this;
    }

    /**
     * Initialize database service
     */
    protected async initializeInternal(): Promise<void> {
        try {
            const savedData = await this.plugin.loadData();
            if (savedData) {
                await this.loadSavedData(savedData);
            }
            await this.updateProcessingStore();
        } catch (error) {
            this.handleError('Failed to initialize database', error);
        }
    }

    /**
     * Clean up resources
     */
    protected async destroyInternal(): Promise<void> {
        this.recentlyProcessed.clear();
        this.processingQueue.clear();
        processingStore.update(state => ({
            ...state,
            databaseReady: false
        }));
    }

    /**
     * Configure service settings
     */
    public async configure(config: Partial<DatabaseConfig>): Promise<void> {
        this.config = {
            ...this.config,
            ...config
        };
    }

    /**
     * Track file processing
     */
    public trackFileProcessing(filePath: string): void {
        this.recentlyProcessed.set(filePath, Date.now());
        this.processingQueue.add(filePath);

        processingStore.update(state => ({
            ...state,
            currentFile: filePath
        }));

        setTimeout(() => {
            this.recentlyProcessed.delete(filePath);
            this.processingQueue.delete(filePath);
        }, this.config.processingCooldown);
    }

    /**
     * Check if file needs processing
     */
    public needsProcessing(file: TFile): boolean {
        if (this.processingQueue.has(file.path)) {
            return false;
        }

        const lastProcessTime = this.recentlyProcessed.get(file.path);
        if (lastProcessTime && (Date.now() - lastProcessTime) < this.config.processingCooldown) {
            return false;
        }

        return !this.processedFiles.has(file.path);
    }

    /**
     * Mark file as processed
     */
    public async markFileAsProcessed(file: TFile, result: FileProcessingResult): Promise<void> {
        this.processedFiles.add(file.path);
        this.trackFileProcessing(file.path);
        await this.saveData();
    }

    /**
     * Load saved data
     */
    private async loadSavedData(savedData: any): Promise<void> {
        if (savedData.processedFiles) {
            this.processedFiles = new Set(savedData.processedFiles);
        }
    }

    /**
     * Save current state
     */
    private async saveData(): Promise<void> {
        try {
            const data = {
                processedFiles: Array.from(this.processedFiles),
                lastUpdated: Date.now()
            };
            await this.plugin.saveData(data);
            await this.updateProcessingStore();
        } catch (error) {
            this.handleError('Failed to save data', error);
        }
    }

    /**
     * Update processing store state
     */
    private async updateProcessingStore(): Promise<void> {
        processingStore.update(state => ({
            ...state,
            databaseReady: true,
            totalProcessed: this.processedFiles.size,
            filesProcessing: Array.from(this.processingQueue)
        }));
    }

    /**
     * Get singleton instance
     */
    public static getInstance(plugin: Plugin): DatabaseService {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService(plugin);
        }
        return DatabaseService.instance;
    }
}