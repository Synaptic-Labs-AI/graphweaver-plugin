/**
 * @file events.types.ts
 * @description Type definitions for event handling system
 */

import { EventEmitter } from 'events';
import type { IService } from '@services/core/IService';
import type { ServiceRegistration, RegistrationError } from './services.types';
import { EventHandler } from './base.types';
import type { OperationStatus } from './operations.types';

/**
 * Service lifecycle events interface
 */
export interface ServiceEvents {
    registered: EventHandler<ServiceRegistration<IService>>;
    initialized: EventHandler<IService>;
    failed: EventHandler<RegistrationError>;
    ready: EventHandler<void>;
    destroyed: EventHandler<string>;
    [key: string]: EventHandler;
}

/**
 * Operation events interface
 */
export type GenericEventHandler = (...args: any[]) => void;

export interface OperationEvents {
    operationStart: GenericEventHandler;
    operationComplete: GenericEventHandler;
    operationError: GenericEventHandler;
    operationProgress: GenericEventHandler;
    queueUpdate: GenericEventHandler;
    [key: string]: EventHandler | ((error: Error, status: OperationStatus) => void);
}

/**
 * Type-safe event emitter interface
 */
export interface TypedEmitter<Events extends Record<string, GenericEventHandler>> {
    on<E extends keyof Events>(event: E, listener: Events[E]): this;
    off<E extends keyof Events>(event: E, listener: Events[E]): this;
    emit<E extends keyof Events>(event: E, ...args: Parameters<Events[E]>): boolean;
    once<E extends keyof Events>(event: E, listener: Events[E]): this;
}

/**
 * Type-safe event emitter implementation
 */
export class TypedEventEmitter<T extends Record<string, GenericEventHandler>> implements TypedEmitter<T> {
    private emitter: EventEmitter;

    constructor() {
        this.emitter = new EventEmitter();
    }

    public on<E extends keyof T>(event: E, listener: T[E]): this {
        this.emitter.on(event as string, listener);
        return this;
    }

    public off<E extends keyof T>(event: E, listener: T[E]): this {
        this.emitter.off(event as string, listener);
        return this;
    }

    public emit<E extends keyof T>(event: E, ...args: Parameters<T[E]>): boolean {
        return this.emitter.emit(event as string, ...args);
    }

    public once<E extends keyof T>(event: E, listener: T[E]): this {
        this.emitter.once(event as string, listener);
        return this;
    }

    public removeAllListeners<E extends keyof T>(event?: E): this {
        if (event) {
            this.emitter.removeAllListeners(event as string);
        } else {
            this.emitter.removeAllListeners();
        }
        return this;
    }
}