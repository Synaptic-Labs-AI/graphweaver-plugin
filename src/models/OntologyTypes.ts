// src/models/OntologyTypes.ts
import { TFile, TFolder } from 'obsidian';
import { AIProvider } from './AIModels';
import { Tag } from './PropertyTag'; // Ensure Tag is imported

export interface OntologyInput {
    files: TFile[];
    folders: TFolder[];
    tags: string[];
    provider: AIProvider;
    modelApiName: string;
    userContext: string;
}

export interface OntologyResult {
    suggestedTags: Tag[];
}
