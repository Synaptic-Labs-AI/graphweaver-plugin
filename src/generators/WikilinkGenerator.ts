// src/generators/WikilinkGenerator.ts

import { BaseGenerator, BaseGeneratorInput, BaseGeneratorOutput } from './BaseGenerator';
import { AIAdapter } from '../adapters/AIAdapter';
import { SettingsService } from '../services/SettingsService';

/**
 * Input interface for wikilink generation
 */
interface WikilinkInput extends BaseGeneratorInput {
    content: string;           
    existingPages: string[];   
}

/**
 * Output interface for wikilink generation
 */
export interface WikilinkOutput extends BaseGeneratorOutput {
    content: string;          
}

/**
 * Generator for managing wikilinks in markdown content.
 * Handles nested wikilinks, existing wikilinks, and various edge cases.
 */
export class WikilinkGenerator extends BaseGenerator<WikilinkInput, WikilinkOutput> {
    /**
     * Collection of regex patterns used throughout the generator
     */
    public readonly PATTERNS = {
        WIKILINK_REGEX: /\[\[([^\[\]]*(?:\[\[[^\[\]]*\]\][^\[\]]*)*)\]\]/g,
        SIMPLE_WIKILINK_REGEX: /\[\[([^\]]+)\]\]/g,
        MALFORMED_REGEX: /\[\[[^\]\[]*(?:\](?!\])|$)|(?:\[\[)+[^\]\[]*\]\]/g,
        CODE_BLOCK_REGEX: /`[^`]*`|```[\s\S]*?```/g,
        INLINE_CODE_REGEX: /`[^`]+`/g,
        SPECIAL_CHARS_REGEX: /[!@#$%^&*(),.?":{}|<>]/g
    };

    /**
     * Configuration constants for wikilink processing
     */
    public readonly CONFIG = {
        MAX_LINK_LENGTH: 100,
        MAX_NESTING_DEPTH: 5,
        CONTEXT_WINDOW_SIZE: 100,
        ALLOWED_SPECIAL_CHARS: ['\'', '-', '_', '&', '.']
    };

    constructor(aiAdapter: AIAdapter, settingsService: SettingsService) {
        super(aiAdapter, settingsService);
    }

    /**
     * Generate wikilinks for the provided content
     * @param input WikilinkInput containing content and context
     * @returns Promise<WikilinkOutput> with processed content
     */
    public async generate(input: WikilinkInput): Promise<WikilinkOutput> {
        if (!this.validateInput(input)) {
            throw new Error('Invalid input for wikilink generation');
        }

        const prompt = this.preparePrompt(input);
        const model = await this.getCurrentModel();
        const aiResponse = await this.aiAdapter.generateResponse(prompt, model);
        return this.formatOutput(aiResponse.data, input);
    }

    /**
     * Prepares the AI prompt for generating wikilink suggestions
     */
    protected preparePrompt(input: WikilinkInput): string {
        const settings = this.getSettings();
        const customTags = settings.tags.customTags
            .map((tag: { name: string }) => tag.name)
            .join(', ') || '';

        return `
# MISSION
Act as an expert in recommending wikilinks for potential future research notes related to the current CONTENT for an Obsidian Vault.

# INSTRUCTIONS
1. Analyze the CONTENT of the note and the EXISTING NOTES in the vault.
2. Suggest key phrases, proper nouns, people, places, events, and concepts that would make for a relevant and practical note.
3. Consider the existing pages in the vault and prioritize linking to them. 
4. Ignore all tags and front matter when generating.

# CONTENT
${input.content}

# EXISTING NOTES
${input.existingPages.join(', ')}

Provide your suggestions as a JSON array of strings, omitting all characters before or after, including backticks.
        `;
    }

    /**
     * Format the AI response into wikilink output
     */
    protected formatOutput(aiResponse: any, originalInput: WikilinkInput): WikilinkOutput {

        const suggestedLinks = this.parseSuggestedLinks(aiResponse);

        let processedContent = originalInput.content;
        
        processedContent = this.addNewWikilinks(processedContent, suggestedLinks);
        processedContent = this.cleanNestedWikilinks(processedContent);

        return { content: processedContent };
    }

    /**
     * Adds new wikilinks while preserving existing ones and handling edge cases
     */
    public addNewWikilinks(content: string, suggestedLinks: string[]): string {
        const codeBlocks = new Map<string, string>();
        let processedContent = this.protectCodeBlocks(content, codeBlocks);
    
        const existingWikilinks = this.extractExistingWikilinks(processedContent);
        const existingWikilinksWithBrackets = new Set(
            Array.from(processedContent.matchAll(this.PATTERNS.SIMPLE_WIKILINK_REGEX))
                .map(match => match[0])
        );
    
        suggestedLinks
            .filter(link => this.isValidWikilinkText(link))
            .sort((a, b) => b.length - a.length)
            .forEach(phrase => {
                if (!existingWikilinks.includes(phrase.toLowerCase())) {
                    const regex = new RegExp(`\\b${this.escapeRegExp(phrase)}\\b`, 'gi');
                    processedContent = processedContent.replace(regex, (match, offset) => {
                        if (this.isWithinExistingWikilink(processedContent, offset, match.length, existingWikilinksWithBrackets) || 
                            this.isWithinProtectedContext(processedContent, offset)) {
                            return match;
                        }
                        return `[[${this.normalizeWikilinkText(match)}]]`;
                    });
                }
            });

        return this.restoreCodeBlocks(processedContent, codeBlocks);
    }    

    /**
     * Cleans up nested wikilinks while preserving valid structure
     */
    public cleanNestedWikilinks(content: string): string {

        const processedWikilinks = new Set<string>();
        let result = content;

        const matches = Array.from(content.matchAll(this.PATTERNS.WIKILINK_REGEX))
            .map(match => ({
                full: match[0],
                inner: match[1],
                index: match.index!,
                length: match[0].length,
                depth: this.calculateNestingDepth(match[0])
            }))
            .filter(match => match.depth <= this.CONFIG.MAX_NESTING_DEPTH)
            .sort((a, b) => b.length - a.length);

        const processedPositions = new Set<number>();

        for (const match of matches) {
            if (processedPositions.has(match.index)) continue;

            if (match.inner.includes('[[')) {
                const cleanedText = this.removeNestedDuplicates(match.inner);
                
                if (this.isValidWikilinkText(cleanedText) && 
                    !processedWikilinks.has(cleanedText.toLowerCase())) {
                    processedWikilinks.add(cleanedText.toLowerCase());
                    result = this.safeReplace(
                        result,
                        match.index,
                        match.length,
                        `[[${this.normalizeWikilinkText(cleanedText)}]]`
                    );
                    processedPositions.add(match.index);
                }
            } else {
                processedWikilinks.add(match.inner.toLowerCase());
            }
        }

        console.log('WikilinkGenerator: Nested wikilinks cleaned');

        return result;
    }

    /**
     * Extracts existing wikilinks from content
     */
    public extractExistingWikilinks(content: string): string[] {
        const matches = content.match(this.PATTERNS.SIMPLE_WIKILINK_REGEX) || [];
        return matches.map(match => match.slice(2, -2).toLowerCase());
    }

    /**
     * Removes nested duplicates while preserving outer structure
     */
    public removeNestedDuplicates(text: string): string {
        return text.replace(/\[\[([^\[\]]+)\]\]/g, '$1');
    }

    /**
     * Validates if text is suitable for a wikilink
     */
    public isValidWikilinkText(text: string): boolean {
        if (!text || typeof text !== 'string') return false;
        
        const trimmed = text.trim();
        if (trimmed.length === 0 || trimmed.length > this.CONFIG.MAX_LINK_LENGTH) return false;
        
        const bracketCount = (trimmed.match(/[\[\]]/g) || []).length;
        if (bracketCount % 2 !== 0) return false;

        return !trimmed.match(this.PATTERNS.MALFORMED_REGEX);
    }

    /**
     * Normalizes text for wikilink usage with title case capitalization
     * @param text - The text to be normalized
     * @returns Normalized text with title case capitalization
     */
    public normalizeWikilinkText(text: string): string {
        // Store original text and normalize spaces
        const trimmed = text.trim();
        let normalized = trimmed.replace(/\s+/g, ' ');
        
        // Remove special characters except allowed ones
        normalized = normalized.replace(this.PATTERNS.SPECIAL_CHARS_REGEX, 
            char => this.CONFIG.ALLOWED_SPECIAL_CHARS.includes(char) ? char : '');
        
        // Apply title case
        return this.toTitleCase(normalized);
    }

    /**
     * Converts a string to title case, capitalizing the first letter of each significant word
     */
    private toTitleCase(text: string): string {
        // List of words to keep lowercase unless they're the first word
        const minorWords = new Set([
            'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 
            'as', 'at', 'by', 'for', 'from', 'in', 'into', 'near', 
            'of', 'on', 'onto', 'to', 'with'
        ]);

        return text.split(' ').map((word, index) => {
            // Always capitalize first and last words
            if (index === 0 || word.length > 3 || !minorWords.has(word.toLowerCase())) {
                return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
            }
            return word.toLowerCase();
        }).join(' ');
    }

    /**
     * Checks if a position is within an existing wikilink
     */
    public isWithinExistingWikilink(
        content: string,
        offset: number,
        length: number,
        existingWikilinks: Set<string>
    ): boolean {
        const contextStart = Math.max(0, offset - this.CONFIG.CONTEXT_WINDOW_SIZE);
        const contextEnd = Math.min(
            content.length,
            offset + length + this.CONFIG.CONTEXT_WINDOW_SIZE
        );
        const context = content.slice(contextStart, contextEnd);
        
        return Array.from(existingWikilinks).some(wikilink => {
            const wikiLinkIndex = context.indexOf(wikilink);
            if (wikiLinkIndex === -1) return false;
            
            const absoluteWikiLinkStart = contextStart + wikiLinkIndex;
            const absoluteWikiLinkEnd = absoluteWikiLinkStart + wikilink.length;
            
            return offset >= absoluteWikiLinkStart && 
                   (offset + length) <= absoluteWikiLinkEnd;
        });
    }

    /**
     * Protects code blocks from processing
     */
    public protectCodeBlocks(content: string, codeBlocks: Map<string, string>): string {
        let processedContent = content;
        let counter = 0;

        processedContent = processedContent.replace(
            this.PATTERNS.CODE_BLOCK_REGEX,
            (match) => {
                const placeholder = `__CODE_BLOCK_${counter}__`;
                codeBlocks.set(placeholder, match);
                counter++;
                return placeholder;
            }
        );

        processedContent = processedContent.replace(
            this.PATTERNS.INLINE_CODE_REGEX,
            (match) => {
                const placeholder = `__INLINE_CODE_${counter}__`;
                codeBlocks.set(placeholder, match);
                counter++;
                return placeholder;
            }
        );

        return processedContent;
    }

    /**
     * Restores protected code blocks
     */
    public restoreCodeBlocks(content: string, codeBlocks: Map<string, string>): string {
        let processedContent = content;
        for (const [placeholder, original] of codeBlocks.entries()) {
            processedContent = processedContent.replace(placeholder, original);
        }
        return processedContent;
    }

    /**
     * Checks if a position is within a protected context
     */
    public isWithinProtectedContext(content: string, offset: number): boolean {
        const codeMatches = Array.from(content.matchAll(this.PATTERNS.CODE_BLOCK_REGEX));
        for (const match of codeMatches) {
            if (match.index !== undefined && 
                offset >= match.index && 
                offset < match.index + match[0].length) {
                return true;
            }
        }

        const inlineMatches = Array.from(content.matchAll(this.PATTERNS.INLINE_CODE_REGEX));
        for (const match of inlineMatches) {
            if (match.index !== undefined && 
                offset >= match.index && 
                offset < match.index + match[0].length) {
                return true;
            }
        }

        return false;
    }

    /**
     * Calculates the nesting depth of a wikilink
     */
    public calculateNestingDepth(text: string): number {
        let maxDepth = 0;
        let currentDepth = 0;
        
        for (let i = 0; i < text.length - 1; i++) {
            if (text[i] === '[' && text[i + 1] === '[') {
                currentDepth++;
                maxDepth = Math.max(maxDepth, currentDepth);
                i++;
            } else if (text[i] === ']' && text[i + 1] === ']') {
                currentDepth--;
                i++;
            }
        }
        
        return maxDepth;
    }

    /**
     * Safely replaces text at a specific position
     */
    public safeReplace(text: string, start: number, length: number, replacement: string): string {
        return text.slice(0, start) + replacement + text.slice(start + length);
    }

    /**
     * Parses suggested links from AI response
     */
    public parseSuggestedLinks(aiResponse: unknown): string[] {
        if (typeof aiResponse === 'string') {
            try {
                aiResponse = JSON.parse(aiResponse);
            } catch (error) {
                console.error('WikilinkGenerator: Failed to parse AI response as JSON:', error);
                return [];
            }
        }
    
        if (Array.isArray(aiResponse)) {
            return aiResponse.filter((item): item is string => typeof item === 'string');
        }
    
        if (typeof aiResponse === 'object' && aiResponse !== null) {
            const arrayValues = Object.values(aiResponse).find(Array.isArray);
            if (arrayValues) {
                return arrayValues.filter((item): item is string => typeof item === 'string');
            }
        }
    
        console.error('WikilinkGenerator: Unexpected AI response format:', aiResponse);
        return [];
    }

    /**
     * Escapes special regex characters in a string
     */
    public escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
