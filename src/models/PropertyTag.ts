// src/models/PropertyTag.ts

export type PropertyType = 'string' | 'number' | 'boolean' | 'array' | 'date';

/**
 * Interface representing a custom property tag.
 */
export interface PropertyTag {
    name: string;
    description: string;
    type: PropertyType;
    required: boolean;
    defaultValue?: any;
    options?: string[]; // For properties that have predefined options
    multipleValues: boolean; // Whether the property can have multiple values
}

/**
 * Interface representing a custom tag, extended to match PropertyTag.
 */
export interface Tag extends PropertyTag {}

/**
 * Interface representing the state of the Property Manager.
 */
export interface PropertyManagerState {
    customProperties: PropertyTag[];
}

/**
 * Interface representing the state of the Tag Manager.
 */
export interface TagManagerState {
    customTags: Tag[];
}