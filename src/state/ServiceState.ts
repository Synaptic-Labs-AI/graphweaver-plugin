/**
 * Enum representing all possible states of a service lifecycle.
 * Used to track and manage service state transitions.
 * 
 * States:
 * - Uninitialized: Initial state, service instance created but not set up
 * - Initializing: Service is in the process of setting up (async operations)
 * - Ready: Service is fully initialized and ready for use
 * - Error: Service encountered an error during operation
 * - Destroying: Service is in the process of cleaning up resources
 * - Destroyed: Service has been cleaned up and is no longer usable
 */
export enum ServiceState {
    Uninitialized = 'uninitialized',
    Initializing = 'initializing',
    Ready = 'ready',
    Error = 'error',
    Destroying = 'destroying',
    Destroyed = 'destroyed'
}

/**
 * Type guard to check if a value is a valid ServiceState
 * @param value - The value to check
 * @returns boolean indicating if value is a valid ServiceState
 */
export function isServiceState(value: any): value is ServiceState {
    return Object.values(ServiceState).includes(value);
}