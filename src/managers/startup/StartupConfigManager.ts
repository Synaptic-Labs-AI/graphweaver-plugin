/**
 * Configuration interface for startup generation
 */
export interface StartupGenerateConfig {
    minContentLength: number;
    startupDelay: number;
    batchSize: number;
    retryAttempts: number;
    retryDelay: number;
    debug?: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: StartupGenerateConfig = {
    minContentLength: 10,
    startupDelay: 1000,
    batchSize: 10,
    retryAttempts: 3,
    retryDelay: 1000,
    debug: false
};

/**
 * Manages startup configuration
 */
export class StartupConfigManager {
    private config: StartupGenerateConfig;
    private isUnloading: boolean = false;

    constructor(config: Partial<StartupGenerateConfig> = {}) {
        this.config = {
            ...DEFAULT_CONFIG,
            ...config
        };
    }

    /**
     * Get current config
     */
    public getConfig(): Readonly<StartupGenerateConfig> {
        return { ...this.config };
    }

    /**
     * Update config
     */
    public updateConfig(updates: Partial<StartupGenerateConfig>): void {
        if (this.isUnloading) return;

        this.config = {
            ...this.config,
            ...updates
        };
    }

    /**
     * Debug log if enabled
     */
    public debugLog(message: string): void {
        if (this.config.debug) {
        }
    }

    /**
     * Reset to defaults
     */
    public reset(): void {
        this.config = { ...DEFAULT_CONFIG };
    }

    /**
     * Clean up
     */
    public destroy(): void {
        this.isUnloading = true;
    }
}