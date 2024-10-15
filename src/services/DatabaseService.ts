import { TFile } from 'obsidian';

export interface ProcessedFile {
    path: string;
    lastProcessed: number;
}

export class DatabaseService {
    public processedFiles: ProcessedFile[];

    constructor() {
        this.processedFiles = [];
    }

    public async load(loadData: () => Promise<any>): Promise<void> {
        const data = await loadData();
        this.processedFiles = data?.processedFiles || [];
    }

    public async save(saveData: (data: any) => Promise<void>): Promise<void> {
        await saveData({ processedFiles: this.processedFiles });
    }

    public markFileAsProcessed(file: TFile): void {
        const existingIndex = this.processedFiles.findIndex(f => f.path === file.path);
        if (existingIndex !== -1) {
            this.processedFiles[existingIndex].lastProcessed = Date.now();
        } else {
            this.processedFiles.push({ path: file.path, lastProcessed: Date.now() });
        }
    }

    public isFileProcessed(file: TFile): boolean {
        return this.processedFiles.some(f => f.path === file.path);
    }

    public getUnprocessedFiles(allFiles: TFile[]): TFile[] {
        return allFiles.filter(file => !this.isFileProcessed(file));
    }
}