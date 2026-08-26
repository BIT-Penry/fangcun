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

export interface JournalMonthSummary {
  entryDays: number;
  todoCount: number;
  completedTodoCount: number;
  p1TodoCount: number;
  p2TodoCount: number;
  p3TodoCount: number;
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
  getMonthSummary(startDate: string, endDate: string): Promise<JournalMonthSummary>;
  getOpenTodoCounts(startDate: string, endDate: string): Promise<Record<string, number>>;
  searchJournal(query: string, limit?: number): Promise<JournalSearchHit[]>;
}
