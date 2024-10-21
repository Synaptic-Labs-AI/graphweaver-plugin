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
            if (property.required) {
                schema.required.push(property.name);
            }
        });

        // Add tags to the schema
        schema.properties.tags = {
            type: 'array',
            items: {
                type: 'string',
                enum: settings.tags.customTags.map(tag => tag.name)
            },
            description: 'Select appropriate tags for the document from the provided list'
        };

        // Add content field for the main body
        schema.properties.content = {
            type: 'string',
            description: 'Main content of the note in Markdown format'
        };

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
