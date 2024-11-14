import { App, Component, setIcon, Setting } from "obsidian";

/**
 * BaseAccordion class provides the foundation for creating accessible accordion components
 * in Obsidian plugins. It handles ARIA attributes, keyboard navigation, and state management.
 * Extends Component for proper lifecycle management.
 */
export abstract class BaseAccordion extends Component {
    protected containerEl: HTMLElement;
    protected accordionEl: HTMLElement;
    protected headerEl: HTMLElement;
    protected contentEl: HTMLElement;
    protected isOpen: boolean = false;
    protected toggleIcon: HTMLElement;
    protected appInstance: App; // Store app instance separately

    constructor(containerEl: HTMLElement, app: App) {
        super(); // Call Component constructor with no args
        
        if (!containerEl) {
            throw new Error('Container element must be provided to BaseAccordion');
        }
        
        this.containerEl = containerEl;
        this.appInstance = app; // Store app instance
        this.load();
    }

    /**
     * Component lifecycle method for initialization
     */
    async onload(): Promise<void> {
        // Additional initialization if needed
    }

    /**
     * Component lifecycle method for cleanup
     */
    async onunload(): Promise<void> {
        // Cleanup will be handled by Component registration
    }

    /**
     * Abstract method that concrete classes must implement to render their specific content
     */
    abstract render(): void;

    /**
     * Creates the accordion structure with proper ARIA attributes and event listeners
     * @param title - The accordion section title
     * @param description - The accordion section description
     * @returns HTMLElement - The content element for child classes to populate
     */
    protected createAccordion(title: string, description: string): HTMLElement {
        // Validate inputs
        if (!title || !description) {
            throw new Error('Title and description are required for accordion creation');
        }

        const accordionId = `accordion-${title.toLowerCase().replace(/\s+/g, '-')}`;
        const contentId = `content-${accordionId}`;

        this.accordionEl = this.containerEl.createDiv({ 
            cls: "gw-accordion",
            attr: {
                'role': 'region',
                'aria-expanded': 'false',
                'id': accordionId
            }
        });
        
        this.containerEl.addClass('graphweaver-plugin');
        
        this.headerEl = this.accordionEl.createDiv({ 
            cls: "gw-accordion-header",
            attr: {
                'role': 'button',
                'tabindex': '0',
                'aria-label': `${title} accordion`,
                'aria-controls': contentId,
                'aria-expanded': 'false'
            }
        });

        const titleWrapper = this.headerEl.createDiv({ 
            cls: "gw-accordion-title-wrapper" 
        });
        
        titleWrapper.createSpan({ 
            text: title, 
            cls: "gw-accordion-title" 
        });
        
        this.toggleIcon = this.headerEl.createDiv({ 
            cls: "gw-accordion-toggle",
            attr: {
                'aria-hidden': 'true'
            }
        });
        
        this.updateToggleIcon();
        
        const descriptionEl = this.accordionEl.createDiv({ 
            cls: "gw-accordion-description" 
        });
        descriptionEl.createSpan({ text: description });
        
        // Create content element with unique ID for ARIA relationships
        this.contentEl = this.accordionEl.createDiv({ 
            cls: "gw-accordion-content",
            attr: {
                'role': 'region',
                'id': contentId,
                'aria-hidden': 'true',
                'aria-labelledby': accordionId
            }
        });

        // Initialize to closed state via CSS
        this.accordionEl.classList.remove("gw-accordion-open");
        
        this.setupEventListeners();

        return this.contentEl;
    }

    /**
     * Set up event listeners with proper cleanup registration
     */
    private setupEventListeners(): void {
        // Use Component's registerDomEvent for automatic cleanup
        this.registerDomEvent(this.headerEl, "click", this.toggleAccordion.bind(this));

        this.registerDomEvent(this.headerEl, "keydown", (event: KeyboardEvent) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                this.toggleAccordion();
            }
        });

        // Add focus handling for accessibility
        this.registerDomEvent(this.headerEl, "focus", () => {
            this.headerEl.addClass("is-focused");
        });

        this.registerDomEvent(this.headerEl, "blur", () => {
            this.headerEl.removeClass("is-focused");
        });
    }

    /**
     * Toggle accordion state with ARIA updates
     */
    public toggleAccordion(): void {
        this.isOpen = !this.isOpen;

        // Update ARIA attributes
        this.accordionEl.setAttribute('aria-expanded', this.isOpen.toString());
        this.headerEl.setAttribute('aria-expanded', this.isOpen.toString());
        this.contentEl.setAttribute('aria-hidden', (!this.isOpen).toString());

        // Update visual state
        this.accordionEl.classList.toggle("gw-accordion-open", this.isOpen);
        this.updateToggleIcon();

        // Use appInstance instead of app
        this.appInstance.workspace.trigger('accordion-state-changed', {
            id: this.accordionEl.id,
            isOpen: this.isOpen
        });
    }

    /**
     * Update toggle icon based on current state
     */
    public updateToggleIcon(): void {
        if (!this.toggleIcon) return;
        this.toggleIcon.empty();
        setIcon(this.toggleIcon, this.isOpen ? "chevron-down" : "chevron-right");
    }

    /**
     * Create a setting item with proper styling
     */
    protected createSettingItem(name: string, desc: string): Setting {
        if (!name || !desc) {
            throw new Error('Name and description are required for setting items');
        }

        const setting = new Setting(this.contentEl);
        setting
            .setName(name)
            .setDesc(desc);

        setting.settingEl.addClass("setting-item", "gw-setting-item");
        setting.nameEl.addClass("setting-item-name");
        setting.descEl.addClass("setting-item-description");

        return setting;
    }

    /**
     * Check if accordion is currently visible
     */
    protected isVisible(): boolean {
        return this.isOpen;
    }

    /**
     * Get the content element
     */
    public getContentEl(): HTMLElement {
        return this.contentEl;
    }

    /**
     * Set open state programmatically
     */
    public setOpen(open: boolean): void {
        if (this.isOpen !== open) {
            this.toggleAccordion();
        }
    }
}