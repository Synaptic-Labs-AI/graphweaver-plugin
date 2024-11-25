// src/services/file/FileScannerService.ts

import { Vault, TFile } from 'obsidian';
import { CoreService } from '../core/CoreService';
import { ServiceError } from '../core/ServiceError';
import { IConfigurableService } from '../core/IService';
import { EventEmitter } from 'events';
import { LifecycleState } from '@type/base.types';

/**
 * Configuration interface for scanner
 */
export interface FileScannerConfig {
    batchSize?: number;
    progressInterval?: number;
    scanTimeoutMs?: number;
    debug?: boolean;
}

/**
 * Scan progress event data
 */
export interface ScanProgress {
    scannedFiles: number;
    totalFiles: number;
    currentFile?: string;
    missingFrontMatter: number;
    elapsedTime: number;
}

/**
 * Scan result interface
 */
export interface ScanResult {
    filesMissingFrontMatter: TFile[];
    totalScanned: number;
    scanDuration: number;
    errors: Array<{
        path: string;
        error: string;
    }>;
}

/**
 * Events emitted by scanner
 */
export interface ScannerEvents {
    'scanStart': (totalFiles: number) => void;
    'scanProgress': (progress: ScanProgress) => void;
    'scanComplete': (result: ScanResult) => void;
    'scanError': (error: Error) => void;
}

/**
 * Enhanced FileScannerService that extends CoreService
 * Provides vault scanning capabilities with progress tracking and error handling
 */
export class FileScannerService extends CoreService implements IConfigurableService<FileScannerConfig> {
    private readonly eventEmitter: EventEmitter;
    private config: Required<FileScannerConfig>;
    private scanTimeout: NodeJS.Timeout | null = null;
    private lastProgressUpdate: number = 0;
    private scanErrors: Array<{ path: string; error: string }> = [];

    constructor(
        private readonly vault: Vault,
        config: Partial<FileScannerConfig> = {}
    ) {
        super('file-scanner', 'File Scanner Service');
        this.state = LifecycleState.Uninitialized;
        
        // Initialize configuration
        this.config = {
            batchSize: 100,
            progressInterval: 1000,  // 1 second
            scanTimeoutMs: 30000,    // 30 seconds
            debug: false,
            ...config
        };

        this.eventEmitter = new EventEmitter();
    }

    /**
     * Initialize scanner service
     */
    protected async initializeInternal(): Promise<void> {
        try {
            console.log('🦇 FileScannerService: Starting initialization...');
            this.state = LifecycleState.Initializing;

            // Basic validation of vault
            if (!this.vault) {
                throw new Error('Vault is required but not provided');
            }

            // Test vault access
            await this.testVaultAccess();

            console.log('🦇 FileScannerService: Initialization complete');
            this.state = LifecycleState.Ready;
        } catch (error) {
            this.state = LifecycleState.Error;
            console.error('🦇 FileScannerService initialization failed:', error);
            throw new ServiceError(
                this.serviceName,
                'Failed to initialize file scanner',
                error instanceof Error ? error : undefined
            );
        }
    }

    private async testVaultAccess(): Promise<void> {
        try {
            await this.vault.getMarkdownFiles();
        } catch (error) {
            throw new Error('Failed to access vault');
        }
    }

    /**
     * Clean up resources
     */
    protected async destroyInternal(): Promise<void> {
        this.eventEmitter.removeAllListeners();
        if (this.scanTimeout) {
            clearTimeout(this.scanTimeout);
            this.scanTimeout = null;
        }
    }

    /**
     * Configure scanner options
     */
    public async configure(config: Partial<FileScannerConfig>): Promise<void> {
        this.config = {
            ...this.config,
            ...config
        };
    }

    /**
     * Get all files missing front matter with progress tracking
     */
    public async getFilesMissingFrontMatter(): Promise<ScanResult> {
        try {
            const startTime = Date.now();
            const files = this.vault.getMarkdownFiles();
            const filesMissingFM: TFile[] = [];
            this.scanErrors = [];

            // Emit scan start
            this.emit('scanStart', files.length);

            // Process files in batches
            for (let i = 0; i < files.length; i += this.config.batchSize) {
                const batch = files.slice(i, i + this.config.batchSize);
                await this.processBatch(batch, filesMissingFM, startTime, i, files.length);
            }

            const result: ScanResult = {
                filesMissingFrontMatter: filesMissingFM,
                totalScanned: files.length,
                scanDuration: Date.now() - startTime,
                errors: this.scanErrors
            };

            // Emit completion
            this.emit('scanComplete', result);
            return result;

        } catch (error) {
            const serviceError = new ServiceError(
                this.serviceName,
                'Failed to scan files',
                error instanceof Error ? error : undefined
            );
            
            this.emit('scanError', serviceError);
            throw serviceError;
        }
    }

    /**
     * Process a batch of files
     */
    private async processBatch(
        batch: TFile[],
        filesMissingFM: TFile[],
        startTime: number,
        processedCount: number,
        totalFiles: number
    ): Promise<void> {
        await Promise.all(
            batch.map(async (file) => {
                try {
                    if (!(await this.hasFrontMatter(file))) {
                        filesMissingFM.push(file);
                    }
                } catch (error) {
                    this.scanErrors.push({
                        path: file.path,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
            })
        );

        await this.emitProgress(
            processedCount + batch.length,
            totalFiles,
            batch[batch.length - 1].path,
            filesMissingFM.length,
            startTime
        );
    }

    /**
     * Check if file has front matter
     */
    public async hasFrontMatter(file: TFile): Promise<boolean> {
        try {
            const startTime = Date.now();
            const content = await this.vault.read(file);

            // Set up timeout for file read
            const timeoutPromise = new Promise<never>((_, reject) => {
                this.scanTimeout = setTimeout(() => {
                    reject(new Error(`Timeout reading file ${file.path}`));
                }, this.config.scanTimeoutMs);
            });

            // Race between file read and timeout
            const result = content.startsWith('---\n');

            // Clear timeout
            if (this.scanTimeout) {
                clearTimeout(this.scanTimeout);
                this.scanTimeout = null;
            }

            return result;

        } catch (error) {
            throw new ServiceError(
                this.serviceName,
                `Failed to check front matter for ${file.path}`,
                error instanceof Error ? error : undefined
            );
        }
    }

    /**
     * Emit progress update if interval elapsed
     */
    private async emitProgress(
        scannedFiles: number,
        totalFiles: number,
        currentFile: string,
        missingCount: number,
        startTime: number
    ): Promise<void> {
        const now = Date.now();
        if (now - this.lastProgressUpdate >= this.config.progressInterval) {
            this.lastProgressUpdate = now;
            
            const progress: ScanProgress = {
                scannedFiles,
                totalFiles,
                currentFile,
                missingFrontMatter: missingCount,
                elapsedTime: now - startTime
            };

            this.emit('scanProgress', progress);
        }
    }

    /**
     * Subscribe to scanner events
     */
    public on<K extends keyof ScannerEvents>(
        event: K,
        callback: ScannerEvents[K]
    ): void {
        this.eventEmitter.on(event, callback);
    }

    /**
     * Remove event subscription
     */
    public off<K extends keyof ScannerEvents>(
        event: K,
        callback: ScannerEvents[K]
    ): void {
        this.eventEmitter.off(event, callback);
    }

    /**
     * Emit scanner event
     */
    private emit<K extends keyof ScannerEvents>(
        event: K,
        ...args: Parameters<ScannerEvents[K]>
    ): void {
        this.eventEmitter.emit(event, ...args);
    }
}