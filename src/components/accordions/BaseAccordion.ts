import { Setting } from "obsidian";

export abstract class BaseAccordion {
    protected containerEl: HTMLElement;
    protected accordionEl: HTMLElement;
    protected headerEl: HTMLElement;
    protected contentEl: HTMLElement;
    protected isOpen: boolean = false;
    protected toggleIcon: HTMLSpanElement;

    constructor(containerEl: HTMLElement) {
        this.containerEl = containerEl;
    }

    abstract render(): void;

    protected createAccordion(title: string, description: string): HTMLElement {
        this.accordionEl = this.containerEl.createDiv({ cls: "gw-accordion" });
        
        this.headerEl = this.accordionEl.createDiv({ cls: "gw-accordion-header" });
        const titleWrapper = this.headerEl.createDiv({ cls: "gw-accordion-title-wrapper" });
        
        titleWrapper.createSpan({ text: title, cls: "gw-accordion-title" });
        
        this.toggleIcon = this.headerEl.createSpan({ cls: "gw-accordion-toggle" });
        this.updateToggleIcon();
        
        const descriptionEl = this.accordionEl.createDiv({ cls: "gw-accordion-description" });
        descriptionEl.createSpan({ text: description });
        
        this.contentEl = this.accordionEl.createDiv({ cls: "gw-accordion-content" });
        this.contentEl.style.display = "none"; // Start closed
        
        this.headerEl.addEventListener("click", () => this.toggleAccordion());

        return this.contentEl;
    }

    public toggleAccordion(): void {
        this.isOpen = !this.isOpen;
        this.contentEl.style.display = this.isOpen ? "block" : "none";
        this.updateToggleIcon();
        this.accordionEl.classList.toggle("gw-accordion-open", this.isOpen);
    }

    private updateToggleIcon(): void {
        // Clear existing content
        this.toggleIcon.empty();
        
        // Create a new text node with the appropriate character
        const iconText = document.createTextNode(this.isOpen ? "➖" : "➕");
        this.toggleIcon.appendChild(iconText);
    }

    protected createSettingItem(name: string, desc: string): Setting {
        const setting = new Setting(this.contentEl);
        setting.setName(name).setDesc(desc);
        setting.settingEl.classList.add("gw-setting-item");
        return setting;
    }
}