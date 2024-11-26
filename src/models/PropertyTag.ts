// src/models/PropertyTag.ts

export type PropertyType = 'string' | 'number' | 'boolean' | 'array' | 'date';

/**
 * Interface representing a custom property tag.
 */
export interface PropertyTag {
    name: string;
    description: string;
    type: PropertyType;
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