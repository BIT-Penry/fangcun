export type TodoPriority = "low" | "medium" | "high";

export interface TodoDetails {
  dueTime: string | null;
  priority: TodoPriority | null;
}

export interface Todo {
  id: string;
  date: string;
  content: string;
  isCompleted: boolean;
  sortOrder: number;
  dueTime: string | null;
  priority: TodoPriority | null;
  createdAt: string;
  updatedAt: string;
}

export interface JournalSearchHit {
  id: string;
  date: string;
  content: string;
  kind: "entry" | "todo";
}

export interface JournalStore {
  getEntry(date: string): Promise<string>;
  getEntryMood(date: string): Promise<string | null>;
  saveEntry(date: string, content: string): Promise<void>;
  setEntryMood(date: string, moodEmoji: string | null): Promise<void>;
  listTodos(date: string): Promise<Todo[]>;
  createTodo(date: string, content: string, details?: Partial<TodoDetails>): Promise<string>;
  updateTodoContent(id: string, content: string): Promise<void>;
  updateTodoDetails(id: string, details: TodoDetails): Promise<void>;
  setTodoCompleted(id: string, completed: boolean): Promise<void>;
  moveTodo(id: string, date: string): Promise<void>;
  reorderTodos(ids: string[]): Promise<void>;
  deleteTodo(id: string): Promise<void>;
  searchJournal(query: string, limit?: number): Promise<JournalSearchHit[]>;
}
