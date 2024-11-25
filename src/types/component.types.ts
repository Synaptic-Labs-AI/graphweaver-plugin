import type { App } from 'obsidian';
import type { SettingsService } from '@services/SettingsService';
import type { AIService } from '@services/ai/AIService';
import type { PropertyTag, PropertyType, Tag } from '@type/metadata.types';
import type { Notification } from '@type/store.types';
import type { AIProvider, AIAdapter } from '@type/ai.types';
import type { AIGenerationService } from '@services/ai/AIGenerationService';
import type { AdapterRegistry } from '@services/ai/AdapterRegistry';
import type { TagManagementService } from '../services/tags/TagManagementService'; // Updated import

/**
 * Base service props interface
 */

export interface ServiceProps {
    app: App;
    aiService: AIService;
    settingsService: SettingsService;
    adapterRegistry?: AdapterRegistry;
    tagManagementService?: TagManagementService; // Removed AITagManagementService
    generationService?: AIGenerationService;
}

/**
 * Common event handlers
 */
export interface ComponentEvents {
    onChange?: (value: unknown) => void;
    onBlur?: () => void;
    onFocus?: () => void;
    onClick?: () => void;
    onKeyDown?: (event: KeyboardEvent) => void;
}

/**
 * Common form field props
 */
export interface FormFieldProps {
    label: string;
    description?: string;
    required?: boolean;
    error?: string;
    disabled?: boolean;
}

/**
 * Base modal props
 */
export interface ModalProps<T = unknown> {
    onClose: () => void;
    onSubmit?: (data: T) => void | Promise<void>;
}

/**
 * Service modal props combining service and modal props
 */
export interface ServiceModalProps<T = unknown> extends ModalProps<T>, ServiceProps {}

// Update the existing BaseComponentProps to be more explicit
export interface BaseComponentProps extends ServiceProps {
    /** Optional component title */
    title?: string;
    /** Optional component description */
    description?: string;
    /** Controls component visibility or expanded state */
    isOpen?: boolean;
    /** Optional CSS class names */
    className?: string;
}

/**
 * Accordion specific types with Flowbite integration
 */
export interface AccordionProps extends BaseComponentProps {
    /** Title text displayed in the accordion header */
    title: string;
    /** Optional description text shown below the header */
    description?: string;
    /** Controls the open/closed state of the accordion */
    isOpen?: boolean;
    /** Optional registry for AI adapters */
    adapterRegistry?: AdapterRegistry;
    /** Optional service for tag management */
    tagManagementService?: TagManagementService;
    /** Optional Flowbite-specific props */
    flush?: boolean;
    alwaysOpen?: boolean;
    activeClasses?: string;
    inactiveClasses?: string;
}

// Property management types
export interface PropertyEditorProps extends ModalProps<PropertyTag[]> {
    properties: PropertyTag[];
    onSubmit: (data: PropertyTag[]) => void;
}

export interface PropertyField extends FormFieldProps {
    name: string;
    type: PropertyType;
    value: unknown;
    options?: string[];
    multipleValues?: boolean;
}

// Settings types
export interface AdvancedSettings {
    generateWikilinks: boolean;
    temperature: number;
    maxTokens: number;
}

export interface ModelHookupSettings {
    selected: AIProvider;
    apiKeys: Partial<Record<AIProvider, string>>;
    localLMStudio?: {
        port: number;
    };
}

// Component specific props
export interface ModelHookupProps extends BaseComponentProps {
    onProviderChange?: (provider: AIProvider) => Promise<void>;
    onApiKeyChange?: (key: string) => Promise<void>;
    onTestConnection?: () => Promise<void>;
    initialSettings?: ModelHookupSettings;
}

export interface BatchProcessorProps extends BaseComponentProps {
    initialSettings?: {
        autoGenerate: boolean;
    };
}

export interface KnowledgeBloomProps extends BaseComponentProps {
    initialModel?: string;
}

export interface OntologyGenerationProps extends ServiceProps {
    aiAdapter: AIAdapter;
    generationService: AIGenerationService;
    adapterRegistry: AdapterRegistry;
    tagManagementService: TagManagementService;
}

// Modal specific props
export interface BatchProcessorModalProps extends ServiceProps {
    onClose: () => void;
    onProcessComplete?: () => void;
}

export interface OntologyGeneratorModalProps extends Omit<ServiceProps, 'aiService'> {
    aiAdapter: AIAdapter;
    aiGenerationService: AIGenerationService;
    tagManagementService: TagManagementService;
    adapterRegistry: AdapterRegistry;
    onGenerate: (ontology: OntologyResult) => Promise<void>;
    onClose: () => void;
}

// Utility types
export interface DragHandlers {
    handleDragStart: (event: DragEvent, index: number) => void;
    handleDragOver: (event: DragEvent) => void;
    handleDrop: (event: DragEvent, toIndex: number) => void;
}

export interface StatusProps {
    status: string;
    isLoading?: boolean;
    showSpinner?: boolean;
}

export interface NotificationProps {
    notification: Notification;
    onDismiss?: (id: string) => void;
    autoClose?: boolean;
    duration?: number;
}

export interface ButtonProps extends ComponentEvents {
    variant?: 'primary' | 'warning' | 'cancel' | 'cta';
    size?: 'small' | 'medium' | 'large';
    disabled?: boolean;
    loading?: boolean;
    icon?: string;
    className?: string;
}

export interface TagConversionResult {
    newTags: Tag[];
    modifiedTags: Tag[];
    unchangedTags: Tag[];
}

export interface OntologyInput {
    files: { basename: string }[];
    folders: { name: string }[];
    tags: string[];
    provider: string;
    modelApiName: string;
    userContext?: string;
    existingTags?: Tag[];
    existingProperties?: PropertyTag[];
}

export interface OntologyResult {
    tags: Tag[];
    properties: PropertyTag[];
}

/**
 * File tree node structure
 */
export interface FileNode {
    name: string;
    path: string;
    type: 'file' | 'folder';
    children?: FileNode[];
    selected: boolean;
    expanded?: boolean;
    parent?: FileNode;
    level: number;
  }
  
  /**
   * File selection state
   */
  export interface FileSelectionState {
    selectedPaths: Set<string>;
    expandedFolders: Set<string>;
  }
  
  /**
   * Batch processing result
   */
  export interface BatchProcessingResult {
    processedFiles: string[];
    skippedFiles: string[];
    errors: Array<{ path: string; error: string }>;
  }

