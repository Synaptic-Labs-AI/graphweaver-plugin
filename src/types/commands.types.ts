/**
 * @file commands.types.ts
 * @description Type definitions for command management
 */

import type { Command } from 'obsidian';

/**
 * Base command interface extending Obsidian's Command
 */
export interface PluginCommand extends Command {
    id: string;
    name: string;
    checkCallback?: (checking: boolean) => boolean | void;
}

/**
 * Command execution context
 */
export interface CommandContext {
    readonly source: 'ribbon' | 'command-palette' | 'hotkey' | 'menu';
    readonly timestamp: number;
    readonly data?: unknown;
}

/**
 * Command execution result
 */
export interface CommandResult {
    success: boolean;
    error?: Error;
    duration?: number;
}

/**
 * Command event map
 */
export interface CommandEvents {
    commandExecuted: (id: string, result: CommandResult, context: CommandContext) => void;
    commandRegistered: (command: PluginCommand) => void;
    commandFailed: (id: string, error: Error, context: CommandContext) => void;
    [key: string]: (...args: any[]) => void;
}

/**
 * Command handler function type
 */
export type CommandHandler = (checking: boolean) => boolean | void;