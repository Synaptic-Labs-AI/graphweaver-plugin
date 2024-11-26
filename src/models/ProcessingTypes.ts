/**
 * Represents the current state of file processing
 */
export type ProcessingState = 'idle' | 'running' | 'paused' | 'error';

/**
 * Represents a file's processing status
 */
export interface FileProcessingStatus {
    path: string;
    state: ProcessingState;
    lastAttempted?: number;
    lastProcessed?: number;
    error?: string;
    retryCount: number;
}

/**
 * Options for file processing
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
 * Overall processing queue status
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
 * Processing error details
 */
export interface ProcessingError {
    filePath: string;
    error: string;
    timestamp: number;
    retryCount: number;
}

/**
 * Statistics for processing results
 */
export interface ProcessingStats {
    totalFiles: number;
    processedFiles: number;
    skippedFiles: number;
    errorFiles: number;
    startTime: number;
    endTime?: number;
    averageProcessingTime: number;
}

/**
 * File chunk for batch processing
 */
export interface FileChunk {
    files: string[];
    index: number;
    size: number;
    startTime?: number;
    endTime?: number;
}

/**
 * Processing queue state
 */
export interface ProcessingQueue {
    chunks: FileChunk[];
    currentChunkIndex: number;
    isProcessing: boolean;
    isPaused: boolean;
    stats: ProcessingStats;
}

export interface ProcessingEvent {
    start: { status: ProcessingStatus };
    pause: null;
    resume: null;
    complete: ProcessingStats;
    error: ProcessingError;
    progress: ProcessingStatus;
    fileStart: { file: string };
    fileComplete: { file: string; result: FileProcessingResult };
    chunkStart: { chunk: FileChunk };
    chunkComplete: { chunk: FileChunk };
}

/**
 * Events emitted by the processing manager
 */
export type ProcessingEventType = 
    'start' | 'pause' | 'resume' | 'complete' | 
    'error' | 'progress' | 'fileStart' | 'fileComplete' |
    'chunkStart' | 'chunkComplete';

/**
 * Status bar display options
 */
export interface StatusBarOptions {
    showProgress: boolean;
    showETA: boolean;
    showCurrentFile: boolean;
    showErrors: boolean;
    notificationThrottle?: number;  // Add this
    progressBarColors?: {  // Add this
        default: string;
        error: string;
        success: string;
        paused: string;
    };
}

/**
 * Persistent state interface
 */
export interface PersistentProcessingState {
    lastProcessedFiles: string[];
    lastProcessingStats?: ProcessingStats;
    queuedFiles: string[];
    errors: ProcessingError[];
    isPaused: boolean;
    currentChunkIndex: number;
}

// Add timestamp to ProcessingStats
export interface ProcessingStats {
    totalFiles: number;
    processedFiles: number;
    errorFiles: number;
    skippedFiles: number;
    startTime: number;
    endTime?: number;
    averageProcessingTime: number;
    timestamp?: number;  // Add optional timestamp
}

/**
 * Processing result for a single file
 */
export interface FileProcessingResult {
    path: string;
    success: boolean;
    error?: string;
    processingTime: number;
    frontMatterGenerated: boolean;
    wikilinksGenerated: boolean;
}

/**
 * Configuration for the processing manager
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

/**
 * Default processing options
 */
export const DEFAULT_PROCESSING_OPTIONS: ProcessingOptions = {
    chunkSize: 10,
    delayBetweenChunks: 1000,
    maxRetries: 3,
    generateFrontMatter: true,
    generateWikilinks: false,
    maxConcurrentProcessing: 3
};

/**
 * Default status bar options
 */
export const DEFAULT_STATUS_BAR_OPTIONS: StatusBarOptions = {
    showProgress: true,
    showETA: true,
    showCurrentFile: true,
    showErrors: true
};

/**
 * Default processing manager configuration
 */
export const DEFAULT_PROCESSING_MANAGER_CONFIG: ProcessingManagerConfig = {
    options: DEFAULT_PROCESSING_OPTIONS,
    statusBarOptions: DEFAULT_STATUS_BAR_OPTIONS,
    allowPause: true,
    allowCancel: true,
    showNotifications: true,
    saveStateOnPause: true,
    debugMode: false
};