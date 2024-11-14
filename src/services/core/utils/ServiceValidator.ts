// src/services/core/utils/ServiceValidator.ts

import { IService } from '../IService';
import { ServiceError } from '../ServiceError';
import { ServiceRegistrationConfig, ServiceRegistration, RegistrationStatus, isFactoryServiceConfig, isConstructorServiceConfig } from '../../../types/ServiceTypes';
import { DependencyResolver } from './DependencyResolver';

/**
 * Handles validation of service registration and configuration
 */
export class ServiceValidator {
    /**
     * Validate service registration
     * @param config Service registration configuration
     * @param existingServices Map of existing service registrations
     */
    public static validateRegistration<T extends IService>(
        config: ServiceRegistrationConfig<T>,
        existingServices: Map<string, ServiceRegistration>
    ): void {
        if (existingServices.has(config.id)) {
            throw ServiceError.from(
                'ServiceValidator',
                `Service ${config.id} is already registered`
            );
        }

        // Validate dependencies exist
        for (const depId of config.dependencies || []) {
            if (!existingServices.has(depId)) {
                throw ServiceError.from(
                    'ServiceValidator',
                    `Service ${config.id} depends on unknown service ${depId}`
                );
            }
        }

        // Validate dependency graph for cycles
        try {
            const tempServices = new Map(existingServices);

            const newRegistration: ServiceRegistration = {
                id: config.id,
                name: config.name || config.id,
                instance: null,
                dependencies: config.dependencies || [],
                status: RegistrationStatus.Registered,
                factory: isFactoryServiceConfig(config) ? config.factory : undefined,
                constructor: isConstructorServiceConfig(config) ? config.constructor : undefined,
            };

            tempServices.set(config.id, newRegistration);

            DependencyResolver.validateDependencyGraph(tempServices);
        } catch (error) {
            throw ServiceError.from(
                'ServiceValidator',
                error instanceof Error ? error.message : String(error),
                { serviceId: config.id, operation: 'validate-dependencies' }
            );
        }
    }
}
