import { OperationType, OperationStatus, OperationMetrics } from 'src/types/OperationTypes';
import { IService } from '../core/IService';
import { ServiceState } from '../../state/ServiceState';
import { ServiceError } from '../core/ServiceError';

export class MetricsTracker implements IService {
    public readonly serviceId = 'metrics-tracker';
    public readonly serviceName = 'Metrics Tracker';
    private state: ServiceState = ServiceState.Uninitialized;
    private error: ServiceError | null = null;

    private metrics: Record<OperationType, OperationMetrics> = {} as Record<OperationType, OperationMetrics>;
    private operationHistory: OperationStatus[] = [];
    public readonly MAX_HISTORY_SIZE = 50;

    async initialize(): Promise<void> {
        try {
            this.state = ServiceState.Initializing;
            this.initializeMetrics();
            this.state = ServiceState.Ready;
        } catch (error) {
            this.state = ServiceState.Error;
            this.error = error instanceof ServiceError ? error : new ServiceError(this.serviceName, 'Initialization failed');
            throw this.error;
        }
    }

    isReady(): boolean {
        return this.state === ServiceState.Ready;
    }

    async destroy(): Promise<void> {
        try {
            this.state = ServiceState.Destroying;
            this.clearHistory();
            this.resetMetrics();
            this.state = ServiceState.Destroyed;
        } catch (error) {
            this.state = ServiceState.Error;
            this.error = error instanceof ServiceError ? error : new ServiceError(this.serviceName, 'Destroy failed');
            throw this.error;
        }
    }

    getState(): { state: ServiceState; error: ServiceError | null } {
        return { state: this.state, error: this.error };
    }

    // Rest of existing MetricsTracker implementation...
    public initializeMetrics(): void {
        Object.values(OperationType).forEach(type => {
            this.metrics[type] = {
                totalOperations: 0,
                successfulOperations: 0,
                failedOperations: 0,
                averageDuration: 0,
                lastOperation: undefined
            };
        });
    }

    public trackOperation(status: OperationStatus): void {
        this.updateMetrics(status);
        this.operationHistory.unshift(status);
        if (this.operationHistory.length > this.MAX_HISTORY_SIZE) {
            this.operationHistory.pop();
        }
    }

    private updateMetrics(status: OperationStatus): void {
        const metrics = this.metrics[status.type];
        const duration = (status.endTime || Date.now()) - status.startTime;

        metrics.totalOperations++;
        if (status.success) {
            metrics.successfulOperations++;
        } else {
            metrics.failedOperations++;
        }

        metrics.averageDuration = (metrics.averageDuration * (metrics.totalOperations - 1) + duration) / metrics.totalOperations;
        metrics.lastOperation = status;
    }

    public getMetrics(type: OperationType): OperationMetrics {
        return { ...this.metrics[type] };
    }

    public getAllMetrics(): Record<OperationType, OperationMetrics> {
        return { ...this.metrics };
    }

    public getHistory(): OperationStatus[] {
        return [...this.operationHistory];
    }

    public clearHistory(): void {
        this.operationHistory = [];
    }

    public resetMetrics(): void {
        this.initializeMetrics();
    }
}