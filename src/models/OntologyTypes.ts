// src/models/OntologyTypes.ts
import { TFile, TFolder } from 'obsidian';
import { AIProvider } from './AIModels';

export interface OntologyInput {
    files: TFile[];
    folders: TFolder[];
    tags: string[];
    provider: AIProvider;
    modelApiName: string;
    userContext: string;
}