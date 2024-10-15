// src/components/accordions/BaseAccordion.ts

import { Setting } from "obsidian";

export abstract class BaseAccordion {
    protected containerEl: HTMLElement;
    protected accordionEl: HTMLElement;
    protected headerEl: HTMLElement;
    protected contentEl: HTMLElement;
    protected isOpen: boolean = false;

    constructor(containerEl: HTMLElement) {
        this.containerEl = containerEl;
    }

    abstract render(): void;

    protected createAccordion(title: string): HTMLElement {
        this.accordionEl = this.containerEl.createDiv({ cls: "gw-accordion" });
        
        this.headerEl = this.accordionEl.createDiv({ cls: "gw-accordion-header" });
        this.headerEl.createSpan({ text: title });
        const toggleIcon = this.headerEl.createSpan({ cls: "gw-accordion-toggle" });
        toggleIcon.innerHTML = "▼";
        
        this.contentEl = this.accordionEl.createDiv({ cls: "gw-accordion-content" });
        
        this.headerEl.addEventListener("click", () => this.toggleAccordion());

        return this.contentEl;
    }

    public toggleAccordion(): void {
        this.isOpen = !this.isOpen;
        this.contentEl.style.display = this.isOpen ? "block" : "none";
        const toggleIcon = this.headerEl.querySelector(".gw-accordion-toggle");
        if (toggleIcon) {
            toggleIcon.innerHTML = this.isOpen ? "▲" : "▼";
        }
    }

    protected createSettingItem(name: string, desc: string): Setting {
        const setting = new Setting(this.contentEl);
        setting.setName(name).setDesc(desc);
        setting.settingEl.classList.add("gw-setting-item");
        return setting;
    }
}