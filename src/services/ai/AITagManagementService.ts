import { App, TFile } from 'obsidian';
import { Tag } from '@type/metadata.types';
import { ServiceError } from '@services/core/ServiceError';

/**
 * Handles all tag-related operations including updates, validation, and vault integration
 */
export class TagManagementService {
    private readonly TAG_INDEX_PATH = 'Tag Index.md';

    constructor(private app: App) {}

    /**
     * Update tags in the vault
     */
    public async updateTags(tags: Tag[]): Promise<void> {
        try {
            this.validateTags(tags);
            let tagIndexFile = await this.getOrCreateTagIndex();
            await this.updateTagIndex(tagIndexFile, tags);
        } catch (error) {
            throw new ServiceError('Failed to update tags', (error as Error).message);
        }
    }

    /**
     * Get or create tag index file
     */
    private async getOrCreateTagIndex(): Promise<TFile> {
        let tagIndexFile = this.app.vault.getAbstractFileByPath(this.TAG_INDEX_PATH);
        
        if (!tagIndexFile) {
            tagIndexFile = await this.app.vault.create(this.TAG_INDEX_PATH, '');
        }

        if (!(tagIndexFile instanceof TFile)) {
            throw new Error('Tag index is not a file');
        }

        return tagIndexFile;
    }

    /**
     * Update tag index file with new tags
     */
    private async updateTagIndex(file: TFile, newTags: Tag[]): Promise<void> {
        const content = await this.app.vault.read(file);
        const existingTags = this.parseExistingTags(content);
        
        // Merge tags
        newTags.forEach(tag => existingTags.add(tag.name));
        
        // Format and save
        const newContent = this.formatTagContent(existingTags);
        await this.app.vault.modify(file, newContent);
    }

    /**
     * Parse existing tags from content
     */
    private parseExistingTags(content: string): Set<string> {
        const tagMatches = content.match(/#[\w-]+/g);
        return new Set(tagMatches?.map(tag => tag.substring(1)) || []);
    }

    /**
     * Format tags for content
     */
    private formatTagContent(tags: Set<string>): string {
        return Array.from(tags)
            .sort()
            .map(tagName => `#${tagName}`)
            .join('\n');
    }

    /**
     * Validate tags before update
     */
    private validateTags(tags: Tag[]): void {
        const invalidTags = tags.filter(tag => !this.isValidTagName(tag.name));
        if (invalidTags.length > 0) {
            throw new Error(`Invalid tag names: ${invalidTags.map(t => t.name).join(', ')}`);
        }
    }

    /**
     * Check if tag name is valid
     */
    private isValidTagName(name: string): boolean {
        return /^[\w-]+$/.test(name);
    }
}