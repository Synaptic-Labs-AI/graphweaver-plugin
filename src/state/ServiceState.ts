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