// src/services/WikilinkTextProcessor.ts

import { CoreService } from './core/CoreService';
import { WikilinkPatterns, WikilinkConfig, WikilinkUtils, isAllowedSpecialChar } from 'src/generators/utils/WikilinkPatterns';

/**
 * Service for processing and validating wikilink text
 */
export class WikilinkTextProcessor extends CoreService {
    constructor() {
        super('wikilink-processor', 'Wikilink Text Processor');
    }

    protected async initializeInternal(): Promise<void> {
        // No initialization required
    }

    protected async destroyInternal(): Promise<void> {
        // No cleanup required
    }

    /**
     * Add wikilinks to the content based on suggested links
     */
    public addWikilinks(
        content: string,
        suggestedLinks: string[],
        existingWikilinks: Set<string>
    ): string {
        // First protect code blocks
        const codeBlocks = new Map<string, string>();
        let processedContent = this.protectCodeBlocks(content, codeBlocks);
        
        // Sort links by length (longest first) to handle nested phrases properly
        suggestedLinks
            .filter(link => this.isValidWikilinkText(link))
            .sort((a, b) => b.length - a.length)
            .forEach(phrase => {
                const normalizedLink = this.normalizeWikilinkText(phrase);
                if (!existingWikilinks.has(normalizedLink.toLowerCase())) {
                    // Create a regex that:
                    // 1. Uses positive lookbehind to ensure we're not inside a wikilink
                    // 2. Uses word boundaries properly
                    // 3. Handles case sensitivity appropriately
                    const escapedPhrase = WikilinkUtils.escapeRegExp(phrase);
                    const regex = new RegExp(
                        `(?<!\\[\\[.*?)\\b${escapedPhrase}\\b(?![^\\[]*\\]\\])`,
                        'gi'
                    );

                    processedContent = processedContent.replace(regex, (match, offset) => {
                        // Check if we should skip this replacement
                        if (this.shouldSkipWikilink(processedContent, offset, match.length, existingWikilinks)) {
                            return match;
                        }

                        // Create the wikilink, preserving original case
                        return `[[${normalizedLink}]]`;
                    });
                }
            });

        // Restore code blocks and return
        const finalContent = this.restoreCodeBlocks(processedContent, codeBlocks);
        return finalContent;
    }
    
    /**
     * Clean nested wikilinks while preserving structure
     */
    public cleanNestedWikilinks(content: string): string {
        const processedLinks = new Set<string>();
        let result = content;

        const matches = Array.from(content.matchAll(WikilinkPatterns.WIKILINK_REGEX))
            .map(match => ({
                full: match[0],
                inner: match[1],
                index: match.index!,
                length: match[0].length,
                depth: WikilinkUtils.calculateNestingDepth(match[0])
            }))
            .filter(match => match.depth <= WikilinkConfig.MAX_NESTING_DEPTH)
            .sort((a, b) => b.length - a.length);

        const processedPositions = new Set<number>();

        for (const match of matches) {
            if (processedPositions.has(match.index)) continue;

            if (match.inner.includes('[[')) {
                const cleaned = this.removeNestedDuplicates(match.inner);
                
                if (this.isValidWikilinkText(cleaned) && 
                    !processedLinks.has(cleaned.toLowerCase())) {
                    processedLinks.add(cleaned.toLowerCase());
                    result = this.safeReplace(
                        result,
                        match.index,
                        match.length,
                        `[[${this.normalizeWikilinkText(cleaned)}]]`
                    );
                    processedPositions.add(match.index);
                }
            } else {
                processedLinks.add(match.inner.toLowerCase());
            }
        }
        
        return result;
    }

    /**
     * Normalize text for wikilink usage
     */
    public normalizeWikilinkText(text: string): string {
        const original = text.trim();
        
        // Replace multiple spaces with single space
        let normalized = original.replace(/\s+/g, ' ');
        
        // Handle special characters while preserving allowed ones
        normalized = normalized.replace(
            WikilinkPatterns.SPECIAL_CHARS_REGEX,
            char => isAllowedSpecialChar(char) ? char : ' '
        ).trim();
        
        // Return original text if the normalized version is the same (ignoring case)
        // This preserves original casing when possible
        return normalized.toLowerCase() === original.toLowerCase() ? original : normalized;
    }

    /**
     * Protected and utility methods
     */
    private protectCodeBlocks(content: string, codeBlocks: Map<string, string>): string {
        let processed = content;
        let counter = 0;

        const replaceWithPlaceholder = (match: string, type: string) => {
            const placeholder = `__${type}_${counter}__`;
            codeBlocks.set(placeholder, match);
            counter++;
            return placeholder;
        };

        processed = processed.replace(
            WikilinkPatterns.CODE_BLOCK_REGEX,
            match => replaceWithPlaceholder(match, 'CODE_BLOCK')
        );

        processed = processed.replace(
            WikilinkPatterns.INLINE_CODE_REGEX,
            match => replaceWithPlaceholder(match, 'INLINE_CODE')
        );

        return processed;
    }

    private restoreCodeBlocks(content: string, codeBlocks: Map<string, string>): string {
        let processed = content;
        for (const [placeholder, original] of codeBlocks.entries()) {
            processed = processed.replace(placeholder, original);
        }
        return processed;
    }

    private isWithinExistingWikilink(
        content: string,
        offset: number,
        length: number,
        existingWikilinks: Set<string>
    ): boolean {
        const contextStart = Math.max(0, offset - WikilinkConfig.CONTEXT_WINDOW_SIZE);
        const contextEnd = Math.min(
            content.length,
            offset + length + WikilinkConfig.CONTEXT_WINDOW_SIZE
        );
        const context = content.slice(contextStart, contextEnd);
        
        // Check if within any existing wikilink
        let bracketCount = 0;
        for (let i = 0; i < offset - contextStart; i++) {
            if (context[i] === '[' && context[i + 1] === '[') {
                bracketCount++;
                i++;
            } else if (context[i] === ']' && context[i + 1] === ']') {
                bracketCount--;
                i++;
            }
        }
        
        // If bracketCount > 0, we're inside a wikilink
        if (bracketCount > 0) return true;
    
        // Check against existing wikilinks
        return Array.from(existingWikilinks).some(wikilink => {
            const index = context.indexOf(wikilink);
            if (index === -1) return false;
            
            const absStart = contextStart + index;
            const absEnd = absStart + wikilink.length;
            
            return offset >= absStart && (offset + length) <= absEnd;
        });
    }

    private isWithinProtectedContext(content: string, offset: number): boolean {
        return [WikilinkPatterns.CODE_BLOCK_REGEX, WikilinkPatterns.INLINE_CODE_REGEX]
            .some(regex => {
                const matches = Array.from(content.matchAll(regex));
                return matches.some(match => 
                    match.index !== undefined && 
                    offset >= match.index && 
                    offset < match.index + match[0].length
                );
            });
    }

    public extractExistingWikilinks(content: string): string[] {
        const matches = content.match(WikilinkPatterns.SIMPLE_WIKILINK_REGEX) || [];
        return matches.map(match => match.slice(2, -2).toLowerCase());
    }

    private removeNestedDuplicates(text: string): string {
        return text.replace(/\[\[([^\[\]]+)\]\]/g, '$1');
    }

    private safeReplace(text: string, start: number, length: number, replacement: string): string {
        return text.slice(0, start) + replacement + text.slice(start + length);
    }

    /**
     * Determine if the wikilink should be skipped based on context
     */
    private shouldSkipWikilink(
        content: string,
        offset: number,
        length: number,
        existingWikilinks: Set<string>
    ): boolean {
        // Check if within existing wikilink
        if (this.isWithinExistingWikilink(content, offset, length, existingWikilinks)) {
            return true;
        }

        // Check if within protected context (code blocks, etc.)
        if (this.isWithinProtectedContext(content, offset)) {
            return true;
        }

        // Get surrounding context
        const contextStart = Math.max(0, offset - 4);
        const contextEnd = Math.min(content.length, offset + length + 4);
        const context = content.slice(contextStart, contextEnd);

        // Check if already part of a wikilink syntax
        if (context.match(/\[\[.*?\]\]/)) {
            return true;
        }

        return false;
    }

    /**
     * Validate wikilink text
     */
    public isValidWikilinkText(text: string): boolean {
        if (!text || typeof text !== 'string') return false;
        
        const trimmed = text.trim();
        if (trimmed.length === 0 || trimmed.length > WikilinkConfig.MAX_LINK_LENGTH) {
            return false;
        }
        
        // Check for balanced brackets
        const bracketCount = (trimmed.match(/[\[\]]/g) || []).length;
        if (bracketCount % 2 !== 0) return false;
    
        // Check for malformed patterns
        if (trimmed.match(WikilinkPatterns.MALFORMED_REGEX)) return false;
    
        // Allow more characters in wikilinks while still being restrictive
        const validCharPattern = /^[a-zA-Z0-9\s\-_'&.]+$/;
        return validCharPattern.test(trimmed);
    }
}
