/**
 * Common base interfaces and types
 */

// Common error interface
export interface BaseError {
    message: string;
    timestamp: number;
    source?: string;
    metadata?: Record<string, unknown>;
}

// Common status interface
export interface BaseStatus {
    success: boolean;
    error?: string;
    duration?: number;
    metadata?: Record<string, unknown>;
}

// Common validation result

export interface ValidationResult<T = any> {
    valid: boolean;
    value?: T;
    error?: string;
    fixes?: string[];
}


// Common lifecycle state enum
export enum LifecycleState {
    Uninitialized = 'uninitialized',
    Initializing = 'initializing',
    Ready = 'ready',
    Error = 'error',
    Destroying = 'destroying',
    Destroyed = 'destroyed'
}

/**
 * Common event handler type
 * @description Base event handler type used across the application
 */
export type EventHandler<T = any> = (event: T) => void | Promise<void>;