// src/stores/UIStore.ts
import { derived } from 'svelte/store';
import type { 
    UIStore as IUIStore, 
    UIState, 
    Notification,
    StoreValidation 
} from '@type/store.types';
import { createPersistedStore } from './StoreUtils';
import { utils as coreUtils } from './CoreStore';
import { IService } from '@services/core/IService';
import { LifecycleState } from '@type/base.types';
import { ServiceError } from '@services/core/ServiceError';

const INITIAL_STATE: UIState = {
    darkMode: false,
    activeAccordion: null,
    notifications: [],
    modalStack: [],
    lastInteraction: Date.now(),
    isInitialized: false,
    lastUpdated: Date.now()
};

/**
 * UIStore manages the global UI state including modals, notifications,
 * and accordion states.
 */
export class UIStore implements IUIStore, IService {
    readonly serviceId = 'ui-store';
    readonly serviceName = 'UI Store';
    
    private static readonly STORAGE_KEY = 'graphweaver-ui-state';
    private static readonly MAX_NOTIFICATIONS = 5;
    private static readonly AUTO_DISMISS_DELAY = 5000;
    private static readonly MODAL_TRANSITION_MS = 300;
    
    private static instance: UIStore | null = null;
    private readonly store;
    private state: LifecycleState = LifecycleState.Uninitialized;
    private error: ServiceError | null = null;
    private modalTransitionTimeout: NodeJS.Timeout | null = null;
    
    public subscribe;
    public set;
    public update;

    private constructor() {
        this.store = createPersistedStore<UIState>(
            UIStore.STORAGE_KEY,
            INITIAL_STATE,
            this.validateState
        );

        this.subscribe = this.store.subscribe;
        this.set = this.store.set;
        this.update = this.store.update;

        this.setupNotificationHandling();
    }

    /**
     * Get singleton instance of UIStore
     */
    public static getInstance(): UIStore {
        if (!UIStore.instance) {
            UIStore.instance = new UIStore();
        }
        return UIStore.instance;
    }

    /**
     * Initialize the UI store and reset any stale state
     */
    public async initialize(): Promise<void> {
        try {
            console.log('🦇 Initializing UI Store');
            this.state = LifecycleState.Initializing;
            
            // Clear any stale state
            this.update(state => ({
                ...state,
                modalStack: [],
                notifications: [],
                activeAccordion: null,
                isInitialized: true,
                lastUpdated: Date.now()
            }));

            this.state = LifecycleState.Ready;
            console.log('🦇 UI Store initialized');
        } catch (error) {
            this.state = LifecycleState.Error;
            this.error = new ServiceError(
                this.serviceName, 
                'Failed to initialize UI Store', 
                error as Error
            );
            coreUtils.reportError('Failed to initialize UI Store', 'error', { error });
            throw this.error;
        }
    }

    // Modal Management
    // ---------------

    /**
     * Push a new modal onto the stack
     */
    public pushModal(modalId: string): void {
        console.log('🦇 Pushing modal:', modalId);
        if (this.modalTransitionTimeout) {
            clearTimeout(this.modalTransitionTimeout);
            this.modalTransitionTimeout = null;
        }

        this.update(state => {
            // Don't duplicate modals
            if (state.modalStack.includes(modalId)) {
                return state;
            }
            return {
                ...state,
                modalStack: [...state.modalStack, modalId],
                lastInteraction: Date.now()
            };
        });
    }

    /**
     * Remove the top modal from the stack
     */
    public popModal(): void {
        console.log('🦇 Popping modal');
        
        // Allow time for transition
        this.modalTransitionTimeout = setTimeout(() => {
            this.update(state => ({
                ...state,
                modalStack: state.modalStack.slice(0, -1),
                lastInteraction: Date.now()
            }));
            this.modalTransitionTimeout = null;
        }, UIStore.MODAL_TRANSITION_MS);
    }

    /**
     * Clear all modals from the stack
     */
    public clearModals(): void {
        console.log('🦇 Clearing all modals');
        if (this.modalTransitionTimeout) {
            clearTimeout(this.modalTransitionTimeout);
            this.modalTransitionTimeout = null;
        }

        this.update(state => ({
            ...state,
            modalStack: [],
            lastInteraction: Date.now()
        }));
    }

    /**
     * Check if a specific modal is open
     */
    public isModalOpen(modalId: string): boolean {
        return this.getSnapshot().modalStack.includes(modalId);
    }

    /**
     * Get the ID of the currently visible modal
     */
    public getTopModal(): string | null {
        const { modalStack } = this.getSnapshot();
        return modalStack.length > 0 ? modalStack[modalStack.length - 1] : null;
    }

    // Accordion Management
    // -------------------

    /**
     * Set the currently active accordion section
     */
    public setActiveAccordion(accordionId: string | null): void {
        this.update(state => ({
            ...state,
            activeAccordion: accordionId,
            lastInteraction: Date.now()
        }));
    }

    // Notification Management
    // ----------------------

    /**
     * Add a new notification
     */
    public addNotification(notification: Omit<Notification, 'timestamp'>): void {
        this.update(state => {
            const notifications = [...state.notifications];
            
            // Remove oldest if at capacity
            if (notifications.length >= UIStore.MAX_NOTIFICATIONS) {
                notifications.shift();
            }

            return {
                ...state,
                notifications: [...notifications, {
                    ...notification,
                    timestamp: Date.now()
                }],
                lastInteraction: Date.now()
            };
        });
    }

    /**
     * Remove a notification by ID
     */
    public removeNotification(id: string): void {
        this.update(state => ({
            ...state,
            notifications: state.notifications.filter(n => n.id !== id),
            lastInteraction: Date.now()
        }));
    }

    /**
     * Clear all notifications
     */
    public clearNotifications(): void {
        this.update(state => ({
            ...state,
            notifications: [],
            lastInteraction: Date.now()
        }));
    }

    // Theme Management
    // ---------------

    /**
     * Set dark mode state
     */
    public setDarkMode(isDark: boolean): void {
        this.update(state => ({
            ...state,
            darkMode: isDark,
            lastUpdated: Date.now()
        }));
    }

    // Store Management
    // ---------------

    /**
     * Reset store to initial state
     */
    public reset(): void {
        if (this.modalTransitionTimeout) {
            clearTimeout(this.modalTransitionTimeout);
            this.modalTransitionTimeout = null;
        }

        this.set(INITIAL_STATE);
        try {
            localStorage.removeItem(UIStore.STORAGE_KEY);
        } catch (error) {
            coreUtils.reportError('Failed to clear UI state', 'error', { error });
        }
    }

    /**
     * Get current store state
     */
    public getSnapshot(): UIState {
        return this.store.getSnapshot();
    }

    // Service Implementation
    // ---------------------

    public isReady(): boolean {
        return this.state === LifecycleState.Ready;
    }

    public async destroy(): Promise<void> {
        this.state = LifecycleState.Destroying;
        
        if (this.modalTransitionTimeout) {
            clearTimeout(this.modalTransitionTimeout);
            this.modalTransitionTimeout = null;
        }
        
        await this.reset();
        this.state = LifecycleState.Destroyed;
    }

    public getState(): { state: LifecycleState; error: ServiceError | null } {
        return { state: this.state, error: this.error };
    }

    // Private Methods
    // --------------

    /**
     * Setup auto-dismiss for notifications
     */
    private setupNotificationHandling(): void {
        this.subscribe(state => {
            state.notifications.forEach(notification => {
                if (notification.duration !== undefined) {
                    setTimeout(() => {
                        this.removeNotification(notification.id);
                    }, notification.duration || UIStore.AUTO_DISMISS_DELAY);
                }
            });
        });
    }

    /**
     * Validate store state
     */
    private validateState(state: unknown): state is Partial<UIState> {
        const validation: StoreValidation<UIState> = {
            isValid: false,
            errors: []
        };

        if (!state || typeof state !== 'object') {
            validation.errors?.push('State must be an object');
            return false;
        }

        const validState = state as Partial<UIState>;
        
        // Validate modal stack
        if (validState.modalStack !== undefined && !Array.isArray(validState.modalStack)) {
            validation.errors?.push('modalStack must be an array');
        }

        // Validate notifications
        if (validState.notifications !== undefined && !Array.isArray(validState.notifications)) {
            validation.errors?.push('notifications must be an array');
        }

        // Validate dark mode
        if (validState.darkMode !== undefined && typeof validState.darkMode !== 'boolean') {
            validation.errors?.push('darkMode must be a boolean');
        }

        // Validate accordion state
        if (validState.activeAccordion !== undefined && 
            validState.activeAccordion !== null && 
            typeof validState.activeAccordion !== 'string') {
            validation.errors?.push('activeAccordion must be a string or null');
        }

        validation.isValid = validation.errors?.length === 0;
        return validation.isValid;
    }
}

// Create singleton instance
export const uiStore = UIStore.getInstance();

// Derived stores for reactive state
export const isDarkMode = derived(uiStore, $store => $store.darkMode);
export const activeModal = derived(uiStore, $store => 
    $store.modalStack[$store.modalStack.length - 1] || null
);
export const activeAccordion = derived(uiStore, $store => $store.activeAccordion);
export const notifications = derived(uiStore, $store => $store.notifications);
export const hasActiveModal = derived(uiStore, $store => $store.modalStack.length > 0);
export const hasNotifications = derived(uiStore, $store => $store.notifications.length > 0);
export const uiStatus = derived(uiStore, $store => ({
    isInitialized: $store.isInitialized,
    hasModal: $store.modalStack.length > 0,
    hasNotifications: $store.notifications.length > 0,
    darkMode: $store.darkMode,
    activeAccordion: $store.activeAccordion
}));