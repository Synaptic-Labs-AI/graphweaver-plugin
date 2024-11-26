import { SettingsService } from '../services/SettingsService';
import { PropertyTag } from '../models/PropertyTag';

export class JsonSchemaGenerator {
    public settingsService: SettingsService;

    constructor(settingsService: SettingsService) {
        this.settingsService = settingsService;
    }

    public generateSchemaForTopic(topic: string): object {
        // Customize the schema based on the topic if needed
        // For now, we return a base schema. You can extend this to modify the schema per topic.
        const baseSchema = this.generateBaseSchema();
        
        // Example: Add topic-specific modifications
        // if (topic.toLowerCase().includes('example')) {
        //     baseSchema.properties.exampleProperty = { type: 'string', description: 'An example property.' };
        // }

        return baseSchema;
    }


    public generateBaseSchema(): object {
        const settings = this.settingsService.getSettings();
        const schema: any = {
            type: 'object',
            properties: {},
            required: []
        };

        // Add custom properties to the schema
        settings.frontMatter.customProperties.forEach((property: PropertyTag) => {
            schema.properties[property.name] = {
                type: this.getJsonSchemaType(property.type),
                description: `Create ${property.description}`
            };
        });

        // Add tags to the schema
        schema.properties.tags = {
            type: 'array',
            items: {
                type: 'string',
                enum: settings.tags.customTags.map(tag => tag.name)
            },
            description: 'Select appropriate tags from the provided list'
        };

        // Explicitly exclude content field
        schema.additionalProperties = false;

        return schema;
    }

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
}
