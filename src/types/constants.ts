/**
 * Constants Module
 * @module types/constants
 * @description Centralized constants for the application
 */

import type {
    ProcessingOptions,
    StatusBarOptions,
    ProcessingManagerConfig
} from './processing.types';

import type { AIModelConfig } from './ai.types';

/**
 * Central location for constants
 */

// Move all enums here
export { AIProvider } from './ai.types';
export { OperationType, OperationState } from './operations.types';
export { ProcessingStateEnum } from './processing.types';
export { LifecycleState } from './base.types';

// Default values
export const DEFAULT_BATCH_SIZE = 10;
export const DEFAULT_MAX_RETRIES = 3;
export const DEFAULT_DELAY = 1000;

// ============================================================================
// Processing Constants
// ============================================================================

// In constants.ts, add these processing-related constants

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

// ============================================================================
// AI Constants
// ============================================================================

/**
 * Default AI model configuration
 */
export const DEFAULT_AI_CONFIG: AIModelConfig = {
    maxTokens: 2000,
    temperature: 0.7
};

/**
 * Retry configuration for AI operations
 */
export const AI_RETRY_CONFIG = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2
};

/**
 * Timeout configurations (in milliseconds)
 */
export const TIMEOUTS = {
    AI_REQUEST: 30000,
    FILE_PROCESSING: 60000,
    CONNECTION_TEST: 5000
};

// ============================================================================
// UI Constants
// ============================================================================

/**
 * Status bar update intervals (in milliseconds)
 */
export const UI_UPDATE_INTERVALS = {
    STATUS_BAR: 1000,
    PROGRESS: 500,
    ETA: 2000
};

/**
 * UI element sizes
 */
export const UI_SIZES = {
    MODAL_WIDTH: 500,
    MODAL_HEIGHT: 600,
    SIDEBAR_WIDTH: 300,
    STATUS_BAR_HEIGHT: 22
};

// ============================================================================
// File Processing Constants
// ============================================================================

/**
 * File processing batch sizes
 */
export const BATCH_SIZES = {
    SMALL: 5,
    MEDIUM: 10,
    LARGE: 25,
    MAX: 50
};

/**
 * File extensions and patterns
 */
export const FILE_PATTERNS = {
    MARKDOWN: ['.md', '.markdown'],
    WIKILINK: /\[\[([^\[\]]+)\]\]/g,
    FRONTMATTER: /^---\n([\s\S]*?)\n---/
};

// ============================================================================
// Event Constants
// ============================================================================

/**
 * Event throttle/debounce delays (in milliseconds)
 */
export const EVENT_DELAYS = {
    SAVE: 1000,
    PROCESS: 500,
    NOTIFY: 2000
};

/**
 * Maximum event queue sizes
 */
export const MAX_QUEUE_SIZES = {
    PROCESSING: 100,
    NOTIFICATIONS: 50,
    AI_REQUESTS: 25
};

// ============================================================================
// Storage Constants
// ============================================================================

/**
 * Storage keys
 */
export const STORAGE_KEYS = {
    SETTINGS: 'graphweaver-settings',
    PROCESSING_STATE: 'graphweaver-processing-state',
    UI_STATE: 'graphweaver-ui-state'
};

/**
 * Cache durations (in milliseconds)
 */
export const CACHE_DURATIONS = {
    MODEL_LIST: 24 * 60 * 60 * 1000, // 24 hours
    FILE_SCAN: 5 * 60 * 1000,        // 5 minutes
    API_KEY: 12 * 60 * 60 * 1000     // 12 hours
};

// ============================================================================
// Error Messages
// ============================================================================

/**
 * Common error messages
 */
export const ERROR_MESSAGES = {
    API_KEY_MISSING: 'API key is required but not provided',
    INVALID_MODEL: 'Invalid or unsupported model specified',
    PROCESSING_FAILED: 'File processing failed',
    CONNECTION_FAILED: 'Failed to establish connection',
    INVALID_CONFIG: 'Invalid configuration provided'
};

// ============================================================================
// Validation Constants
// ============================================================================

/**
 * Validation limits
 */
export const VALIDATION_LIMITS = {
    MAX_FILE_SIZE: 1024 * 1024 * 10, // 10MB
    MAX_BATCH_SIZE: 50,
    MAX_CONCURRENT_REQUESTS: 5,
    MIN_CHUNK_SIZE: 1,
    MAX_CHUNK_SIZE: 100
};

