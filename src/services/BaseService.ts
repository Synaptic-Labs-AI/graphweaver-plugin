import { EventEmitter } from 'events';
import { Notice } from 'obsidian';
import { ErrorHandler } from '../utils/ErrorHandler';

export type DeepPartial<T> = T extends object ? {
    [P in keyof T]?: T[P] extends object 
        ? T[P] extends Array<any> 
            ? T[P] 
            : DeepPartial<T[P]>
        : T[P];
} : T;

export abstract class BaseService {
    protected emitter: EventEmitter;

    constructor() {
        this.emitter = new EventEmitter();
    }

    protected handleError(message: string, error: unknown): void {
        console.error(message, error);
        new Notice(`${message} ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    public async saveData(callback?: (data: any) => Promise<void>, data?: any): Promise<void> {
        try {
            if (callback && data !== undefined) {
                await callback(data);
            }
        } catch (error) {
            this.handleError('Error saving data:', error);
            throw error;
        }
    }

    protected deepMerge<T>(target: T, source: DeepPartial<T>): T {
        if (!source) {
            return target;
        }

        const output = { ...target };

        Object.keys(source).forEach(key => {
            const targetValue = output[key as keyof T];
            const sourceValue = (source as T)[key as keyof T];

            if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
                (output[key as keyof T] as any) = sourceValue;
            }
            else if (this.isObject(targetValue) && this.isObject(sourceValue)) {
                (output[key as keyof T] as any) = this.deepMerge(
                    targetValue,
                    sourceValue as DeepPartial<typeof targetValue>
                );
            }
            else if (sourceValue !== undefined) {
                (output[key as keyof T] as any) = sourceValue;
            }
        });

        return output;
    }

    protected isObject(item: unknown): item is Record<string, unknown> {
        return Boolean(
            item && 
            typeof item === 'object' && 
            !Array.isArray(item) &&
            !(item instanceof Date) &&
            !(item instanceof RegExp)
        );
    }

    protected on(event: string | symbol, listener: (...args: any[]) => void): void {
        this.emitter.on(event, listener);
    }

    protected emit(event: string | symbol, ...args: any[]): void {
        this.emitter.emit(event, ...args);
    }

    protected async executeWithHandling<T>(operation: () => Promise<T>): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            return ErrorHandler.handleError(error as Error, this.constructor.name);
        }
    }
}