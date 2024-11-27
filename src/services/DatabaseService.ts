import { TFile } from 'obsidian';
import { 
    ProcessingStats,
    ProcessingError,
    FileProcessingResult,
    PersistentProcessingState
} from '../models/ProcessingTypes';
import { BaseService } from './BaseService';

/**
 * Interface for database records
 */
interface DatabaseRecord {
    processedFiles: ProcessedFile[];
    processingState: PersistentProcessingState;
    processingStats: TimestampedProcessingStats[];
    errors: ProcessingError[];
    lastUpdated: number;
}

/**
 * Interface for processed file records
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
 * Interface for timestamped processing stats
 */
interface TimestampedProcessingStats extends ProcessingStats {
    timestamp: number;
}

/**
 * Enhanced database service for managing processing state and history
 * Handles persistent storage of processing results and statistics
 */
export class DatabaseService extends BaseService {
    private data: DatabaseRecord;
    private readonly MAX_HISTORY_LENGTH = 100;
    private readonly PRUNE_THRESHOLD = 1000;
    private readonly MONTH_IN_MS = 30 * 24 * 60 * 60 * 1000;

    constructor(private saveCallback?: (data: any) => Promise<void>) {
        super();
        this.data = this.getDefaultData();
    }

    /**
     * Save data with callback and timestamp
     */
    private async save(): Promise<void> {
        this.data.lastUpdated = Date.now();
        await this.saveData(() => {
            if (this.saveCallback) {
                return this.saveCallback(this.data);
            }
            return Promise.resolve();
        });
    }

    /**
     * Load database from persistent storage
     */
    public async load(loadData: () => Promise<any>): Promise<void> {
        try {
            const savedData = await loadData();
            if (savedData) {
                this.data = this.migrateDataIfNeeded(savedData);
                await this.pruneOldRecordsIfNeeded();
            }
        } catch (error) {
            console.error('DatabaseService: Error loading data:', error);
            this.data = this.getDefaultData();
        }
    }

    /**
     * Get default database structure
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
     * Migrate data structure if needed
     */
    private migrateDataIfNeeded(savedData: any): DatabaseRecord {
        // First spread default data to ensure all base properties exist
        const migratedData = {
            ...this.getDefaultData(),
            ...savedData
        };
    
        // Ensure processingStats have timestamps
        migratedData.processingStats = (savedData.processingStats || []).map((stat: ProcessingStats) => ({
            ...stat,
            // Use endTime if available, otherwise fallback to startTime
            timestamp: stat.endTime || stat.startTime || Date.now()
        }));
    
        return migratedData;
    }

    /**
     * Mark file as processed with result
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

        await this.save();
    }

    /**
     * Check if file needs processing
     */
    public needsProcessing(file: TFile): boolean {
        const processedFile = this.data.processedFiles.find(f => f.path === file.path);
        if (!processedFile) return true;

        const needsUpdate = file.stat.mtime > processedFile.lastProcessed;
        const hasError = !!processedFile.error;

        return needsUpdate || hasError;
    }

    /**
     * Add processing statistics with validation
     */
    public async addProcessingStats(stats: ProcessingStats): Promise<void> {
        const timestamp = Date.now();
        const validatedStats: TimestampedProcessingStats = {
            totalFiles: stats.totalFiles || 0,
            processedFiles: stats.processedFiles || 0,
            errorFiles: stats.errorFiles || 0,
            skippedFiles: stats.skippedFiles || 0,
            startTime: stats.startTime || timestamp,
            endTime: stats.endTime || timestamp,
            averageProcessingTime: stats.averageProcessingTime || 0,
            timestamp: timestamp
        };

        this.data.processingStats.unshift(validatedStats);
        if (this.data.processingStats.length > this.MAX_HISTORY_LENGTH) {
            this.data.processingStats = this.data.processingStats.slice(0, this.MAX_HISTORY_LENGTH);
        }

        await this.save();
    }

    /**
     * Get processing statistics with fallback
     */
    public getProcessingStats(days?: number): ProcessingStats[] {
        const stats = this.data.processingStats || [];
        
        if (days) {
            const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
            return stats.filter(stat => (stat.timestamp || stat.startTime) > cutoff);
        }
        
        return stats;
    }

    /**
     * Get summary of processing statistics
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
        const lastProcessed = stats[0].timestamp;

        return {
            totalProcessed,
            totalErrors,
            averageTime,
            successRate,
            lastProcessed
        };
    }

    /**
     * Get recent errors
     */
    public getRecentErrors(limit: number = 10): ProcessingError[] {
        return this.data.errors.slice(0, limit);
    }

    /**
     * Add processing error
     */
    public async addError(error: ProcessingError): Promise<void> {
        this.data.errors.unshift(error);
        await this.save();
    }

    /**
     * Get persistent processing state
     */
    public async loadProcessingState(): Promise<PersistentProcessingState> {
        return this.data.processingState;
    }

    /**
     * Save persistent processing state
     */
    public async saveProcessingState(state: PersistentProcessingState): Promise<void> {
        this.data.processingState = state;
        await this.save();
    }

    /**
     * Reset processing state to default
     */
    public async resetProcessingState(): Promise<void> {
        this.data.processingState = this.getDefaultData().processingState;
        await this.save();
    }

    /**
     * Prune old records if threshold exceeded
     */
    private async pruneOldRecordsIfNeeded(): Promise<void> {
        if (this.data.processedFiles.length <= this.PRUNE_THRESHOLD) {
            return;
        }

        const cutoff = Date.now() - this.MONTH_IN_MS;
        
        this.data.processedFiles = this.data.processedFiles.filter(file => 
            file.lastProcessed > cutoff || file.error
        );
        
        this.data.errors = this.data.errors.filter(error => 
            error.timestamp > cutoff
        );

        await this.save();
    }

    /**
     * Get stats for specific file
     */
    public getFileStats(filePath: string): ProcessedFile | undefined {
        return this.data.processedFiles.find(f => f.path === filePath);
    }

    /**
     * Get summary of file processing history
     */
    public getFileProcessingSummary(): {
        totalFiles: number;
        processedToday: number;
        errorCount: number;
        averageProcessingTime: number;
    } {
        const today = new Date().setHours(0, 0, 0, 0);
        const files = this.data.processedFiles;
        
        return {
            totalFiles: files.length,
            processedToday: files.filter(f => f.lastProcessed > today).length,
            errorCount: files.filter(f => f.error).length,
            averageProcessingTime: this.calculateAverageProcessingTime()
        };
    }

    /**
     * Calculate average processing time
     */
    private calculateAverageProcessingTime(): number {
        const recentFiles = this.data.processedFiles
            .filter(f => !f.error)
            .slice(0, 100);

        if (recentFiles.length === 0) return 0;

        const totalTime = recentFiles.reduce((sum, file) => sum + file.processingTime, 0);
        return totalTime / recentFiles.length;
    }
}