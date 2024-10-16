import { Notice } from 'obsidian';

export class JsonValidationService {
    /**
     * Validates and cleans the JSON string.
     * @param jsonString The JSON string to validate and clean.
     * @returns A promise that resolves to the validated and cleaned JSON object.
     */
    public async validateAndCleanJson(jsonString: string): Promise<any> {
        try {
            // Remove any leading/trailing whitespace
            jsonString = jsonString.trim();

            // Remove any surrounding backticks if present
            jsonString = jsonString.replace(/^```json?\s*|\s*```$/g, '');

            // Parse the JSON string
            const jsonObject = JSON.parse(jsonString);

            // If parsing succeeds, return the object
            return jsonObject;
        } catch (error) {
            console.error('Error validating JSON:', error);
            new Notice(`Failed to validate JSON: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
            throw new Error('Invalid JSON format');
        }
    }

    /**
     * Checks if the provided string is valid JSON.
     * @param str The string to check.
     * @returns True if the string is valid JSON, false otherwise.
     */
    public isValidJson(str: string): boolean {
        try {
            JSON.parse(str);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Attempts to fix common JSON issues and parse the string.
     * @param str The potentially invalid JSON string.
     * @returns A parsed JSON object if successful, or null if parsing fails.
     */
    public tryFixAndParseJson(str: string): any | null {
        // Remove any surrounding backticks and "json" keyword
        str = str.replace(/^```json?\s*|\s*```$/g, '');

        // Try parsing the string as-is
        try {
            return JSON.parse(str);
        } catch (e) {
            // If parsing fails, try some common fixes
            
            // Fix unquoted keys
            str = str.replace(/(\w+)(?=\s*:)/g, '"$1"');
            
            // Fix single quotes to double quotes
            str = str.replace(/'/g, '"');
            
            // Remove trailing commas
            str = str.replace(/,\s*([\]}])/g, '$1');

            // Try parsing again after fixes
            try {
                return JSON.parse(str);
            } catch (e) {
                console.error('Failed to parse JSON even after attempting fixes:', e);
                return null;
            }
        }
    }
}