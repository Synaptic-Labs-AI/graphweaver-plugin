// src/services/DatabaseService.ts

import { CoreService } from './core/CoreService';
import { ServiceError } from './core/ServiceError';
import { IConfigurableService } from './core/IService';
import {
    ProcessingStats,
    ProcessingError,
    FileProcessingResult,
    PersistentProcessingState
} from '../types/ProcessingTypes';
import { TFile } from 'obsidian';

/**
 * Configuration options for DatabaseService
 */
export interface DatabaseConfig {
    maxHistoryLength?: number;
    pruneThreshold?: number;
    processingCooldown?: number;
    saveDebounce?: number;
}

/**
 * Database record structure
 */
interface DatabaseRecord {
    processedFiles: ProcessedFile[];
    processingState: PersistentProcessingState;
    processingStats: TimestampedProcessingStats[];
    errors: ProcessingError[];
    lastUpdated: number;
}

/**
 * Processed file record
 */
interface ProcessedFile {
    path: string;
    lastProcessed: number;
    lastModified: number;
    frontMatterGenerated: boolean;
    wikilinksGenerated: boolean;
    processingTime: number;
    retryCount: number;
    error?: string;
}

/**
 * Timestamped processing stats
 */
interface TimestampedProcessingStats extends ProcessingStats {
    timestamp: number;
}

/**
 * Enhanced DatabaseService that extends CoreService
 * Manages processing state and history with improved error handling
 */
export class DatabaseService extends CoreService implements IConfigurableService<DatabaseConfig> {
    private readonly MONTH_IN_MS = 30 * 24 * 60 * 60 * 1000;
    private config: Required<DatabaseConfig>;
    private data: DatabaseRecord;
    private processedFiles: Set<string>;
    private recentlyProcessed: Map<string, number>;
    private processingQueue: Set<string>;
    private saveTimeout: NodeJS.Timeout | null = null;

    /**
     * Constructor now accepts both loadCallback and saveCallback
     * @param loadCallback Function to load data
     * @param saveCallback Function to save data
     * @param config Configuration options
     */
    constructor(
        private loadCallback?: () => Promise<any>,
        private saveCallback?: (data: any) => Promise<void>,
        config: Partial<DatabaseConfig> = {}
    ) {
        super('database-service', 'Database Service');
        
        // Initialize configuration
        this.config = {
            maxHistoryLength: 100,
            pruneThreshold: 1000,
            processingCooldown: 5000,
            saveDebounce: 1000,
            ...config
        };

        // Initialize data structures
        this.processedFiles = new Set<string>();
        this.recentlyProcessed = new Map();
        this.processingQueue = new Set();
    }

    /**
     * Initialize database service by loading data
     */
    public async initializeInternal(): Promise<void> {
        await this.load();
    }

    /**
     * Load data using the provided loadCallback
     */
    public async load(callback?: () => Promise<any>): Promise<void> {
        try {
            const loadFn = callback || this.loadCallback;
            if (!loadFn) {
                throw new ServiceError(
                    this.serviceName,
                    'No load callback provided',
                    undefined
                );
            }

            const savedData = await loadFn();
            if (savedData) {
                this.data = this.migrateDataIfNeeded(savedData);
                await this.pruneOldRecordsIfNeeded();
            } else {
                this.data = this.getDefaultData();
            }

        } catch (error) {
            throw new ServiceError(
                this.serviceName,
                'Failed to load data',
                error instanceof Error ? error : undefined
            );
        }
    }

    /**
     * Save data using the provided saveCallback with debounce
     */
    public async save(): Promise<void> {
        try {
            if (this.saveTimeout) {
                clearTimeout(this.saveTimeout);
            }

            this.saveTimeout = setTimeout(async () => {
                this.data.lastUpdated = Date.now();
                if (this.saveCallback) {
                    await this.saveCallback(this.data);
                } else {
                    console.warn('DatabaseService: No save callback provided');
                }
            }, this.config.saveDebounce);
        } catch (error) {
            throw new ServiceError(
                this.serviceName,
                'Failed to save data',
                error instanceof Error ? error : undefined
            );
        }
    }

    /**
     * Clean up database resources
     */
    protected async destroyInternal(): Promise<void> {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        this.recentlyProcessed.clear();
        this.processingQueue.clear();
    }

    /**
     * Configure the service
     */
    public async configure(config: Partial<DatabaseConfig>): Promise<void> {
        this.config = {
            ...this.config,
            ...config
        };
    }

    /**
     * Track file as being processed
     */
    public trackFileProcessing(filePath: string): void {
        this.recentlyProcessed.set(filePath, Date.now());
        this.processingQueue.add(filePath);

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

        const processedRecord = this.data.processedFiles.find(f => f.path === file.path);
        if (!processedRecord) {
            return true;
        }

        return file.stat.mtime > processedRecord.lastProcessed || !!processedRecord.error;
    }

    /**
     * Mark file as processed
     */
    public async markFileAsProcessed(file: TFile, result: FileProcessingResult): Promise<void> {
        const existingIndex = this.data.processedFiles.findIndex(f => f.path === file.path);
        const processedFile: ProcessedFile = {
            path: file.path,
            lastProcessed: Date.now(),
            lastModified: file.stat.mtime,
            frontMatterGenerated: result.frontMatterGenerated,
            wikilinksGenerated: result.wikilinksGenerated,
            processingTime: result.processingTime,
            retryCount: existingIndex !== -1 ? this.data.processedFiles[existingIndex].retryCount + 1 : 0,
            error: result.error
        };

        if (existingIndex !== -1) {
            this.data.processedFiles[existingIndex] = processedFile;
        } else {
            this.data.processedFiles.push(processedFile);
        }

        this.trackFileProcessing(file.path);
        await this.save();
    }

    /**
     * Add processing stats
     */
    public async addProcessingStats(stats: ProcessingStats): Promise<void> {
        const validatedStats: TimestampedProcessingStats = {
            totalFiles: stats.totalFiles || 0,
            processedFiles: stats.processedFiles || 0,
            errorFiles: stats.errorFiles || 0,
            skippedFiles: stats.skippedFiles || 0,
            startTime: stats.startTime || Date.now(),
            endTime: stats.endTime || Date.now(),
            averageProcessingTime: stats.averageProcessingTime || 0,
            timestamp: Date.now()
        };

        this.data.processingStats.unshift(validatedStats);
        
        if (this.data.processingStats.length > this.config.maxHistoryLength) {
            this.data.processingStats = this.data.processingStats.slice(0, this.config.maxHistoryLength);
        }

        await this.save();
    }

    /**
     * Get processing stats with optional time filter
     */
    public getProcessingStats(days?: number): ProcessingStats[] {
        if (!days) {
            return this.data.processingStats;
        }

        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        return this.data.processingStats.filter(
            stat => (stat.timestamp || stat.startTime) > cutoff
        );
    }

    /**
     * Get processing stats summary
     */
    public getProcessingStatsSummary(): {
        totalProcessed: number;
        totalErrors: number;
        averageTime: number;
        successRate: number;
        lastProcessed: number;
    } {
        if (this.data.processingStats.length === 0) {
            return {
                totalProcessed: 0,
                totalErrors: 0,
                averageTime: 0,
                successRate: 100,
                lastProcessed: 0
            };
        }

        const stats = this.data.processingStats;
        const totalProcessed = stats.reduce((sum, stat) => sum + stat.processedFiles, 0);
        const totalErrors = stats.reduce((sum, stat) => sum + stat.errorFiles, 0);
        const averageTime = stats.reduce((sum, stat) => sum + stat.averageProcessingTime, 0) / stats.length;
        const successRate = totalProcessed > 0 ? ((totalProcessed - totalErrors) / totalProcessed) * 100 : 100;

        return {
            totalProcessed,
            totalErrors,
            averageTime,
            successRate,
            lastProcessed: stats[0].timestamp
        };
    }

    /**
     * Prune old records if needed
     */
    private async pruneOldRecordsIfNeeded(): Promise<void> {
        if (this.data.processedFiles.length <= this.config.pruneThreshold) {
            return;
        }

        const cutoff = Date.now() - this.MONTH_IN_MS;
        
        this.data.processedFiles = this.data.processedFiles.filter(
            file => file.lastProcessed > cutoff || file.error
        );
        
        this.data.errors = this.data.errors.filter(
            error => error.timestamp > cutoff
        );

        await this.save();
    }

    /**
     * Get default data structure
     */
    private getDefaultData(): DatabaseRecord {
        return {
            processedFiles: [],
            processingState: {
                lastProcessedFiles: [],
                queuedFiles: [],
                errors: [],
                isPaused: false,
                currentChunkIndex: 0
            },
            processingStats: [],
            errors: [],
            lastUpdated: Date.now()
        };
    }

    /**
     * Migrate data if needed
     */
    private migrateDataIfNeeded(savedData: any): DatabaseRecord {
        const migratedData: DatabaseRecord = {
            ...this.getDefaultData(),
            ...savedData
        };
    
        migratedData.processingStats = (savedData.processingStats || []).map(
            (stat: ProcessingStats) => ({
                ...stat,
                timestamp: stat.endTime || stat.startTime || Date.now()
            })
        );
    
        return migratedData;
    }

    /**
     * Optional: Getter for the entire config if needed elsewhere
     */
    public getConfig(): Readonly<Required<DatabaseConfig>> {
        return this.config;
    }
}
