// src/stores/index.ts

// Core store exports
export { 
    core, 
    utils as coreUtils, 
    isInitialized, 
    hasError, 
    errors, // Export core error store
    type ErrorState  // Export error type
} from './CoreStore';

// Plugin store exports
export { 
    pluginStore,
    settingsState,
    processingState,
    aiState,
    uiState,
    filesState,
    pluginStatus
} from './PluginStore';

// Processing store exports
export { 
    ProcessingStore,
    processingStore,
    processingStatus,
    processingErrors,
    processingProgress
} from './ProcessingStore';

// Settings store exports
export { 
    SettingsStoreImpl,
    settingsStore,
    initializeSettingsStore,
    initializeDerivedStores
} from './SettingStore';

// UI store exports
export { 
    UIStore,
    uiStore,
    isDarkMode,
    activeModal,
    activeAccordion,
    notifications
} from './UIStore';

// AI store exports
export { 
    StateEvent,
    createAIStore,
    aiStore,
    aiStatus
} from './AIStore';

// Store utilities
export {
    createEnhancedStore,
    createPersistedStore,
    updateNestedState,
    validateState,
    deriveSlice,
    debounceStore,
    combineStores,
    createUndoableStore
} from './StoreUtils';

// Re-export common types
export type {
    StoreUpdate,
    StoreSubscriber,
    StoreUnsubscriber,
    StoreValidation
} from '../types/store.types';
