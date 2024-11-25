import { Modal, type App } from 'obsidian';
import PropertiesEditorContent from './PropertiesEditor.svelte';
import type { PropertyTag } from '@type/metadata.types';
import { uiStore } from '@stores/UIStore';

export class PropertiesEditor extends Modal {
    private contentComponent: PropertiesEditorContent | null = null;
    private properties: PropertyTag[] = [];
    private onSubmit: ((properties: PropertyTag[]) => void) | null = null;
    private isClosing = false;

    constructor(app: App) {
        console.log('🦇 PropertiesEditor constructor called');
        super(app);
    }

    openWithProperties(properties: PropertyTag[], onSubmit: (properties: PropertyTag[]) => void) {
        console.log('🦇 openWithProperties called with:', { propertiesCount: properties.length });
        this.properties = properties;
        this.onSubmit = onSubmit;
        this.open();
    }

    onOpen() {
        console.log('🔍 Modal onOpen called');
        const settingsContainer = document.querySelector('.graphweaver-plugin-settings');
        if (settingsContainer) {
            settingsContainer.classList.add('modal-active');
        }

        this.titleEl.setText('Edit Properties');
        this.containerEl.addClass('properties-editor-modal');

        try {
            console.log('🔍 Creating PropertiesEditorContent');
            this.contentComponent = new PropertiesEditorContent({
                target: this.contentEl,
                props: {
                    app: this.app,
                    properties: this.properties,
                    onSubmit: (updatedProperties: PropertyTag[]) => {
                        if (this.onSubmit && !this.isClosing) {
                            this.onSubmit(updatedProperties);
                        }
                        this.closeModal();
                    },
                    onClose: () => {
                        this.closeModal();
                    }
                }
            });
        } catch (error) {
            console.error('🔍 Error creating PropertiesEditorContent:', error);
        }
    }

    private closeModal() {
        if (this.isClosing) return;
        
        console.log('🔍 Closing properties editor modal');
        this.isClosing = true;

        const settingsContainer = document.querySelector('.graphweaver-plugin-settings');
        if (settingsContainer) {
            settingsContainer.classList.remove('modal-active');
        }

        if (this.contentComponent) {
            try {
                console.log('🔍 Destroying Svelte component');
                this.contentComponent.$destroy();
                this.contentComponent = null;
            } catch (error) {
                console.error('🔍 Error destroying component:', error);
            }
        }

        this.close();
        uiStore.popModal();
        
        // Reset closing state after a short delay
        setTimeout(() => {
            this.isClosing = false;
        }, 100);
    }

    onClose() {
        if (!this.isClosing) {
            this.closeModal();
        }
    }
}