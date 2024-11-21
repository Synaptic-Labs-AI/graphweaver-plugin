// src/stores/ProcessingStore.ts
import { derived, get } from 'svelte/store';
import type { ProcessingStore as IProcessingStore } from '@type/store.types';
import { ProcessingState, ProcessingStateEnum } from '@type/processing.types';
import { createPersistedStore } from './StoreUtils';
import { utils as coreUtils } from './CoreStore';
import { LifecycleState } from '@type/base.types';import { ServiceError } from '@services/core/ServiceError';

const initialState: ProcessingState = {
    isProcessing: false,
    currentFile: null,
    queue: [],
    progress: 0,
    state: ProcessingStateEnum.IDLE,
    filesQueued: 0,
    filesProcessed: 0,
    filesRemaining: 0,
    errors: [],
    error: null,
    startTime: null,
    estimatedTimeRemaining: null
};

export class ProcessingStore implements IProcessingStore {
    readonly serviceId = 'processing-store';
    readonly serviceName = 'Processing Store';
    private static readonly STORAGE_KEY = 'graphweaver-processing-state';
    private static instance: ProcessingStore | null = null;
    private readonly store;
    public subscribe;
    public set;
    public update;

    private constructor() {
        const store = createPersistedStore<ProcessingState>(
            ProcessingStore.STORAGE_KEY,
            structuredClone(initialState)
        );

        this.store = store;
        this.subscribe = store.subscribe;
        this.set = store.set;
        this.update = store.update;
    }

    public static getInstance(): ProcessingStore {
        if (!ProcessingStore.instance) {
            ProcessingStore.instance = new ProcessingStore();
        }
        return ProcessingStore.instance;
    }

    async initialize(): Promise<void> {
        try {
            // Initialize with default state
            const currentState = this.getSnapshot();
            if (!currentState) {
                this.set(structuredClone(initialState));
            }
        } catch (error) {
            this.handleError('Failed to initialize Processing Store', error);
            throw error;
        }
    }

    reset(): void {
        this.set(structuredClone(initialState));
    }

    getSnapshot(): ProcessingState {
        return get(this.store);
    }

    startProcessing(file: string): void {
        try {
            this.update(state => ({
                ...state,
                isProcessing: true,
                currentFile: file,
                progress: 0,
                state: ProcessingStateEnum.RUNNING,
                startTime: Date.now(),
                filesQueued: state.queue.length,
                filesRemaining: state.queue.length
            }));
        } catch (error) {
            this.handleError('Failed to start processing', error);
        }
    }

    completeFile(file: string): void {
        try {
            this.update(state => {
                const filesProcessed = state.filesProcessed + 1;
                const filesRemaining = state.filesQueued - filesProcessed;
                
                const elapsedTime = Date.now() - (state.startTime || Date.now());
                const averageTimePerFile = elapsedTime / filesProcessed;
                const estimatedTimeRemaining = averageTimePerFile * filesRemaining;

                return {
                    ...state,
                    isProcessing: filesRemaining > 0,
                    currentFile: null,
                    progress: (filesProcessed / state.filesQueued) * 100,
                    state: filesRemaining > 0 ? ProcessingStateEnum.RUNNING : ProcessingStateEnum.IDLE,
                    filesProcessed,
                    filesRemaining,
                    estimatedTimeRemaining
                };
            });
        } catch (error) {
            this.handleError('Failed to complete file processing', error);
        }
    }

    setError(error: string | undefined): void {
        try {
            this.update(state => {
                const newError = error ? {
                    filePath: state.currentFile || 'unknown',
                    error,
                    timestamp: Date.now(),
                    retryCount: 0
                } : undefined;

                return {
                    ...state,
                    state: error ? ProcessingStateEnum.ERROR : state.state,
                    errors: newError ? [...state.errors, newError] : state.errors
                };
            });
        } catch (err) {
            this.handleError('Failed to set error state', err);
        }
    }

    clearError(): void {
        try {
            this.update(state => ({
                ...state,
                state: state.isProcessing ? ProcessingStateEnum.RUNNING : ProcessingStateEnum.IDLE,
                errors: []
            }));
        } catch (error) {
            this.handleError('Failed to clear error state', error);
        }
    }

    updateProgress(progress: number): void {
        try {
            this.update(state => ({
                ...state,
                progress: Math.min(Math.max(progress, 0), 100)
            }));
        } catch (error) {
            this.handleError('Failed to update progress', error);
        }
    }

    updateQueue(files: string[]): void {
        try {
            this.update(state => ({
                ...state,
                queue: files,
                filesQueued: files.length,
                filesRemaining: files.length
            }));
        } catch (error) {
            this.handleError('Failed to update queue', error);
        }
    }

    public isReady(): boolean {
        const state = this.getSnapshot();
        return state.state !== ProcessingStateEnum.ERROR;
    }

    public async destroy(): Promise<void> {
        this.reset();
    }

    public getState(): { state: LifecycleState; error: ServiceError | null } {
        const snapshot = this.getSnapshot();
        return {
            state: snapshot.state === ProcessingStateEnum.ERROR ? 
                   LifecycleState.Error : LifecycleState.Initializing,
            error: snapshot.error ? new ServiceError(
                this.serviceId,
                snapshot.error,
                { state: snapshot }
            ) : null
        };
    }

    private handleError(message: string, error: unknown): void {
        coreUtils.reportError(message, 'error', { error });
    }
}

// Create singleton instance
export const processingStore = ProcessingStore.getInstance();

// Derived stores for common queries
export const processingStatus = derived(processingStore, ($store) => ({
    isProcessing: $store.isProcessing,
    currentFile: $store.currentFile,
    progress: $store.progress,
    state: $store.state,
    filesQueued: $store.filesQueued,
    filesProcessed: $store.filesProcessed,
    filesRemaining: $store.filesRemaining,
    hasErrors: $store.errors.length > 0
}));

export const processingErrors = derived(processingStore, 
    ($store) => $store.errors
);

export const processingProgress = derived(processingStore, ($store) => ({
    progress: $store.progress,
    estimatedTimeRemaining: $store.estimatedTimeRemaining
}));