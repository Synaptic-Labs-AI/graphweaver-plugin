// src/managers/DatabaseManager.ts

import { App, TFile } from 'obsidian';
import { DatabaseService } from '../services/DatabaseService';
import { ServiceError } from '../services/core/ServiceError';

/**
 * DatabaseManager is responsible for managing the DatabaseService,
 * including initializing, loading, and saving data.
 */
export class DatabaseManager {
    public app: App;
    public databaseService: DatabaseService;

    constructor(app: App) {
        this.app = app;
        this.databaseService = new DatabaseService(
            async () => {
                // Load callback: Read data from the file
                return await this.loadDatabaseData();
            },
            async (data: any) => {
                // Save callback: Write data to the file
                await this.saveDatabaseData(data);
            }
        );
    }

    /**
     * Initialize the DatabaseService by loading existing data
     */
    public async initialize(): Promise<void> {
        try {
            await this.databaseService.initializeInternal();
            console.log('DatabaseManager: Initialized successfully');
        } catch (error) {
            console.error('DatabaseManager: Failed to initialize DatabaseService', error);
            throw new ServiceError(
                'DatabaseManager',
                'Failed to initialize DatabaseService',
                error instanceof Error ? error : undefined
            );
        }
    }

    /**
     * Get the DatabaseService instance
     */
    public getDatabaseService(): DatabaseService {
        return this.databaseService;
    }

    /**
     * Save database data to the file
     * @param data Data to be saved
     */
    public async saveDatabaseData(data: any): Promise<void> {
        const dataStr = JSON.stringify(data, null, 2);
        const filePath = `${this.app.vault.configDir}/plugins/graphweaver-database.json`;
        try {
            await this.app.vault.adapter.write(filePath, dataStr);
        } catch (error) {
            console.error(`DatabaseManager: Error saving data to ${filePath}:`, error);
            throw new ServiceError(
                'DatabaseManager',
                `Error saving data to ${filePath}`,
                error instanceof Error ? error : undefined
            );
        }
    }

    /**
     * Load database data from the file
     */
    public async loadDatabaseData(): Promise<any> {
        const filePath = `${this.app.vault.configDir}/plugins/graphweaver-database.json`;
        try {
            if (await this.app.vault.adapter.exists(filePath)) {
                const data = await this.app.vault.adapter.read(filePath);
                return JSON.parse(data);
            } else {
                return null;
            }
        } catch (error) {
            console.error(`DatabaseManager: Error loading database data from ${filePath}:`, error);
            throw new ServiceError(
                'DatabaseManager',
                `Error loading database data from ${filePath}`,
                error instanceof Error ? error : undefined
            );
        }
    }

    /**
     * Destroy method to clean up resources
     */
    public async destroy(): Promise<void> {
        try {
            await this.databaseService.destroy();
        } catch (error) {
            console.error('DatabaseManager: Failed to destroy DatabaseService', error);
            throw new ServiceError(
                'DatabaseManager',
                'Failed to destroy DatabaseService',
                error instanceof Error ? error : undefined
            );
        }
    }
}
