/**
 * Custom error class for AI service related errors
 * Provides better error context and handling
 */
export class AIServiceError extends Error {
    public readonly originalError?: Error;
    public readonly context?: Record<string, unknown>;

    constructor(
        message: string,
        originalError?: unknown,
        context?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'AIServiceError';
        
        // Capture original error if provided
        if (originalError instanceof Error) {
            this.originalError = originalError;
            this.stack = `${this.stack}\nCaused by: ${originalError.stack}`;
        }

        // Store additional context
        if (context) {
            this.context = context;
        }

        // Ensure proper prototype chain
        Object.setPrototypeOf(this, AIServiceError.prototype);
    }

    /**
     * Get full error details including context
     */
    public getDetails(): Record<string, unknown> {
        return {
            message: this.message,
            originalError: this.originalError?.message,
            context: this.context,
            stack: this.stack
        };
    }

    /**
     * Create error from unknown error
     */
    public static from(error: unknown, context?: Record<string, unknown>): AIServiceError {
        if (error instanceof AIServiceError) {
            return error;
        }

        const message = error instanceof Error ? error.message : 'Unknown error occurred';
        return new AIServiceError(message, error, context);
    }
}