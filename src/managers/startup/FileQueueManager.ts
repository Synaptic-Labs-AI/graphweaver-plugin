import { TFile } from 'obsidian';

/**
 * Interface for file processing status
 */
export interface FileProcessingStatus {
    path: string;
    lastProcessed: number;
    lastModified: number;
    needsProcessing: boolean;
    hasFrontMatter: boolean;
    retryCount: number;
}

/**
 * Manages file processing queue during startup
 */
export class FileQueueManager {
    private processingQueue: Map<string, FileProcessingStatus>;
    private isUnloading: boolean = false;

    constructor() {
        this.processingQueue = new Map();
    }

    /**
     * Update file processing status
     */
    public updateStatus(path: string, hasFrontMatter: boolean): void {
        if (this.isUnloading) return;

        const currentStatus = this.processingQueue.get(path) || {
            path,
            lastProcessed: Date.now(),
            lastModified: 0,
            needsProcessing: !hasFrontMatter,
            hasFrontMatter,
            retryCount: 0
        };

        this.processingQueue.set(path, {
            ...currentStatus,
            hasFrontMatter,
            lastProcessed: Date.now(),
            needsProcessing: !hasFrontMatter
        });
    }

    /**
     * Check if file needs processing
     */
    public needsProcessing(file: TFile): boolean {
        const status = this.processingQueue.get(file.path);
        return !status || status.needsProcessing;
    }

    /**
     * Get status for file
     */
    public getStatus(path: string): FileProcessingStatus | undefined {
        return this.processingQueue.get(path);
    }

    /**
     * Get all files that need processing
     */
    public getFilesNeedingProcessing(): string[] {
        return Array.from(this.processingQueue.entries())
            .filter(([_, status]) => status.needsProcessing)
            .map(([path]) => path);
    }

    /**
     * Clear queue
     */
    public clear(): void {
        this.processingQueue.clear();
    }

    /**
     * Clean up resources
     */
    public destroy(): void {
        this.isUnloading = true;
        this.clear();
    }
}