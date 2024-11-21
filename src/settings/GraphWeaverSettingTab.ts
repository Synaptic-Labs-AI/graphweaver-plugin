// GraphWeaverSettingTab.ts
import { App, PluginSettingTab } from 'obsidian';
import type GraphWeaverPlugin from '../../main';
import SettingsTab from './SettingsTab.svelte';

export class GraphWeaverSettingTab extends PluginSettingTab {
  private svelteComponent: SettingsTab | null = null;

  constructor(app: App, private plugin: GraphWeaverPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    this.svelteComponent = new SettingsTab({
      target: containerEl,
      props: {
        app: this.app,
        plugin: this.plugin
      }
    });
  }

  hide(): void {
    this.svelteComponent?.$destroy();
    this.svelteComponent = null;
    const { containerEl } = this;
    containerEl.empty();
  }
}