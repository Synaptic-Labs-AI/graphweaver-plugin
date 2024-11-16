import { App, Component, Setting, ToggleComponent, TextComponent, TextAreaComponent, DropdownComponent, ButtonComponent, Notice } from "obsidian";

/**
 * Base accordion component that provides the foundation for creating accessible accordion components
 * in Obsidian plugins. Handles ARIA attributes, keyboard navigation, and state management.
 */
export abstract class BaseAccordion extends Component {
    protected containerEl: HTMLElement;
    protected accordionEl: HTMLElement;
    protected headerEl: HTMLElement;
    protected contentEl: HTMLElement;
    protected isOpen: boolean = false;
    protected toggleIcon: HTMLElement;
    protected appInstance: App;

    constructor(containerEl: HTMLElement, app: App) {
        super();

        if (!containerEl) {
            throw new Error("Container element is required.");
        }

        this.containerEl = containerEl;
        this.appInstance = app;
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
        this.cleanup();
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
        if (!title || !description) {
            throw new Error("Title and description are required to create an accordion.");
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
        
        this.contentEl = this.accordionEl.createDiv({ 
            cls: "gw-accordion-content",
            attr: {
                'id': contentId,
                'role': 'region',
                'aria-labelledby': accordionId,
                'aria-hidden': 'true'
            }
        });

        this.setupEventListeners();
        return this.contentEl;
    }

    /**
     * Set up event listeners for accordion interaction
     */
    private setupEventListeners(): void {
        const toggleHandler = this.toggleAccordion.bind(this);
        
        // Mouse interaction
        this.headerEl.addEventListener('click', toggleHandler);
        
        // Keyboard interaction
        this.headerEl.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleHandler();
            }
        });

        // Register for cleanup
        this.register(() => {
            this.headerEl.removeEventListener('click', toggleHandler);
        });
    }

    /**
     * Toggle accordion state and update UI
     */
    public toggleAccordion(): void {
        this.isOpen = !this.isOpen;
        
        // Update ARIA states
        this.accordionEl.setAttr('aria-expanded', this.isOpen.toString());
        this.headerEl.setAttr('aria-expanded', this.isOpen.toString());
        this.contentEl.setAttr('aria-hidden', (!this.isOpen).toString());

        // Update classes for animation
        if (this.isOpen) {
            this.contentEl.style.maxHeight = `${this.contentEl.scrollHeight}px`;
            this.accordionEl.addClass('gw-accordion-open');
        } else {
            this.contentEl.style.maxHeight = '0px';
            this.accordionEl.removeClass('gw-accordion-open');
        }

        this.updateToggleIcon();
    }

    /**
     * Update toggle icon based on current state
     */
    protected updateToggleIcon(): void {
        const icon = this.isOpen ? '▼' : '▶';
        this.toggleIcon.empty();
        this.toggleIcon.createSpan({ text: icon });
    }

    /**
     * Create a setting item wrapper
     */
    protected createSettingItem(name: string, desc: string): Setting {
        return new Setting(this.contentEl)
            .setName(name)
            .setDesc(desc);
    }

    /**
     * Add a button to the accordion content
     */
    protected addButton(
        text: string, 
        callback: () => void, 
        cta: boolean = false
    ): ButtonComponent {
        const btn = new ButtonComponent(this.contentEl);
        btn.setButtonText(text)
           .onClick(callback);
        
        if (cta) {
            btn.setCta();
        }

        return btn;
    }

    /**
     * Add a toggle component
     */
    protected addToggle(
        name: string,
        desc: string,
        initialValue: boolean,
        onChange: (value: boolean) => void
    ): ToggleComponent {
        const setting = this.createSettingItem(name, desc);
        let toggle: ToggleComponent;
    
        setting.addToggle(comp => {
            toggle = comp;
            comp.setValue(initialValue)
                 .onChange(onChange);
        });
    
        return toggle!;
    }

    /**
     * Add a text input component
     */
    protected addTextInput(
        name: string,
        desc: string,
        placeholder: string,
        initialValue: string,
        onChange: (value: string) => void
    ): TextComponent {
        const setting = this.createSettingItem(name, desc);
        let input: TextComponent;

        setting.addText(comp => {
            input = comp;
            comp.setPlaceholder(placeholder)
                .setValue(initialValue)
                .onChange(onChange);
        });

        return input!;
    }

    /**
     * Add a text area component
     */
    protected addTextArea(
        name: string,
        desc: string,
        placeholder: string,
        initialValue: string,
        onChange: (value: string) => void
    ): TextAreaComponent {
        const setting = this.createSettingItem(name, desc);
        let textarea: TextAreaComponent;

        setting.addTextArea(comp => {
            textarea = comp;
            comp.setPlaceholder(placeholder)
                .setValue(initialValue)
                .onChange(onChange);
        });

        return textarea!;
    }

    /**
     * Add a dropdown component
     */
    protected addDropdown(
        name: string,
        desc: string,
        options: Record<string, string>,
        initialValue: string,
        onChange: (value: string) => void
    ): DropdownComponent {
        const setting = this.createSettingItem(name, desc);
        let dropdown: DropdownComponent;

        setting.addDropdown(comp => {
            dropdown = comp;
            Object.entries(options).forEach(([value, display]) => {
                comp.addOption(value, display);
            });
            comp.setValue(initialValue)
                .onChange(onChange);
        });

        return dropdown!;
    }

    /**
     * Display a notice to the user.
     * @param message The message to display.
     */
    protected showNotice(message: string): void {
        new Notice(message);
    }

    /**
     * Handle errors by logging and notifying the user.
     * @param context The context or action where the error occurred.
     * @param error The error object.
     */
    protected handleError(context: string, error: unknown): void {
        console.error(`Error in ${context}:`, error);
        this.showNotice(`Error in ${context}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    /**
     * Clean up any resources
     */
    private cleanup(): void {
        this.contentEl?.empty();
        this.headerEl?.empty();
        this.accordionEl?.empty();
        this.containerEl?.empty();
    }
}