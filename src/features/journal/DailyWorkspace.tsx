import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Check, GripVertical, Plus, Trash2 } from "lucide-react";
import { addLocalDays, formatLocalDate, localDateKey } from "../../shared/date";
import { useJournalStore } from "./JournalContext";
import type { Todo } from "./types";

export function DailyWorkspace({ date, compact = false }: { date: string; compact?: boolean }) {
  const repository = useJournalStore();
  const [entry, setEntry] = useState("");
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [entryDirty, setEntryDirty] = useState(false);
  const [entryStatus, setEntryStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const entryRevision = useRef(0);
  const latestEntry = useRef("");
  const entryDirtyRef = useRef(false);
  const draggedTodo = useRef<string | null>(null);
  const newTodoInput = useRef<HTMLInputElement>(null);

  latestEntry.current = entry;
  entryDirtyRef.current = entryDirty;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [content, nextTodos] = await Promise.all([
        repository.getEntry(date),
        repository.listTodos(date),
      ]);
      setEntry(content);
      setTodos(nextTodos);
      setEntryDirty(false);
      entryDirtyRef.current = false;
      setEntryStatus("idle");
    } catch {
      setError("无法读取这一天的内容，请重试");
    } finally {
      setLoading(false);
    }
  }, [date, repository]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const focusNewTodo = () => newTodoInput.current?.focus();
    window.addEventListener("fangcun:quick-add", focusNewTodo);
    return () => window.removeEventListener("fangcun:quick-add", focusNewTodo);
  }, []);

  useEffect(() => {
    if (!entryDirty) return;
    const savedRevision = entryRevision.current;
    const timer = window.setTimeout(() => {
      setEntryStatus("saving");
      void repository.saveEntry(date, entry)
        .then(() => {
          if (entryRevision.current === savedRevision) setEntryDirty(false);
          if (entryRevision.current === savedRevision) entryDirtyRef.current = false;
          setEntryStatus("saved");
        })
        .catch(() => setEntryStatus("error"));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [date, entry, entryDirty, repository]);

  useEffect(() => {
    const flushEntry = () => {
      if (!entryDirtyRef.current) return;
      const savedRevision = entryRevision.current;
      void repository.saveEntry(date, latestEntry.current).then(() => {
        if (entryRevision.current === savedRevision) entryDirtyRef.current = false;
      });
    };
    window.addEventListener("blur", flushEntry);
    window.addEventListener("pagehide", flushEntry);
    return () => {
      window.removeEventListener("blur", flushEntry);
      window.removeEventListener("pagehide", flushEntry);
      flushEntry();
    };
  }, [date, repository]);

  const addTodo = async (event: FormEvent) => {
    event.preventDefault();
    if (!newTodo.trim()) return;
    try {
      await repository.createTodo(date, newTodo);
      setNewTodo("");
      setTodos(await repository.listTodos(date));
    } catch {
      setError("新增 Todo 失败，请重试");
    }
  };

  const setCompleted = async (todo: Todo, completed: boolean) => {
    setTodos((current) => current.map((item) => item.id === todo.id ? { ...item, isCompleted: completed } : item));
    try {
      await repository.setTodoCompleted(todo.id, completed);
    } catch {
      setTodos((current) => current.map((item) => item.id === todo.id ? todo : item));
      setError("更新 Todo 失败，请重试");
    }
  };

  const updateContent = async (todo: Todo, content: string) => {
    if (!content.trim()) {
      setTodos((current) => current.map((item) => item.id === todo.id ? todo : item));
      return;
    }
    try {
      await repository.updateTodoContent(todo.id, content);
    } catch {
      setTodos((current) => current.map((item) => item.id === todo.id ? todo : item));
      setError("更新 Todo 失败，请重试");
    }
  };

  const moveTodo = async (todo: Todo, targetDate: string) => {
    if (!targetDate || targetDate === date) return;
    try {
      await repository.moveTodo(todo.id, targetDate);
      setTodos((current) => current.filter((item) => item.id !== todo.id));
    } catch {
      setError("移动 Todo 失败，请重试");
    }
  };

  const deleteTodo = async (todo: Todo) => {
    try {
      await repository.deleteTodo(todo.id);
      setTodos((current) => current.filter((item) => item.id !== todo.id));
    } catch {
      setError("删除 Todo 失败，请重试");
    }
  };

  const dropBefore = async (targetId: string) => {
    const sourceId = draggedTodo.current;
    draggedTodo.current = null;
    if (!sourceId || sourceId === targetId) return;
    const reordered = [...todos];
    const sourceIndex = reordered.findIndex((todo) => todo.id === sourceId);
    const targetIndex = reordered.findIndex((todo) => todo.id === targetId);
    const [source] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, source);
    setTodos(reordered.map((todo, index) => ({ ...todo, sortOrder: index })));
    try {
      await repository.reorderTodos(reordered.map((todo) => todo.id));
    } catch {
      setTodos(todos);
      setError("调整顺序失败，请重试");
    }
  };

  const today = localDateKey();
  const tomorrow = addLocalDays(today, 1);

  return (
    <section className={compact ? "daily-workspace compact" : "daily-workspace"} aria-label={formatLocalDate(date)}>
      {error && <div role="alert" className="inline-error"><span>{error}</span><button onClick={() => void load()}>重试</button></div>}
      {loading ? <p className="bookmark-status">正在翻开这一天…</p> : (
        <div className="daily-columns">
          <section className="todo-panel">
            <div className="daily-section-heading">
              <div><p className="eyebrow">TO DO</p><h2>今日清单</h2></div>
              <span>{todos.filter((todo) => todo.isCompleted).length}/{todos.length}</span>
            </div>
            <form className="todo-add-form" onSubmit={(event) => void addTodo(event)}>
              <input ref={newTodoInput} aria-label="新增 Todo" value={newTodo} placeholder="添加一件要做的事…"
                onChange={(event) => setNewTodo(event.target.value)} />
              <button type="submit" className="icon-button" disabled={!newTodo.trim()} aria-label="添加 Todo"><Plus aria-hidden="true" size={17} /></button>
            </form>
            <div className="todo-list">
              {todos.map((todo) => (
                <article key={todo.id} className={todo.isCompleted ? "todo-item completed" : "todo-item"}
                  draggable onDragStart={() => { draggedTodo.current = todo.id; }}
                  onDragOver={(event) => event.preventDefault()} onDrop={() => void dropBefore(todo.id)}>
                  <GripVertical aria-label="拖动排序" className="todo-grip" size={15} />
                  <input type="checkbox" aria-label={`完成 ${todo.content}`} checked={todo.isCompleted}
                    onChange={(event) => void setCompleted(todo, event.target.checked)} />
                  <input className="todo-content" aria-label={`Todo：${todo.content}`} value={todo.content}
                    onChange={(event) => setTodos((current) => current.map((item) => item.id === todo.id ? { ...item, content: event.target.value } : item))}
                    onBlur={(event) => void updateContent(todo, event.target.value)} />
                  <select className="todo-move" aria-label={`移动 ${todo.content} 到日期`} defaultValue=""
                    onChange={(event) => { void moveTodo(todo, event.target.value); event.currentTarget.value = ""; }}>
                    <option value="" disabled>移动</option>
                    {date !== today && <option value={today}>今天</option>}
                    {date !== tomorrow && <option value={tomorrow}>明天</option>}
                  </select>
                  <input className="todo-date-move" type="date" aria-label={`指定 ${todo.content} 的日期`}
                    value={date} onChange={(event) => void moveTodo(todo, event.target.value)} />
                  <button type="button" className="icon-button danger" onClick={() => void deleteTodo(todo)} aria-label={`删除 ${todo.content}`}>
                    <Trash2 aria-hidden="true" size={14} />
                  </button>
                </article>
              ))}
              {todos.length === 0 && <p className="compact-empty">这一天还没有 Todo</p>}
            </div>
          </section>

          <section className="entry-panel">
            <div className="daily-section-heading">
              <div><p className="eyebrow">JOURNAL</p><h2>随笔</h2></div>
              <span role="status" className={`save-status ${entryStatus}`}>
                {entryStatus === "saving" && "保存中…"}
                {entryStatus === "saved" && <><Check aria-hidden="true" size={13} />已保存</>}
                {entryStatus === "error" && "保存失败"}
                {entryStatus === "idle" && "自动保存"}
              </span>
            </div>
            <textarea aria-label="每日随笔" value={entry} placeholder="写下今天的想法、进展或片段…"
              onChange={(event) => {
                latestEntry.current = event.target.value;
                entryRevision.current += 1;
                setEntry(event.target.value);
                setEntryDirty(true);
                entryDirtyRef.current = true;
                setEntryStatus("idle");
              }} />
          </section>
        </div>
      )}
    </section>
  );
}
