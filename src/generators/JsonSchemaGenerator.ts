// src/generators/JsonSchemaGenerator.ts

import { BaseGenerator, BaseGeneratorInput, BaseGeneratorOutput } from './BaseGenerator';
import { AIAdapter } from 'src/models/AIModels';
import { SettingsService } from '../services/SettingsService';
import { PropertyTag } from '../models/PropertyTag';

/**
 * Generator for creating JSON schemas with lazy settings initialization
 * Key change: Make settings initialization lazy to break circular dependency
 */
export class JsonSchemaGenerator extends BaseGenerator<BaseGeneratorInput, BaseGeneratorOutput> {
    protected settingsInitialized: boolean = false;
    protected cachedSchema: object | null = null;

    constructor(
        aiAdapter: AIAdapter,
        settingsService: SettingsService
    ) {
        super(aiAdapter, settingsService);
    }

    /**
     * Generates a base JSON schema based on settings.
     * Handles lazy initialization of settings to avoid circular dependencies.
     */
    public async generateBaseSchema(): Promise<object> {
        const schema: any = {
            type: 'object',
            properties: {},
            required: []
        };

        try {
            if (!this.settingsInitialized) {
                this.settingsInitialized = true;
                const settings = this.settingsService.getSettings();

                if (settings.frontMatter?.customProperties) {
                    settings.frontMatter.customProperties.forEach((property: PropertyTag) => {
                        schema.properties[property.name] = {
                            type: this.getJsonSchemaType(property.type),
                            description: `Create ${property.description}`
                        };
                        if (property.required) {
                            schema.required.push(property.name);
                        }
                    });
                }

                if (settings.tags?.customTags) {
                    schema.properties.tags = {
                        type: 'array',
                        items: {
                            type: 'string',
                            enum: settings.tags.customTags.map(tag => tag.name)
                        },
                        description: 'Select appropriate tags from the provided list'
                    };
                }
            }
        } catch (error) {
            console.warn('JsonSchemaGenerator: Settings not yet available, using basic schema');
        }

        schema.additionalProperties = false;
        return schema;
    }

    /**
     * Determines the JSON schema type based on the provided property type.
     * @param propertyType The type of the property (e.g., 'number', 'boolean', 'array')
     * @returns The corresponding JSON schema type as a string
     */
    public getJsonSchemaType(propertyType: string): string {
        switch (propertyType) {
            case 'number':
                return 'number';
            case 'boolean':
                return 'boolean';
            case 'array':
                return 'array';
            default:
                return 'string';
        }
    }

    /**
     * Resets the cached schema and settings initialization flag.
     * Useful for scenarios where settings have changed and the schema needs to be regenerated.
     */
    public resetCache(): void {
        this.cachedSchema = null;
        this.settingsInitialized = false;
    }

    /**
     * Overrides the preparePrompt method.
     * Not used in JsonSchemaGenerator, returns an empty string.
     */
    protected preparePrompt(_input: BaseGeneratorInput): string {
        return '';
    }

    /**
     * Overrides the formatOutput method.
     * Not used in JsonSchemaGenerator, returns an empty object.
     */
    protected formatOutput(_aiResponse: any, _originalInput: BaseGeneratorInput): BaseGeneratorOutput {
        return {};
    }
}
