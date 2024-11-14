// src/managers/ErrorManager.ts

import { Notice } from 'obsidian';

export class ErrorManager {
    /**
     * Handle errors consistently across the plugin
     */
    public handleError(context: string, error: unknown): void {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(context, error);
        new Notice(`${context} ${errorMessage}`);
    }

    /**
     * Wrap async operations with consistent error handling
     */
    public async wrapAsync<T>(
        operation: () => Promise<T>,
        errorContext: string
    ): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            this.handleError(errorContext, error);
            throw error;
        }
    }
}