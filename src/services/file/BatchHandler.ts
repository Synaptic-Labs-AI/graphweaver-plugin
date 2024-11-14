// src/services/file/BatchHandler.ts

import { TFile } from 'obsidian';
import { ProcessingOptions } from '../../types/ProcessingTypes';
import { retry } from 'src/state/utils/retry';

export class BatchHandler {
    constructor(
        private readonly processFile: (file: TFile) => Promise<any>, // Changed from Promise<void>
        private readonly options: ProcessingOptions,
        private readonly maxRetries: number,
        private readonly retryDelay: number
    ) {}

    createBatches(files: TFile[]): TFile[][] {
        const batches: TFile[][] = [];
        const batchSize = this.options.chunkSize;

        for (let i = 0; i < files.length; i += batchSize) {
            batches.push(files.slice(i, i + batchSize));
        }

        return batches;
    }

    async processBatches(batches: TFile[][]): Promise<void> {
        for (const batch of batches) {
            await Promise.all(
                batch.map(file => 
                    retry(() => this.processFile(file), this.maxRetries, this.retryDelay)
                )
            );
            if (this.options.delayBetweenChunks > 0) {
                await delay(this.options.delayBetweenChunks);
            }
        }
    }
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
