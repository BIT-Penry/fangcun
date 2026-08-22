import { invoke } from "@tauri-apps/api/core";

export interface DeepSeekStatus {
  configured: boolean;
}

export function getDeepSeekStatus(): Promise<DeepSeekStatus> {
  return invoke<DeepSeekStatus>("get_deepseek_status");
}

export function saveDeepSeekApiKey(apiKey: string): Promise<void> {
  return invoke("save_deepseek_api_key", { apiKey });
}

export function deleteDeepSeekApiKey(): Promise<void> {
  return invoke("delete_deepseek_api_key");
}
