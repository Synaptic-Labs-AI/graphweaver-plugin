// src/state/utils/StateUpdater.ts

import { PluginState } from '../PluginState';

/**
 * Type for update handlers
 */
type UpdateHandler<K extends keyof PluginState> = (
    currentValue: PluginState[K],
    update: Partial<PluginState[K]>
) => PluginState[K];

/**
 * Utility class for handling state updates
 */
export class StateUpdater {
    public static handlers: Map<keyof PluginState, UpdateHandler<any>> = new Map();

    /**
     * Initialize update handlers
     */
    public static initializeHandlers() {
        if (this.handlers.size > 0) return;

        this.handlers.set('settings', this.handleSettingsUpdate.bind(this));
        this.handlers.set('processing', this.handleProcessingUpdate.bind(this));
        this.handlers.set('ai', this.handleAIUpdate.bind(this));
        this.handlers.set('ui', this.handleUIUpdate.bind(this));
        this.handlers.set('files', this.handleFilesUpdate.bind(this));
    }

    /**
     * Update state slice while maintaining type safety
     */
    public static updateSlice<K extends keyof PluginState>(
        key: K,
        currentValue: PluginState[K],
        update: Partial<PluginState[K]>
    ): PluginState[K] {
        this.initializeHandlers();
        const handler = this.handlers.get(key);
        
        if (!handler) {
            throw new Error(`No handler found for state slice: ${String(key)}`);
        }

        return handler(currentValue, update);
    }

    /**
     * Handle settings state updates
     */
    public static handleSettingsUpdate(
        current: PluginState['settings'],
        update: Partial<PluginState['settings']>
    ): PluginState['settings'] {
        return {
            aiProvider: update.aiProvider ?? current.aiProvider,
            customProperties: update.customProperties ?? current.customProperties,
            customTags: update.customTags ?? current.customTags
        };
    }

    /**
     * Handle processing state updates
     */
    public static handleProcessingUpdate(
        current: PluginState['processing'],
        update: Partial<PluginState['processing']>
    ): PluginState['processing'] {
        return {
            isProcessing: update.isProcessing ?? current.isProcessing,
            currentFile: update.currentFile ?? current.currentFile,
            queue: update.queue ?? current.queue,
            progress: update.progress ?? current.progress,
            currentOperation: update.currentOperation,
            error: update.error
        };
    }

    /**
     * Handle AI state updates
     */
    public static handleAIUpdate(
        current: PluginState['ai'],
        update: Partial<PluginState['ai']>
    ): PluginState['ai'] {
        return {
            isInitialized: update.isInitialized ?? current.isInitialized,
            isConnected: update.isConnected ?? current.isConnected,
            currentModel: update.currentModel ?? current.currentModel,
            isProcessing: update.isProcessing ?? current.isProcessing,
            provider: update.provider ?? current.provider,
            availableModels: update.availableModels ?? current.availableModels,
            generators: update.generators ?? current.generators,
            error: update.error,
            lastResponse: update.lastResponse,
            lastError: update.lastError,
            operationMetrics: update.operationMetrics,
            performanceMetrics: update.performanceMetrics,
            currentOperation: update.currentOperation,
            queueLength: update.queueLength,
            lastOperation: update.lastOperation
        };
    }

    /**
     * Handle UI state updates
     */
    public static handleUIUpdate(
        current: PluginState['ui'],
        update: Partial<PluginState['ui']>
    ): PluginState['ui'] {
        return {
            darkMode: update.darkMode ?? current.darkMode,
            activeAccordion: update.activeAccordion,
            notifications: update.notifications ?? current.notifications
        };
    }

    /**
     * Handle files state updates
     */
    public static handleFilesUpdate(
        current: PluginState['files'],
        update: Partial<PluginState['files']>
    ): PluginState['files'] {
        return {
            processedFiles: update.processedFiles ?? current.processedFiles,
            lastProcessed: update.lastProcessed,
            stats: {
                totalProcessed: update.stats?.totalProcessed ?? current.stats.totalProcessed,
                successCount: update.stats?.successCount ?? current.stats.successCount,
                errorCount: update.stats?.errorCount ?? current.stats.errorCount,
                averageProcessingTime: update.stats?.averageProcessingTime ?? current.stats.averageProcessingTime
            }
        };
    }
}