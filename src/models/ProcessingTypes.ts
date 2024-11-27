/**
 * Represents the current state of file processing
 */
export type ProcessingState = 'idle' | 'running' | 'paused' | 'error';

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