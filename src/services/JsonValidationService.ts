// src/services/JsonValidationService.ts

import { Notice } from 'obsidian';

/**
 * Provides basic JSON validation and cleaning functionality.
 * Uses native JSON parsing instead of complex schema validation.
 */
export class JsonValidationService {
    /**
     * Basic validation of JSON data format
     * @param data The data to validate
     * @returns True if the data is valid JSON, false otherwise
     */
    public validate(data: any): boolean {
        try {
            // Check if it's already an object
            if (typeof data === 'object' && data !== null) {
                return true;
            }
            
            // If it's a string, try to parse it
            if (typeof data === 'string') {
                JSON.parse(data);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('JsonValidationService: JSON Validation Error:', error);
            return false;
        }
    }

    /**
     * Cleans and validates JSON string input
     * @param jsonString The JSON string to validate and clean
     * @returns The parsed JSON object
     */
    public validateAndCleanJson(jsonString: string): any {
        try {
            // Remove whitespace
            jsonString = jsonString.trim();

            // Remove markdown code blocks if present
            jsonString = jsonString.replace(/^```json?\s*|\s*```$/g, '');

            // Parse and return the JSON
            const parsedJson = JSON.parse(jsonString);
            return parsedJson;
        } catch (error) {
            console.error('JsonValidationService: Error validating JSON:', error);
            new Notice(`Invalid JSON format: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw new Error('Invalid JSON format');
        }
    }

    /**
     * Attempts to fix and parse potentially malformed JSON
     * @param str The JSON string to fix and parse
     * @returns The parsed JSON object or null if parsing fails
     */
    public fixAndParseJson(str: string): any | null {
        try {
            return JSON.parse(str);
        } catch (e) {
            // Try to fix common JSON issues
            try {
                // Fix unquoted keys
                str = str.replace(/(\w+)(?=\s*:)/g, '"$1"');
                
                // Fix single quotes to double quotes
                str = str.replace(/'/g, '"');
                
                // Remove trailing commas
                str = str.replace(/,\s*([\]}])/g, '$1');

                const fixedJson = JSON.parse(str);
                console.log('JsonValidationService: Successfully fixed and parsed JSON:', fixedJson);
                return fixedJson;
            } catch (fixError) {
                console.error('JsonValidationService: Failed to fix and parse JSON:', fixError);
                return null;
            }
        }
    }
}
