// src/registrations/EventRegistrations.ts

import { ServiceRegistry } from "@registrations/ServiceRegistrations";
import { OperationEventEmitter } from '@services/ai/OperationEventEmitter';

/**
 * Register Event Services
 */
export function registerEventServices() {
    // Register OperationEventEmitter
    const operationEventEmitter = new OperationEventEmitter();
    ServiceRegistry.getInstance().registerService('operation-event-emitter', operationEventEmitter);
}