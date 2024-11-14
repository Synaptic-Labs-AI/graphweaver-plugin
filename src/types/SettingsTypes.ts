// src/types/SettingsTypes.ts

import { PluginSettings } from '../settings/Settings';

/**
 * Events that can be emitted by settings service
 */
export interface SettingsEvents {
    settingsChanged: (settings: Partial<PluginSettings>) => void;
    settingChanged: <K extends keyof PluginSettings>(key: K, value: PluginSettings[K]) => void;
    settingsReset: () => void;
    validationError: (error: Error) => void;
    persistenceError: (error: Error) => void;
}

/**
 * Map of settings related events and their handler types
 */
export type SettingsEventMap = {
    [K in keyof SettingsEvents]: SettingsEvents[K]
};

/**
 * Nested settings update helper types
 */
export type NestedSettingKey<K extends keyof PluginSettings> = keyof PluginSettings[K];

export type NestedSettingValue<
    K extends keyof PluginSettings,
    N extends NestedSettingKey<K>
> = PluginSettings[K][N];

/**
 * Settings state handler interface
 */
export interface ISettingsHandler {
    initialize(): Promise<void>;
    destroy(): void;
    getSettings(): PluginSettings;
    getSettingSection<K extends keyof PluginSettings>(section: K): PluginSettings[K];
    getNestedSetting<
        K extends keyof PluginSettings,
        N extends NestedSettingKey<K>
    >(section: K, key: N): NestedSettingValue<K, N>;
    updateNestedSetting<
        K extends keyof PluginSettings,
        N extends NestedSettingKey<K>
    >(section: K, key: N, value: NestedSettingValue<K, N>): Promise<void>;
}