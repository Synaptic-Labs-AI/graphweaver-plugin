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