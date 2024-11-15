// src/services/ai/GeneratorFactory.ts

import { BaseGenerator } from '../../generators/BaseGenerator';
import { FrontMatterGenerator } from '../../generators/FrontMatterGenerator';
import { WikilinkGenerator } from '../../generators/WikilinkGenerator';
import { OntologyGenerator } from '../../generators/OntologyGenerator';
import { JsonSchemaGenerator } from '../../generators/JsonSchemaGenerator';
import { KnowledgeBloomGenerator } from '../../generators/KnowledgeBloomGenerator';
import { App } from 'obsidian';
import { SettingsService } from '../SettingsService';
import { PersistentStateManager } from '../../managers/StateManager';
import { AdapterRegistry } from './AdapterRegistry';
import { IService } from '../core/IService';
import { ServiceState } from '../../state/ServiceState';
import { ServiceError } from '../core/ServiceError';
import { WikilinkTextProcessor } from '../WikilinkTextProcessor';

/**
 * Available generator types
 */
export enum GeneratorType {
    JsonSchema = 'jsonSchema',
    FrontMatter = 'frontMatter',
    Wikilink = 'wikilink',
    Ontology = 'ontology',
    KnowledgeBloom = 'knowledgeBloom'
}

/**
 * Internal generator state
 */
enum GeneratorState {
    NotInitialized = 'not_initialized',
    Creating = 'creating',
    Ready = 'ready',
    Error = 'error'
}

/**
 * Generator status interface
 */
export interface GeneratorStatus {
    isInitialized: boolean;
    lastRun: Date | null;
    statusMessage: string;
}

/**
 * Type mapping for generators
 */
type GeneratorTypeMap = {
    [GeneratorType.FrontMatter]: FrontMatterGenerator;
    [GeneratorType.Wikilink]: WikilinkGenerator;
    [GeneratorType.Ontology]: OntologyGenerator;
    [GeneratorType.KnowledgeBloom]: KnowledgeBloomGenerator;
    [GeneratorType.JsonSchema]: JsonSchemaGenerator;
};

/**
 * Factory for managing generator instances
 * Implements IService for proper service lifecycle management
 */
export class GeneratorFactory implements IService {
    // IService implementation
    public readonly serviceId = 'generator-factory';
    public readonly serviceName = 'Generator Factory Service';
    protected serviceState: ServiceState = ServiceState.Uninitialized;
    protected serviceError: ServiceError | null = null;
    protected isUnloading: boolean = false;

    // Generator factory properties
    public instances = new Map<GeneratorType, BaseGenerator<any, any>>();
    public states = new Map<GeneratorType, GeneratorState>();
    public lastRun = new Map<GeneratorType, Date>();

    private wikilinkProcessor: WikilinkTextProcessor;

    constructor(
        public app: App,
        public stateManager: PersistentStateManager,
        public settingsService: SettingsService,
        public adapterRegistry: AdapterRegistry,
        wikilinkProcessor: WikilinkTextProcessor
    ) {
        this.wikilinkProcessor = wikilinkProcessor;
        this.initializeStates();
    }

    /**
     * Initialize service and all essential generators
     */
    public async initialize(): Promise<void> {
        if (this.isUnloading) {
            throw new ServiceError(this.serviceName, 'Cannot initialize while unloading');
        }

        try {
            this.serviceState = ServiceState.Initializing;
            await this.initializeEssentialGenerators();
            this.serviceState = ServiceState.Ready;
        } catch (error) {
            this.serviceState = ServiceState.Error;
            this.serviceError = ServiceError.from(
                this.serviceName,
                error,
                { context: 'Service initialization failed' }
            );
            console.error('GeneratorFactory: Initialization failed:', error);
            throw this.serviceError;
        }
    }

    /**
     * Initialize essential generators needed for basic functionality
     */
    private async initializeEssentialGenerators(): Promise<void> {
        try {
            // Directly create and initialize essential generators without using getGenerator
            const jsonSchemaGen = this.createJsonSchemaGenerator();
            this.instances.set(GeneratorType.JsonSchema, jsonSchemaGen);
            await jsonSchemaGen.initialize();
            this.updateState(GeneratorType.JsonSchema, GeneratorState.Ready);

            const frontMatterGen = new FrontMatterGenerator(
                this.adapterRegistry.getCurrentAdapter(),
                this.settingsService,
                jsonSchemaGen
            );
            this.instances.set(GeneratorType.FrontMatter, frontMatterGen);
            await frontMatterGen.initialize();
            this.updateState(GeneratorType.FrontMatter, GeneratorState.Ready);

        } catch (error) {
            throw new ServiceError(
                this.serviceName,
                'Failed to initialize essential generators',
                error instanceof Error ? error : undefined
            );
        }
    }

    /**
     * Check if service is ready
     */
    public isReady(): boolean {
        return this.serviceState === ServiceState.Ready && !this.isUnloading;
    }

    /**
     * Clean up service resources
     */
    public async destroy(): Promise<void> {
        if (this.isUnloading) return;

        try {
            this.isUnloading = true;
            this.serviceState = ServiceState.Destroying;
            await this.cleanup();
            this.serviceState = ServiceState.Destroyed;
        } catch (error) {
            this.serviceState = ServiceState.Error;
            this.serviceError = ServiceError.from(
                this.serviceName,
                error,
                { context: 'Service destroy failed' }
            );
            throw this.serviceError;
        }
    }

    /**
     * Internal cleanup method
     */
    private async cleanup(): Promise<void> {
        await this.resetAll();
        this.instances.clear();
        this.states.clear();
        this.lastRun.clear();
    }

    /**
     * Initialize generator states
     */
    public initializeStates(): void {
        Object.values(GeneratorType).forEach(type => {
            this.states.set(type, GeneratorState.NotInitialized);
        });
    }

    public getState(): { state: ServiceState; error: ServiceError | null } {
        return {
            state: this.serviceState,
            error: this.serviceError
        };
    }
    
    /**
     * Get a specific type of generator with proper typing
     */
    public async getTypedGenerator<T extends GeneratorType>(
        type: T
    ): Promise<GeneratorTypeMap[T]> {
        const generator = await this.getGenerator(type);
        return generator as GeneratorTypeMap[T];
    }

    /**
     * Get generator for FrontMatter
     */
    public async getFrontMatterGenerator(): Promise<FrontMatterGenerator> {
        return this.getTypedGenerator(GeneratorType.FrontMatter);
    }

    /**
     * Get generator for Wikilinks
     */
    public async getWikilinkGenerator(): Promise<WikilinkGenerator> {
        return this.getTypedGenerator(GeneratorType.Wikilink);
    }

    /**
     * Get a generator by type with lifecycle management
     */
    public async getGenerator(type: GeneratorType): Promise<BaseGenerator<any, any>> {
        if (!this.isReady()) {
            throw new ServiceError(this.serviceName, 'Service not ready');
        }

        try {
            this.updateState(type, GeneratorState.Creating);

            let generator = this.instances.get(type);
            if (generator) {
                return generator;
            }

            generator = await this.createGenerator(type);

            this.instances.set(type, generator);
            this.lastRun.set(type, new Date());
            this.updateState(type, GeneratorState.Ready);

            return generator;
        } catch (error) {
            this.updateState(type, GeneratorState.Error, error instanceof Error ? error.message : 'Unknown error');
            console.error(`GeneratorFactory: Error creating generator of type ${type}:`, error);
            throw error;
        }
    }

    /**
     * Create a generator of specific type
     */
    public async createGenerator(type: GeneratorType): Promise<BaseGenerator<any, any>> {
        switch (type) {
            case GeneratorType.FrontMatter:
                return this.createFrontMatterGenerator();
            case GeneratorType.Wikilink:
                return this.createWikilinkGenerator();
            case GeneratorType.Ontology:
                return this.createOntologyGenerator();
            case GeneratorType.KnowledgeBloom:
                return this.createKnowledgeBloomGenerator();
            case GeneratorType.JsonSchema:
                return this.createJsonSchemaGenerator();
            default:
                throw new Error(`Unknown GeneratorType: ${type}`);
        }
    }

    /**
     * Create FrontMatter Generator
     */
    public async createFrontMatterGenerator(): Promise<FrontMatterGenerator> {
        const jsonSchemaGen = this.instances.get(GeneratorType.JsonSchema) as JsonSchemaGenerator;
        if (!jsonSchemaGen) {
            throw new ServiceError(
                this.serviceName,
                'JsonSchemaGenerator instance not found'
            );
        }
        const frontMatterGen = new FrontMatterGenerator(
            this.adapterRegistry.getCurrentAdapter(),
            this.settingsService,
            jsonSchemaGen
        );
        await frontMatterGen.initialize();
        return frontMatterGen;
    }

    /**
     * Create Wikilink Generator
     */
    public async createWikilinkGenerator(): Promise<WikilinkGenerator> {
        const wikilinkGen = new WikilinkGenerator(
            this.adapterRegistry.getCurrentAdapter(),
            this.settingsService
        );
        await wikilinkGen.initialize();
        return wikilinkGen;
    }

    /**
     * Create Ontology Generator
     */
    public async createOntologyGenerator(): Promise<OntologyGenerator> {
        const ontologyGen = new OntologyGenerator(
            this.adapterRegistry.getCurrentAdapter(),
            this.settingsService
        );
        await ontologyGen.initialize();
        return ontologyGen;
    }

    /**
     * Create KnowledgeBloom Generator
     */
    public async createKnowledgeBloomGenerator(): Promise<KnowledgeBloomGenerator> {
        const frontMatterGen = this.instances.get(GeneratorType.FrontMatter) as FrontMatterGenerator;
        if (!frontMatterGen) {
            throw new ServiceError(
                this.serviceName,
                'FrontMatterGenerator instance not found'
            );
        }
        const knowledgeBloomGen = new KnowledgeBloomGenerator(
            this.adapterRegistry.getCurrentAdapter(),
            this.settingsService,
            this.app,
            frontMatterGen,
            this.wikilinkProcessor
        );
        await knowledgeBloomGen.initialize();
        return knowledgeBloomGen;
    }

    /**
     * Create JsonSchema Generator
     */
    public createJsonSchemaGenerator(): JsonSchemaGenerator {
        return new JsonSchemaGenerator(
            this.adapterRegistry.getCurrentAdapter(),
            this.settingsService
        );
    }

    /**
     * Update generator state and notify state manager
     */
    public updateState(type: GeneratorType, state: GeneratorState, error?: string): void {
        if (this.isUnloading) return;

        this.states.set(type, state);
        this.updateStateManager(type, error);
    }

    /**
     * Update state manager with current generator status
     */
    public updateStateManager(updatedType: GeneratorType, error?: string): void {
        if (this.isUnloading) return;

        const generatorStatuses: Record<GeneratorType, GeneratorStatus> = {} as Record<GeneratorType, GeneratorStatus>;

        Object.values(GeneratorType).forEach(type => {
            const state = this.states.get(type) || GeneratorState.NotInitialized;
            generatorStatuses[type] = {
                isInitialized: state === GeneratorState.Ready,
                lastRun: this.lastRun.get(type) || null,
                statusMessage: state === GeneratorState.Ready
                    ? 'Ready'
                    : state === GeneratorState.Creating
                        ? 'Creating...'
                        : state === GeneratorState.Error
                            ? error || 'Error'
                            : 'Not Initialized'
            };
        });

        const currentState = this.stateManager.getSnapshot().ai;
        this.stateManager.update('ai', {
            ...currentState,
            generators: generatorStatuses
        });
    }

    /**
     * Reset a specific generator
     */
    public async resetGenerator(type: GeneratorType): Promise<void> {
        if (this.isUnloading) return;

        const instance = this.instances.get(type);
        if (instance) {
            if ('reset' in instance && typeof (instance as any).reset === 'function') {
                await (instance as any).reset();
            }
            this.instances.delete(type);
            this.lastRun.delete(type);
            this.states.set(type, GeneratorState.NotInitialized);
            this.updateStateManager(type);
        }
    }

    /**
     * Reset all generators
     */
    public async resetAll(): Promise<void> {
        if (this.isUnloading) return;

        for (const type of this.instances.keys()) {
            await this.resetGenerator(type);
        }
    }

    /**
     * Get generator state
     */
    public getGeneratorState(type: GeneratorType): GeneratorState {
        return this.states.get(type) || GeneratorState.NotInitialized;
    }

    /**
     * Check if a specific generator is ready
     */
    public isGeneratorReady(type: GeneratorType): boolean {
        return this.states.get(type) === GeneratorState.Ready;
    }

    /**
     * Get service state information
     */
    public getServiceState(): { state: ServiceState; error: ServiceError | null } {
        return {
            state: this.serviceState,
            error: this.serviceError
        };
    }
}
