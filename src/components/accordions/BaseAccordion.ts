import { App, Setting, Notice, ButtonComponent, TextComponent, TextAreaComponent } from "obsidian";
import { SettingsService } from "../../services/SettingsService";
import { AIService } from "../../services/AIService";
import { PluginSettings } from "src/settings/Settings";
import { ProcessingEvent } from "src/models/ProcessingTypes";
import { EventEmitter } from 'events';

// Improve type safety for nested settings
type NestedSettingPath<
    T,
    Section extends keyof T,
    Key extends keyof T[Section]
> = {
    section: Section;
    key: Key;
    value: T[Section][Key];
};

export abstract class BaseAccordion {
    protected containerEl: HTMLElement;
    protected accordionEl: HTMLElement;
    protected headerEl: HTMLElement;
    protected contentEl: HTMLElement;
    protected isOpen: boolean = false;
    protected toggleIcon: HTMLSpanElement;
    protected eventEmitter: EventEmitter = new EventEmitter();

    constructor(
        protected app: App,
        protected parentEl: HTMLElement,
        protected settingsService: SettingsService,
        protected aiService: AIService
    ) {
        this.containerEl = parentEl;
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

    public updateToggleIcon(): void {
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

    // Add utility methods for creating common setting types
    protected createToggleSetting<
        Section extends keyof PluginSettings,
        Key extends keyof PluginSettings[Section]
    >(
        name: string,
        desc: string,
        currentValue: boolean,
        onChangePath: NestedSettingPath<PluginSettings, Section, Key>
    ): void {
        new Setting(this.contentEl)
            .setName(name)
            .setDesc(desc)
            .addToggle(toggle => toggle
                .setValue(currentValue)
                .onChange(async (value) => {
                    await this.settingsService.updateNestedSetting(
                        onChangePath.section,
                        onChangePath.key,
                        value as unknown as PluginSettings[Section][Key]
                    );
                }));
    }

    protected createTextSetting<
        Section extends keyof PluginSettings,
        Key extends keyof PluginSettings[Section]
    >(
        name: string,
        desc: string,
        placeholder: string,
        currentValue: string,
        onChangePath: NestedSettingPath<PluginSettings, Section, Key>
    ): TextComponent {
        let textComponent: TextComponent;
        new Setting(this.contentEl)
            .setName(name)
            .setDesc(desc)
            .addText(text => {
                textComponent = text;
                text.setPlaceholder(placeholder)
                    .setValue(currentValue)
                    .onChange(async (value) => {
                        await this.settingsService.updateNestedSetting(
                            onChangePath.section,
                            onChangePath.key,
                            value as unknown as PluginSettings[Section][Key]
                        );
                    });
            });
        return textComponent!;
    }

    protected createTextAreaSetting(
        name: string,
        desc: string,
        placeholder: string,
        currentValue: string,
        rows: number = 4
    ): TextAreaComponent {
        let textAreaComponent: TextAreaComponent;
        new Setting(this.contentEl)
            .setName(name)
            .setDesc(desc)
            .addTextArea(text => {
                textAreaComponent = text;
                text.setPlaceholder(placeholder)
                    .setValue(currentValue);
                text.inputEl.rows = rows;
            });
        return textAreaComponent!;
    }

    protected createButton(
        name: string,
        desc: string,
        buttonText: string,
        onClick: () => void,
        setCta: boolean = false
    ): ButtonComponent {
        let buttonComponent: ButtonComponent;
        new Setting(this.contentEl)
            .setName(name)
            .setDesc(desc)
            .addButton(button => {
                buttonComponent = button;
                button.setButtonText(buttonText);
                if (setCta) button.setCta();
                button.onClick(onClick);
            });
        return buttonComponent!;
    }

    protected showNotice(message: string): void {
        new Notice(message);
    }

    private emitEvent(type: keyof ProcessingEvent, data: any): void {
        this.eventEmitter.emit(type, data); // Changed from fire to emit
    }
}