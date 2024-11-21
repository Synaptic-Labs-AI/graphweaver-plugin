/**
 * Error registration information
 */
export interface RegistrationError {
    id: string;
    error: ServiceError;
}

/**
 * Service initialization status
 */
export interface InitializationStatus {
    totalServices: number;
    initializedServices: number;
    pendingServices: string[];
    failedServices: RegistrationError[];
    timestamp: number;
}

/**
 * Error details interface
 */
export interface ServiceErrorDetails {
    message: string;
    serviceId: string;
    details?: any;
    stack?: string;
    cause?: Error;
}

/**
 * Enhanced error class for service-related errors
 */
export class ServiceError extends Error {
    public readonly serviceId: string;
    public readonly details?: any;
    public readonly cause?: Error;

    constructor(
        serviceId: string,
        message: string,
        details?: any
    ) {
        super(message);
        this.name = "ServiceError";
        this.serviceId = serviceId;
        this.details = details;

        // Ensure proper prototype chain
        Object.setPrototypeOf(this, ServiceError.prototype);

        // Capture original error
        if (details?.cause instanceof Error) {
            this.cause = details.cause;
        }
    }

    /**
     * Create ServiceError from unknown error
     * @param serviceId Service identifier
     * @param error Original error
     * @param additionalDetails Additional error details
     */
    public static from(
        serviceId: string,
        error: unknown,
        additionalDetails?: any
    ): ServiceError {
        if (error instanceof ServiceError) {
            return error;
        }

        const details = {
            ...additionalDetails,
            cause: error instanceof Error ? error : undefined
        };

        const message = error instanceof Error ? error.message : String(error);
        return new ServiceError(serviceId, message, details);
    }

    /**
     * Get error details
     * @returns Structured error details
     */
    public getDetails(): ServiceErrorDetails {
        return {
            message: this.message,
            serviceId: this.serviceId,
            details: this.details,
            stack: this.stack,
            cause: this.cause
        };
    }
}