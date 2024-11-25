import { CoreService } from '@services/core/CoreService';
import { ServiceError } from '@services/core/ServiceError';
import { IConfigurableService } from '@services/core/IService';
import type { ValidationResult } from '@type/base.types';

/**
 * Configuration options for JSON validation
 */
export interface JsonValidationConfig {
    notifyOnError?: boolean;
    strictMode?: boolean;
    maxDepth?: number;
    allowComments?: boolean;
    fixMalformed?: boolean;
    debug?: boolean;
}

/**
 * Enhanced JSON validation service with improved error handling and configuration
 */
export class JsonValidationService extends CoreService implements IConfigurableService<JsonValidationConfig> {
    private config: Required<JsonValidationConfig>;
    
    constructor(config: Partial<JsonValidationConfig> = {}) {
        super('json-validation', 'JSON Validation Service');
        
        // Initialize config with defaults
        this.config = {
            notifyOnError: true,
            strictMode: false,
            maxDepth: 100,
            allowComments: false,
            fixMalformed: true,
            debug: false,
            ...config
        };
    }

    /**
     * Initialize validation service
     */
    protected async initializeInternal(): Promise<void> {
        if (this.config.debug) {
        }
    }

    /**
     * Clean up resources
     */
    protected async destroyInternal(): Promise<void> {
        // Currently no resources to clean up
        if (this.config.debug) {
        }
    }

    /**
     * Configure validation options
     */
    public async configure(config: Partial<JsonValidationConfig>): Promise<void> {
        this.config = {
            ...this.config,
            ...config
        };
    }

    /**
     * Validate JSON data with type safety
     */
    public validate<T = any>(data: unknown): ValidationResult<T> {
        try {
            // Check if it's already a valid object
            if (this.isValidJsonObject(data)) {
                return {
                    valid: true,
                    value: data as T
                };
            }
            
            // If it's a string, try to parse it
            if (typeof data === 'string') {
                const parsed = JSON.parse(data);
                if (this.isValidJsonObject(parsed)) {
                    return {
                        valid: true,
                        value: parsed as T
                    };
                }
            }
            
            throw new Error('Invalid JSON data type');
        } catch (error) {
            const serviceError = new ServiceError(
                this.serviceName,
                'JSON validation failed',
                error instanceof Error ? error : undefined
            );

            if (this.config.debug) {
                console.error(serviceError.getDetails());
            }

            return {
                valid: false,
                error: serviceError.message
            };
        }
    }

    /**
     * Clean and validate JSON string with enhanced error handling
     */
    public validateAndCleanJson<T = any>(jsonString: string): ValidationResult<T> {
        try {
            const cleaned = this.cleanJsonString(jsonString);
            const fixes: string[] = [];

            // Try to parse the cleaned string
            try {
                const parsed = JSON.parse(cleaned);
                return {
                    valid: true,
                    value: parsed as T,
                    fixes: fixes.length > 0 ? fixes : undefined
                };
            } catch (parseError) {
                // If fixMalformed is enabled, try to fix and parse
                if (this.config.fixMalformed) {
                    const fixResult = this.fixAndParseJson<T>(cleaned);
                    if (fixResult.valid) {
                        return fixResult;
                    }
                }

                throw parseError;
            }
        } catch (error) {
            const serviceError = new ServiceError(
                this.serviceName,
                'JSON validation and cleaning failed',
                error instanceof Error ? error : undefined
            );

            if (this.config.debug) {
                console.error(serviceError.getDetails());
            }

            if (this.config.notifyOnError) {
            }

            return {
                valid: false,
                error: serviceError.message
            };
        }
    }

    /**
     * Fix and parse potentially malformed JSON
     */
    public fixAndParseJson<T = any>(str: string): ValidationResult<T> {
        const fixes: string[] = [];

        try {
            // First try regular parsing
            return {
                valid: true,
                value: JSON.parse(str) as T
            };
        } catch (initialError) {
            if (this.config.debug) {
            }

            try {
                let fixed = str;

                // Fix unquoted keys
                const unquotedKeysFix = fixed.replace(/(\w+)(?=\s*:)/g, '"$1"');
                if (unquotedKeysFix !== fixed) {
                    fixes.push('Added quotes to keys');
                    fixed = unquotedKeysFix;
                }

                // Fix single quotes to double quotes
                const singleQuotesFix = fixed.replace(/'/g, '"');
                if (singleQuotesFix !== fixed) {
                    fixes.push('Converted single quotes to double quotes');
                    fixed = singleQuotesFix;
                }

                // Remove trailing commas
                const trailingCommasFix = fixed.replace(/,\s*([\]}])/g, '$1');
                if (trailingCommasFix !== fixed) {
                    fixes.push('Removed trailing commas');
                    fixed = trailingCommasFix;
                }

                const fixedJson = JSON.parse(fixed) as T;

                return {
                    valid: true,
                    value: fixedJson,
                    fixes
                };
            } catch (fixError) {
                const serviceError = new ServiceError(
                    this.serviceName,
                    'Failed to fix malformed JSON',
                    {
                        originalError: fixError instanceof Error ? fixError : undefined,
                        context: { original: str }
                    }
                );

                if (this.config.debug) {
                    console.error(serviceError.getDetails());
                }

                return {
                    valid: false,
                    error: serviceError.message,
                    fixes
                };
            }
        }
    }

    /**
     * Clean JSON string by removing whitespace and markdown
     */
    private cleanJsonString(str: string): string {
        let cleaned = str.trim();

        // Remove markdown code blocks
        cleaned = cleaned.replace(/^```json?\s*|\s*```$/g, '');

        // Remove comments if not allowed
        if (!this.config.allowComments) {
            cleaned = cleaned
                .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
                .replace(/\/\/.*/g, ''); // Remove single-line comments
        }

        return cleaned;
    }

    /**
     * Check if value is a valid JSON object
     */
    private isValidJsonObject(value: unknown): boolean {
        return (
            typeof value === 'object' &&
            value !== null &&
            !Array.isArray(value)
        );
    }

    /**
     * Validate object against max depth constraint
     */
    private validateDepth(obj: any, currentDepth: number = 0): boolean {
        if (currentDepth > this.config.maxDepth) {
            return false;
        }

        if (typeof obj !== 'object' || obj === null) {
            return true;
        }

        for (const value of Object.values(obj)) {
            if (!this.validateDepth(value, currentDepth + 1)) {
                return false;
            }
        }

        return true;
    }
}