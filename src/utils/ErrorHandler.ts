export class ErrorHandler {
    public static handleError(error: Error, context: string): never {
        console.error(`${context} error: ${error.message}`, error);
        // Optionally, integrate with a notification system
        // new Notice(`${context} failed: ${error.message}`);
        throw error;
    }
}