import type { App } from 'obsidian';
import type { SettingsService } from '@services/SettingsService';
import type { AIService } from '@services/ai/AIService';
import type { PropertyTag, PropertyType, Tag } from '@type/metadata.types';
import type { Notification } from '@type/store.types';
import type { AIProvider, AIAdapter } from '@type/ai.types';
import type { AIGenerationService } from '@services/ai/AIGenerationService';
import type { AdapterRegistry } from '@services/ai/AdapterRegistry';
import type { TagManagementService } from '@services/ai/AITagManagementService';

/**
 * Base service props interface
 */
export interface ServiceProps {
    app: App;
    settingsService: SettingsService;
    aiService: AIService;
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

/**
 * Base component with common patterns
 */
export interface BaseComponentProps extends ServiceProps {
    title?: string;
    description?: string;
    isOpen?: boolean;
}

// Accordion specific types
export interface AccordionProps extends BaseComponentProps {
    title: string; // Make title required for accordions
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
export interface BatchProcessorModalProps extends ServiceModalProps {
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

// Result types
export interface GeneratedNote {
    title: string;
    content: string;
}

export interface TagConversionResult {
    newTags: Tag[];
    modifiedTags: Tag[];
    unchangedTags: Tag[];
}

export interface OntologyInput {
    content: string;
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

