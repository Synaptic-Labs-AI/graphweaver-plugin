// src/managers/EventManager.ts

import { App, Events, EventRef, TFile, Editor, WorkspaceLeaf } from 'obsidian';

/**
 * Handler type for workspace events
 */
type EventHandler<T extends unknown[] = any[]> = (...args: T) => any;

/**
 * Stored handler information with type safety
 */
interface StoredHandler<T extends unknown[] = any[]> {
    event: string;
    handler: EventHandler<T>;
    ref: EventRef;
}

/**
 * Extended workspace events that include custom events
 */
type ExtendedWorkspaceEvents = Events & {
    'layout-ready': () => void;
    'file-open': (file: TFile | null) => void;
    'file-close': (file: TFile) => void;
    'active-leaf-change': (leaf: WorkspaceLeaf | null) => void;
    'editor-change': (editor: Editor | null) => void;
    'quit': () => void;
};

/**
 * Enhanced EventManager with improved type safety and cleanup
 */
export class EventManager {
    private handlers: StoredHandler[] = [];
    private destroyed: boolean = false;

    constructor(private app: App) {}

    /**
     * Register a workspace event handler with type safety
     * @param event Event name from ExtendedWorkspaceEvents
     * @param handler Event handler function with proper type inference
     */
    public register<K extends keyof ExtendedWorkspaceEvents>(
        event: K,
        handler: EventHandler<Parameters<ExtendedWorkspaceEvents[K]>>
    ): void {
        if (this.destroyed) {
            console.warn('Attempting to register event on destroyed EventManager');
            return;
        }

        try {
            const ref = this.app.workspace.on(event as any, handler);
            this.handlers.push({
                event: event as string,
                handler,
                ref
            });
        } catch (error) {
            console.error(`Failed to register event handler for ${String(event)}:`, error);
        }
    }

    /**
     * Register a workspace event with type-safe parameter handling
     */
    public registerWithParams<K extends keyof ExtendedWorkspaceEvents>(
        event: K,
        handler: ExtendedWorkspaceEvents[K]
    ): void {
        const typedHandler = handler as EventHandler<Parameters<ExtendedWorkspaceEvents[K]>>;
        this.register(event, typedHandler);
    }

    /**
     * Deregister a specific event handler
     */
    public deregister(event: string, handler: EventHandler): void {
        const index = this.handlers.findIndex(h => 
            h.event === event && h.handler === handler
        );

        if (index !== -1) {
            const { ref } = this.handlers[index];
            this.app.workspace.offref(ref);
            this.handlers.splice(index, 1);
        }
    }

    /**
     * Clean up all registered event handlers
     */
    public cleanup(): void {
        if (this.destroyed) return;

        try {
            this.handlers.forEach(({ ref }) => {
                this.app.workspace.offref(ref);
            });
            this.handlers = [];
            this.destroyed = true;
        } catch (error) {
            console.error('Error during EventManager cleanup:', error);
        }
    }

    /**
     * Check manager's destroyed state
     */
    public checkDestroyed(): boolean {
        return this.destroyed;
    }

    /**
     * Get number of registered handlers
     */
    public getHandlerCount(): number {
        return this.handlers.length;
    }
}