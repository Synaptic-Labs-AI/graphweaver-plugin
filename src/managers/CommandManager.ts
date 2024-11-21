import type { Plugin } from 'obsidian';
import { ServiceError } from '@services/core/ServiceError';
import { LifecycleState } from '@type/base.types';
import { TypedEventEmitter } from '@type/events.types';
import type { IService } from '@services/core/IService';
import type { 
    PluginCommand, 
    CommandContext, 
    CommandResult,
    CommandEvents
} from '@type/commands.types';

/**
 * Manages plugin commands and their lifecycle
 */
export class CommandManager extends TypedEventEmitter<CommandEvents> implements IService {
    public readonly serviceId = 'command-manager';
    public readonly serviceName = 'Command Manager';

    private state: LifecycleState = LifecycleState.Uninitialized;
    private error: ServiceError | null = null;
    private commands = new Map<string, PluginCommand>();

    constructor(private plugin: Plugin) {
        super();
    }

    /**
     * Initialize command manager
     */
    public async initialize(): Promise<void> {
        try {
            this.state = LifecycleState.Initializing;
            await this.registerDefaultCommands();
            this.state = LifecycleState.Ready;
        } catch (error) {
            this.state = LifecycleState.Error;
            this.error = ServiceError.from(this.serviceName, error);
            throw this.error;
        }
    }

    /**
     * Register a new command
     */
    public registerCommand(command: PluginCommand): void {
        if (this.commands.has(command.id)) {
            throw new ServiceError(this.serviceName, `Command ${command.id} already registered`);
        }

        const wrappedCommand = this.wrapCommand(command);
        this.plugin.addCommand(wrappedCommand);
        this.commands.set(command.id, wrappedCommand);
        this.emit('commandRegistered', wrappedCommand);
    }

    /**
     * Execute a command by ID
     */
    public async executeCommand(
        id: string, 
        context: Partial<CommandContext> = {}
    ): Promise<void> {
        const command = this.commands.get(id);
        if (!command) {
            throw new ServiceError(this.serviceName, `Command ${id} not found`);
        }

        const execContext: CommandContext = {
            source: context.source || 'command-palette',
            timestamp: Date.now(),
            data: context.data
        };

        const startTime = performance.now();
        try {
            if (command.checkCallback) {
                if (!command.checkCallback(false)) {
                    throw new Error('Command preconditions not met');
                }
            }
            
            if (command.callback) {
                await command.callback();
            }

            const result: CommandResult = {
                success: true,
                duration: performance.now() - startTime
            };
            this.emit('commandExecuted', id, result, execContext);
        } catch (error) {
            const result: CommandResult = {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
                duration: performance.now() - startTime
            };
            this.emit('commandFailed', id, result.error as Error, execContext);
            throw error;
        }
    }

    /**
     * Check if manager is ready
     */
    public isReady(): boolean {
        return this.state === LifecycleState.Ready;
    }

    /**
     * Get current state
     */
    public getState(): { state: LifecycleState; error: ServiceError | null } {
        return { state: this.state, error: this.error };
    }

    /**
     * Clean up resources
     */
    public async destroy(): Promise<void> {
        this.commands.clear();
        this.state = LifecycleState.Destroyed;
    }

    /**
     * Validate active file existence
     */
    public validateActiveFile(checking: boolean): boolean {
        const activeFile = this.plugin.app.workspace.getActiveFile();
        if (checking) return !!activeFile;
        if (!activeFile) {
            if (!checking) {
                console.error('🦇 [CommandManager] No active file');
            }
            return false;
        }
        return true;
    }

    /**
     * Register default plugin commands
     */
    private async registerDefaultCommands(): Promise<void> {
        const defaultCommands: PluginCommand[] = [
            {
                id: 'generate-frontmatter',
                name: 'Generate Front Matter',
                checkCallback: (checking: boolean) => this.validateActiveFile(checking)
            },
            {
                id: 'generate-wikilinks',
                name: 'Generate Wikilinks',
                checkCallback: (checking: boolean) => this.validateActiveFile(checking)
            },
            {
                id: 'generate-knowledge-bloom',
                name: 'Generate Knowledge Bloom',
                checkCallback: (checking: boolean) => {
                    if (!this.validateActiveFile(checking)) return false;
                    
                    // Additional validation could go here
                    // For example, checking if AI service is ready
                    return true;
                }
            },
            {
                id: 'batch-process-files',
                name: 'Batch Process Files',
                checkCallback: (checking: boolean) => {
                    // Batch processing doesn't require an active file
                    return true;
                }
            }
        ];

        for (const command of defaultCommands) {
            this.registerCommand(command);
        }
    }

    /**
     * Wrap command with error handling and events
     */
    private wrapCommand(command: PluginCommand): PluginCommand {
        return {
            ...command,
            callback: async () => {
                const context: CommandContext = {
                    source: 'command-palette',
                    timestamp: Date.now()
                };

                try {
                    await this.executeCommand(command.id, context);
                } catch (error) {
                    console.error(`🦇 [CommandManager] Error executing ${command.id}:`, error);
                    throw error;
                }
            },
            checkCallback: command.checkCallback
        };
    }

    /**
     * Helper to get active file with type checking
     */
    private getActiveFile() {
        const file = this.plugin.app.workspace.getActiveFile();
        if (!file) {
            throw new ServiceError(this.serviceName, 'No active file');
        }
        return file;
    }
}