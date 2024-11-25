import { App } from 'obsidian';
import type GraphWeaverPlugin from 'main';
import { Tag, TagManagerState, ITagManagementService } from '@type/metadata.types';

export class TagManagementService implements ITagManagementService {
    public readonly metadataPath: string; // Ensure it's public as per interface
    public readonly plugin: GraphWeaverPlugin;

    private isInitialized = false;

    constructor(private readonly app: App, plugin: GraphWeaverPlugin) {
        this.plugin = plugin;
        this.metadataPath = `${this.plugin.manifest.dir}/tag-metadata.json`;
    }

    async initialize(): Promise<void> {
        try {
            await this.ensureMetadataFile();
            this.isInitialized = true;
        } catch (error) {
            console.error('🦇 Failed to initialize tag service:', error);
            // Create empty metadata file if it doesn't exist
            await this.saveMetadata({ tags: [], customTags: [] });
        }
    }

    public async ensureMetadataFile(): Promise<void> { // Changed from private to public
        try {
            const adapter = this.plugin.app.vault.adapter;
            const exists = await adapter.exists(this.metadataPath);
            
            if (!exists) {
                await this.saveMetadata({ tags: [], customTags: [] });
            }
        } catch (error) {
            console.error('🦇 Error checking metadata file:', error);
            throw new Error('Failed to initialize tag service');
        }
    }

    isReady(): boolean {
        return this.isInitialized;
    }

    async updateTags(tags: Tag[]): Promise<void> {
        const currentData = await this.loadMetadata();
        currentData.tags = tags;
        await this.saveMetadata(currentData);
    }

    async getTags(): Promise<Tag[]> {
        const metadata = await this.loadMetadata();
        return metadata.tags;
    }

    private async saveMetadata(data: TagManagerState): Promise<void> {
        try {
            const adapter = this.app.vault.adapter;
            const dataString = JSON.stringify(data, null, 2);
            await adapter.write(this.metadataPath, dataString);
        } catch (error) {
            console.error('🦇 Failed to save metadata:', error);
            throw new Error('Failed to save metadata');
        }
    }

    private async loadMetadata(): Promise<TagManagerState> {
        try {
            const adapter = this.app.vault.adapter;
            const dataString = await adapter.read(this.metadataPath);
            return JSON.parse(dataString) as TagManagerState;
        } catch (error) {
            console.error('🦇 Failed to load metadata:', error);
            throw new Error('Failed to load metadata');
        }
    }
}