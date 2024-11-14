// src/generators/utils/WikilinkPatterns.ts

/**
 * Type for special characters allowed in wikilinks
 */
type AllowedSpecialChar = "'" | "-" | "_" | "&" | ".";

/**
 * Collection of regex patterns used for wikilink processing
 */
export const WikilinkPatterns = {
    WIKILINK_REGEX: /\[\[([^\[\]]*(?:\[\[[^\[\]]*\]\][^\[\]]*)*)\]\]/g,
    SIMPLE_WIKILINK_REGEX: /\[\[([^\]]+)\]\]/g,
    MALFORMED_REGEX: /\[\[[^\]\[]*(?:\](?!\])|$)|(?:\[\[)+[^\]\[]*\]\]/g,
    CODE_BLOCK_REGEX: /`[^`]*`|```[\s\S]*?```/g,
    INLINE_CODE_REGEX: /`[^`]+`/g,
    SPECIAL_CHARS_REGEX: /[!@#$%^&*(),.?":{}|<>]/g
} as const;

/**
 * Configuration constants for wikilink processing
 */
export const WikilinkConfig = {
    MAX_LINK_LENGTH: 100,
    MAX_NESTING_DEPTH: 5,
    CONTEXT_WINDOW_SIZE: 100,
    ALLOWED_SPECIAL_CHARS: ["'", "-", "_", "&", "."] as Array<AllowedSpecialChar>
} as const;

/**
 * Function to check if a character is an allowed special character
 */
export function isAllowedSpecialChar(char: string): char is AllowedSpecialChar {
    return WikilinkConfig.ALLOWED_SPECIAL_CHARS.includes(char as AllowedSpecialChar);
}

/**
 * Utility functions for wikilink text manipulation
 */
export class WikilinkUtils {
    /**
     * Escapes special regex characters in a string
     */
    public static escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Calculates the nesting depth of a wikilink
     */
    public static calculateNestingDepth(text: string): number {
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
}