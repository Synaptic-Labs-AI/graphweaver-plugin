
export interface IProcessingStatusBar {
    updateFromState(state: {
        currentFile: string | null;
        progress: number;
        status: ProcessingStatus;
    }): void;
}

/**
 * Processing state enumeration
 */
export enum ProcessingStateEnum {
    IDLE = 'idle',
    RUNNING = 'running',
    PAUSED = 'paused',
    ERROR = 'error'
}

/**
 * Core processing state interface
 */
export interface ProcessingState {
    isProcessing: boolean;
    currentFile: string | null;
    queue: string[];
    progress: number;
    state: ProcessingStateEnum;
    filesQueued: number;
    filesProcessed: number;
    filesRemaining: number;
    errors: ProcessingError[];
    error: string | null;
    startTime: number | null;
    estimatedTimeRemaining: number | null;
}

/**
 * File processing status interface
 */
export interface ProcessingStatus {
    state: ProcessingState;
    filesQueued: number;
    filesProcessed: number;
    filesRemaining: number;
    currentFile?: string;
    startTime?: number;
    estimatedTimeRemaining?: number;
    errors: ProcessingError[];
}

/**
 * Processing configuration options
 */
export interface ProcessingOptions {
    chunkSize: number;
    delayBetweenChunks: number;
    maxRetries: number;
    generateFrontMatter: boolean;
    generateWikilinks: boolean;
    maxConcurrentProcessing: number;
}

/**
 * Error details for processing failures
 */
export interface ProcessingError {
    filePath: string;
    error: string;
    timestamp: number;
    retryCount: number;
}

/**
 * Processing statistics
 */
export interface ProcessingStats {
    totalFiles: number;
    processedFiles: number;
    skippedFiles: number;
    errorFiles: number;
    startTime: number;
    endTime?: number;
    averageProcessingTime: number;
    timestamp?: number;
}

/**
 * Batch processing chunk
 */
export interface FileChunk {
    files: string[];
    index: number;
    size: number;
    startTime?: number;
    endTime?: number;
}

/**
 * Status bar configuration
 */
export interface StatusBarOptions {
    showProgress: boolean;
    showETA: boolean;
    showCurrentFile: boolean;
    showErrors: boolean;
    notificationThrottle?: number;
    progressBarColors?: {
        default: string;
        error: string;
        success: string;
        paused: string;
    };
}

/**
 * Individual file processing result
 */
export interface FileProcessingResult {
    success: boolean;
    path: string;
    frontMatterGenerated: boolean;
    wikilinksGenerated: boolean;
    processingTime: number;
    error?: string;
}

/**
 * Processing manager configuration
 */
export interface ProcessingManagerConfig {
    options: ProcessingOptions;
    statusBarOptions: StatusBarOptions;
    allowPause: boolean;
    allowCancel: boolean;
    showNotifications: boolean;
    saveStateOnPause: boolean;
    debugMode: boolean;
}