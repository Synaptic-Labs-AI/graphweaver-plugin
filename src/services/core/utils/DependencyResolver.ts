// src/services/core/DependencyResolver.ts

import { ServiceError } from "../ServiceError";
import { ServiceRegistration } from "src/types/ServiceTypes";

/**
 * Utility class to resolve service dependencies and calculate initialization order
 */
export class DependencyResolver {
    /**
     * Calculate initialization order based on dependencies
     * @param services Map of service registrations
     * @returns Ordered array of service IDs for initialization
     */
    public static calculateInitializationOrder(services: Map<string, ServiceRegistration>): string[] {
        const visited = new Set<string>();
        const initialized = new Set<string>();
        const order: string[] = [];

        const visit = (id: string, path: Set<string> = new Set()): void => {
            if (path.has(id)) {
                throw ServiceError.from(
                    'DependencyResolver',
                    'Circular dependency detected',
                    { path: Array.from(path).join(' -> ') + ` -> ${id}` }
                );
            }

            if (initialized.has(id)) return;
            if (visited.has(id)) return;

            visited.add(id);
            path.add(id);

            const registration = services.get(id);
            if (!registration) {
                throw ServiceError.from(
                    'DependencyResolver',
                    `Service ${id} not found during initialization`
                );
            }

            for (const depId of registration.dependencies) {
                visit(depId, path);
            }

            path.delete(id);
            initialized.add(id);
            order.push(id);
        };

        for (const id of services.keys()) {
            if (!visited.has(id)) {
                visit(id);
            }
        }

        return order;
    }

    /**
     * Validate dependency graph to ensure no circular dependencies exist
     * @param services Map of service registrations
     */
    public static validateDependencyGraph(services: Map<string, ServiceRegistration>): void {
        const visited = new Set<string>();
        const recursionStack = new Set<string>();

        const detectCycle = (serviceId: string, path: string[] = []): void => {
            if (recursionStack.has(serviceId)) {
                throw ServiceError.from(
                    'DependencyResolver',
                    `Circular dependency detected: ${path.join(' -> ')} -> ${serviceId}`,
                    { path: [...path, serviceId] }
                );
            }

            if (visited.has(serviceId)) return;

            visited.add(serviceId);
            recursionStack.add(serviceId);
            path.push(serviceId);

            const service = services.get(serviceId);
            if (service) {
                for (const depId of service.dependencies) {
                    detectCycle(depId, path);
                }
            }

            recursionStack.delete(serviceId);
            path.pop();
        };

        for (const id of services.keys()) {
            if (!visited.has(id)) {
                detectCycle(id);
            }
        }
    }
}
