import { EventEmitter } from 'events';

/**
 * Helper type to ensure event handlers are functions
 */
type EventHandler = (...args: any[]) => void;

/**
 * Constraint type to ensure Events maps to handler functions
 */
type EventMap = Record<string | symbol, EventHandler>;

/**
 * TypedEventEmitter provides type-safe event handling.
 * @template Events Type map of event names to their handler signatures
 */
export class TypedEventEmitter<Events extends EventMap> extends EventEmitter {
    /**
     * Register an event handler with type checking
     * @param event The event name
     * @param listener The event handler function
     */
    public on<K extends keyof Events>(event: K, listener: Events[K]): this {
        return super.on(event as string, listener);
    }

    /**
     * Remove an event handler with type checking
     * @param event The event name
     * @param listener The event handler function to remove
     */
    public off<K extends keyof Events>(event: K, listener: Events[K]): this {
        return super.off(event as string, listener);
    }

    /**
     * Emit an event with type-safe arguments
     * @param event The event name
     * @param args The arguments to pass to handlers
     */
    public emit<K extends keyof Events>(
        event: K,
        ...args: Parameters<Events[K]>
    ): boolean {
        return super.emit(event as string, ...args);
    }
}