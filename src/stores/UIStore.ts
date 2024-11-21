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
import { LifecycleState } from '@type/base.types';import { ServiceError } from '@services/core/ServiceError';

const INITIAL_STATE: UIState = {
    darkMode: false,
    activeAccordion: null,
    notifications: [],
    modalStack: [],
    lastInteraction: Date.now()
};

export class UIStore implements IUIStore, IService {
    readonly serviceId = 'ui-store';
    readonly serviceName = 'UI Store';
    
    private static readonly STORAGE_KEY = 'graphweaver-ui-state';
    private static readonly MAX_NOTIFICATIONS = 5;
    private static readonly AUTO_DISMISS_DELAY = 5000;
    
    private static instance: UIStore | null = null;
    private readonly store;
    private state: ServiceState = ServiceState.Uninitialized;
    private error: ServiceError | null = null;
    
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

        // Setup auto-dismiss for notifications
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

    public static getInstance(): UIStore {
        if (!UIStore.instance) {
            UIStore.instance = new UIStore();
        }
        return UIStore.instance;
    }

    /**
     * Initialize UI store with saved state
     */
    public async initialize(): Promise<void> {
        try {
            this.state = ServiceState.Initializing;
            const savedState = localStorage.getItem(UIStore.STORAGE_KEY);

            if (savedState) {
                const parsedState = JSON.parse(savedState);
                if (this.validateState(parsedState)) {
                    this.set({
                        ...INITIAL_STATE,
                        ...parsedState,
                        notifications: [], // Always start with empty notifications
                        lastInteraction: Date.now()
                    });
                }
            }

            this.state = ServiceState.Ready;
        } catch (error) {
            this.state = ServiceState.Error;
            this.error = new ServiceError(this.serviceName, 'Failed to initialize UI Store', error as Error);
            coreUtils.reportError('Failed to initialize UI Store', 'error', { error });
            throw this.error;
        }
    }

    /**
     * Theme management
     */
    public setDarkMode(isDark: boolean): void {
        this.update(state => ({
            ...state,
            darkMode: isDark,
            lastInteraction: Date.now()
        }));
    }

    /**
     * Accordion management
     */
    public setActiveAccordion(accordionId: string | null): void {
        this.update(state => ({
            ...state,
            activeAccordion: accordionId,
            lastInteraction: Date.now()
        }));
    }

    /**
     * Notification management
     */
    public addNotification(notification: Omit<Notification, 'timestamp'>): void {
        this.update(state => {
            const notifications = [...state.notifications];
            
            // Remove oldest notification if at max capacity
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

    public removeNotification(id: string): void {
        this.update(state => ({
            ...state,
            notifications: state.notifications.filter(n => n.id !== id),
            lastInteraction: Date.now()
        }));
    }

    public clearNotifications(): void {
        this.update(state => ({
            ...state,
            notifications: [],
            lastInteraction: Date.now()
        }));
    }

    /**
     * Modal management
     */
    public pushModal(modalId: string): void {
        this.update(state => ({
            ...state,
            modalStack: [...state.modalStack, modalId],
            lastInteraction: Date.now()
        }));
    }

    public popModal(): void {
        this.update(state => ({
            ...state,
            modalStack: state.modalStack.slice(0, -1),
            lastInteraction: Date.now()
        }));
    }

    public clearModals(): void {
        this.update(state => ({
            ...state,
            modalStack: [],
            lastInteraction: Date.now()
        }));
    }

    public isModalOpen(modalId: string): boolean {
        return this.getSnapshot().modalStack.includes(modalId);
    }

    public getTopModal(): string | null {
        const { modalStack } = this.getSnapshot();
        return modalStack.length > 0 ? modalStack[modalStack.length - 1] : null;
    }

    /**
     * State validation
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
        
        // Validate each field
        if (validState.darkMode !== undefined && typeof validState.darkMode !== 'boolean') {
            validation.errors?.push('darkMode must be a boolean');
        }

        if (validState.activeAccordion !== undefined && 
            validState.activeAccordion !== null && 
            typeof validState.activeAccordion !== 'string') {
            validation.errors?.push('activeAccordion must be a string or null');
        }

        if (validState.modalStack !== undefined && !Array.isArray(validState.modalStack)) {
            validation.errors?.push('modalStack must be an array');
        }

        if (validState.notifications !== undefined && !Array.isArray(validState.notifications)) {
            validation.errors?.push('notifications must be an array');
        }

        validation.isValid = validation.errors?.length === 0;
        return validation.isValid;
    }

    /**
     * Store management
     */
    public reset(): void {
        this.set(INITIAL_STATE);
        try {
            localStorage.removeItem(UIStore.STORAGE_KEY);
        } catch (error) {
            coreUtils.reportError('Failed to clear UI state', 'error', { error });
        }
    }

    public getSnapshot(): UIState {
        return this.store.getSnapshot();
    }

    /**
     * Service implementation
     */
    public isReady(): boolean {
        return this.state === ServiceState.Ready;
    }

    public async destroy(): Promise<void> {
        this.state = ServiceState.Destroying;
        await this.reset();
        this.state = ServiceState.Destroyed;
    }

    public getState(): { state: ServiceState; error: ServiceError | null } {
        return { state: this.state, error: this.error };
    }
}

// Create singleton instance
export const uiStore = UIStore.getInstance();

// Derived stores
export const isDarkMode = derived(uiStore, $store => $store.darkMode);
export const activeModal = derived(uiStore, $store => 
    $store.modalStack[$store.modalStack.length - 1] || null
);
export const activeAccordion = derived(uiStore, $store => $store.activeAccordion);
export const notifications = derived(uiStore, $store => $store.notifications);
export const hasActiveModal = derived(uiStore, $store => $store.modalStack.length > 0);
export const hasNotifications = derived(uiStore, $store => $store.notifications.length > 0);