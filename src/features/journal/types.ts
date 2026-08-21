export interface Todo {
  id: string;
  date: string;
  content: string;
  isCompleted: boolean;
  sortOrder: number;
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
  saveEntry(date: string, content: string): Promise<void>;
  listTodos(date: string): Promise<Todo[]>;
  createTodo(date: string, content: string): Promise<string>;
  updateTodoContent(id: string, content: string): Promise<void>;
  setTodoCompleted(id: string, completed: boolean): Promise<void>;
  moveTodo(id: string, date: string): Promise<void>;
  reorderTodos(ids: string[]): Promise<void>;
  deleteTodo(id: string): Promise<void>;
  searchJournal(query: string, limit?: number): Promise<JournalSearchHit[]>;
}
