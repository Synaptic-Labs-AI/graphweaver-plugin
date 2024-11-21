/**
 * Metadata Types Module
 * @module types/metadata
 * @description Type definitions for metadata management including properties and tags
 */

/**
 * Available property value types
 */
export type PropertyType = 'string' | 'number' | 'boolean' | 'array' | 'date';

/**
 * Property value type mapping
 */
export type PropertyValueType<T extends PropertyType> = 
    T extends 'string' ? string :
    T extends 'number' ? number :
    T extends 'boolean' ? boolean :
    T extends 'array' ? unknown[] :
    T extends 'date' ? Date :
    never;

/**
 * Base metadata field interface
 * @interface
 */
export interface MetadataField {
    /** Unique identifier of the field */
    name: string;
    /** Human-readable description */
    description: string;
    /** Whether the field is required */
    required: boolean;
    /** Whether the field can have multiple values */
    multipleValues: boolean;
}

/**
 * Property definition interface
 * @interface
 * @extends MetadataField
 */
export interface PropertyTag extends MetadataField {
    /** Type of the property value */
    type: PropertyType;
    /** Default value for the property */
    defaultValue?: PropertyValueType<PropertyType>;
    /** Predefined options for the property */
    options?: string[];
    /** Optional validation rules */
    validation?: {
        /** Minimum value for number types */
        min?: number;
        /** Maximum value for number types */
        max?: number;
        /** Pattern for string validation */
        pattern?: string;
        /** Custom validation function */
        validate?: (value: unknown) => boolean;
    };
}

/**
 * Custom tag interface
 * @interface
 * @extends PropertyTag
 */
export interface Tag extends PropertyTag {
    /** Additional tag-specific metadata */
    metadata?: Record<string, unknown>;
}

/**
 * Property manager state
 * @interface
 */
export interface PropertyManagerState {
    /** List of custom property definitions */
    customProperties: PropertyTag[];
    /** Last update timestamp */
    lastUpdated?: number;
    /** Active property filters */
    activeFilters?: string[];
    /** Property groups */
    groups?: Record<string, PropertyTag[]>;
}

/**
 * Tag manager state
 * @interface
 */
export interface TagManagerState {
    /** List of custom tag definitions */
    customTags: Tag[];
    /** Last update timestamp */
    lastUpdated?: number;
    /** Tag hierarchy */
    hierarchy?: Record<string, string[]>;
    /** Tag relationships */
    relationships?: Record<string, string[]>;
}

/**
 * Metadata validation result
 * @interface
 */
export interface MetadataValidationResult {
    /** Whether the validation passed */
    isValid: boolean;
    /** Validation errors if any */
    errors?: string[];
    /** Fields that failed validation */
    invalidFields?: string[];
}