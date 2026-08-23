import { invoke } from "@tauri-apps/api/core";

export type AiProviderId = "deepseek" | "kimi" | "openai" | "custom";

export interface AiServiceConfig {
  configured: boolean;
  provider: AiProviderId;
  displayName: string;
  baseUrl: string;
  model: string;
}

export interface AiServiceInput {
  provider: AiProviderId;
  displayName: string;
  baseUrl: string;
  model: string;
  apiKey: string;
}

export function getAiServiceConfig(): Promise<AiServiceConfig> {
  return invoke<AiServiceConfig>("get_ai_service_config");
}

export function saveAiServiceConfig(input: AiServiceInput): Promise<void> {
  return invoke("save_ai_service_config", { input });
}

export function deleteAiServiceConfig(): Promise<void> {
  return invoke("delete_ai_service_config");
}
