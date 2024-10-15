// src/adapters/LMStudioAdapter.ts

import { Notice, requestUrl } from 'obsidian';
import { SettingsService } from '../services/SettingsService';
import { AIProvider, AIResponse, AIAdapter } from '../models/AIModels';

export class LMStudioAdapter implements AIAdapter {
  public model: string;
  public port: string;

  constructor(public settingsService: SettingsService) {
    this.updateSettings();
  }

  public async generateResponse(prompt: string, model: string = 'default'): Promise<AIResponse> {
    try {
      if (!this.isReady()) {
        throw new Error('LM Studio settings are not properly configured');
      }

      const response = await requestUrl({
        url: `http://localhost:${this.port}/api/v1/complete`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          prompt: prompt
        })
      });

      if (response.status !== 200) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      return {
        success: true,
        data: response.json
      };
    } catch (error) {
      console.error('Error in LM Studio API call:', error);
      new Notice(`LM Studio API Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  public async validateApiKey(): Promise<boolean> {
    // LM Studio doesn't require an API key, so we'll just check if the settings are valid
    return this.isReady();
  }

  public getAvailableModels(): string[] {
    // LM Studio uses a single local model, so we'll return an array with just that model
    return [this.model];
  }

  public getProviderType(): AIProvider {
    return AIProvider.LMStudio;
  }

  public setApiKey(apiKey: string): void {
    // LM Studio doesn't use an API key, so this method is a no-op
  }

  public getApiKey(): string {
    // LM Studio doesn't use an API key, so we return an empty string
    return '';
  }

  public configure(config: any): void {
    if (config.model) {
      this.model = config.model;
    }
    if (config.port) {
      this.port = config.port.toString();
    }
    this.settingsService.updateNestedSetting('localLMStudio', 'modelName', this.model);
    this.settingsService.updateNestedSetting('localLMStudio', 'port', parseInt(this.port, 10));
  }

  public isReady(): boolean {
    return !!this.model && !!this.port;
  }

  public getApiModelName(modelName: string): string | undefined {
    // For LM Studio, the model name is the same as the API model name
    return modelName;
  }

  public updateSettings(): void {
    const localLMStudioSettings = this.settingsService.getSetting('localLMStudio');
    this.model = localLMStudioSettings.modelName;
    this.port = localLMStudioSettings.port.toString();
  }
}