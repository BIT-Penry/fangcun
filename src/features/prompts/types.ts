export interface Prompt {
  id: string;
  title: string;
  content: string;
  notes: string;
  isFavorite: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PromptInput {
  title: string;
  content: string;
  notes: string;
  isFavorite: boolean;
  tags: string[];
}

export interface PromptsStore {
  listPrompts(): Promise<Prompt[]>;
  createPrompt(input: PromptInput): Promise<string>;
  updatePrompt(id: string, input: PromptInput): Promise<void>;
  deletePrompt(id: string): Promise<void>;
  searchPrompts(query: string, limit?: number): Promise<Prompt[]>;
}
