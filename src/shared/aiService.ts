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

export interface FormattedPromptContent {
  content: string;
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

export function formatPromptContent(content: string): Promise<FormattedPromptContent> {
  return invoke<FormattedPromptContent>("format_prompt_content", { content });
}

export function formatSkillContent(content: string): Promise<FormattedPromptContent> {
  return invoke<FormattedPromptContent>("format_skill_content", { content });
}

export function generateSkillDescription(name: string, content: string): Promise<{ description: string }> {
  return invoke<{ description: string }>("generate_skill_description", { name, content });
}

export interface SkillTagSuggestionInput {
  id: string;
  name: string;
  description: string;
  content: string;
}

export function generateSkillTags(skills: SkillTagSuggestionInput[], existingTags: string[] = []): Promise<{
  skills: Array<{ id: string; tags: string[] }>;
}> {
  return invoke("generate_skill_tags", { skills, existingTags });
}
