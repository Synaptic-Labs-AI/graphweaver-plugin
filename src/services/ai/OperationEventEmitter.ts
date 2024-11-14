import { TypedEventEmitter } from '../core/TypedEventEmitter';
import { OperationType, OperationStatus } from 'src/types/OperationTypes';
import { IService } from '../core/IService';
import { ServiceState } from '../../state/ServiceState';
import { ServiceError } from '../core/ServiceError';

export interface OperationEvents extends Record<string | symbol, (...args: any[]) => void> {
    'operationStart': (status: OperationStatus) => void;
    'operationComplete': (status: OperationStatus) => void;
    'operationError': (error: Error, status: OperationStatus) => void;
    'operationProgress': (progress: number) => void;
    'queueUpdate': (queueLength: number) => void;
    'stateChange': (status: OperationStatus) => void;
    'metricsUpdate': (metrics: Record<OperationType, any>) => void;
}

export class OperationEventEmitter extends TypedEventEmitter<OperationEvents> implements IService {
    public readonly serviceId = 'operation-emitter';
    public readonly serviceName = 'Operation Event Emitter';
    private state: ServiceState = ServiceState.Uninitialized;
    private error: ServiceError | null = null;

    constructor() {
        super();
    }

    async initialize(): Promise<void> {
        this.state = ServiceState.Ready;
    }

    isReady(): boolean {
        return this.state === ServiceState.Ready;
    }

    async destroy(): Promise<void> {
        this.removeAllListeners();
        this.state = ServiceState.Destroyed;
    }

    getState(): { state: ServiceState; error: ServiceError | null } {
        return { state: this.state, error: this.error };
    }

    // Existing event emitter methods...
    public emitOperationStart(status: OperationStatus): void {
        this.emit('operationStart', status);
    }

    public emitOperationComplete(status: OperationStatus): void {
        this.emit('operationComplete', status);
    }

    public emitOperationError(error: Error, status: OperationStatus): void {
        this.emit('operationError', error, status);
    }

    public emitOperationProgress(progress: number): void {
        this.emit('operationProgress', progress);
    }

    public emitQueueUpdate(queueLength: number): void {
        this.emit('queueUpdate', queueLength);
    }

    public emitStateChange(status: OperationStatus): void {
        this.emit('stateChange', status);
    }

    public emitMetricsUpdate(metrics: Record<OperationType, any>): void {
        this.emit('metricsUpdate', metrics);
    }
}