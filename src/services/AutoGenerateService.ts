import { TFile, Vault } from 'obsidian';
import { AIService } from './AIService';
import { SettingsService } from './SettingsService';
import { DatabaseService } from './DatabaseService';

export class AutoGenerateService {
    public vault: Vault;
    public aiService: AIService;
    public settingsService: SettingsService;
    public databaseService: DatabaseService;

    constructor(vault: Vault, aiService: AIService, settingsService: SettingsService, databaseService: DatabaseService) {
        this.vault = vault;
        this.aiService = aiService;
        this.settingsService = settingsService;
        this.databaseService = databaseService;
    }

    public async runAutoGenerate(): Promise<void> {
        console.log('AutoGenerateService: Starting auto-generate process');
        const settings = this.settingsService.getSettings();
        if (!settings.frontMatter.autoGenerate) {
            console.log('AutoGenerateService: Auto-generate is disabled');
            return;
        }

        const allFiles = this.vault.getMarkdownFiles();
        const unprocessedFiles = this.databaseService.getUnprocessedFiles(allFiles);

        for (const file of unprocessedFiles) {
            if (await this.needsFrontMatter(file)) {
                await this.generateFrontMatter(file);
                this.databaseService.markFileAsProcessed(file);
            }
        }

        console.log('AutoGenerateService: Auto-generate process completed');
    }

    public async needsFrontMatter(file: TFile): Promise<boolean> {
        const content = await this.vault.read(file);
        return !content.startsWith('---\n');
    }

    public async generateFrontMatter(file: TFile): Promise<void> {
        console.log(`AutoGenerateService: Generating front matter for ${file.path}`);
        const content = await this.vault.read(file);
        const frontMatter = await this.aiService.generateFrontMatter(content);
        const updatedContent = this.addOrUpdateFrontMatter(content, frontMatter);
        await this.vault.modify(file, updatedContent);
    }

    public addOrUpdateFrontMatter(content: string, newFrontMatter: string): string {
        if (content.startsWith('---\n')) {
            return content.replace(/^---\n[\s\S]*?\n---\n/, newFrontMatter);
        } else {
            return `${newFrontMatter}\n\n${content}`;
        }
    }
}