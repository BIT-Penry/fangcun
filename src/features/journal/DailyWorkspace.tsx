import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  Check, Clock3, GripVertical, ListPlus, Plus,
  SmilePlus, SlidersHorizontal, Trash2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import { addLocalDays, formatLocalDate, localDateKey } from "../../shared/date";
import { openExternalUrl } from "../../shared/openExternal";
import { EmojiPicker } from "./EmojiPicker";
import { useJournalStore } from "./JournalContext";
import { PriorityBadge } from "./PriorityBadge";
import type { Todo, TodoDetails, TodoPriority } from "./types";

function groupTodos(todos: Todo[]): Todo[] {
  return [...todos].sort((left, right) => (
    Number(left.isCompleted) - Number(right.isCompleted)
    || left.sortOrder - right.sortOrder
  ));
}

export function DailyWorkspace({ date, compact = false, onDataChange }: {
  date: string;
  compact?: boolean;
  onDataChange?: () => void;
}) {
  const repository = useJournalStore();
  const [entry, setEntry] = useState("");
  const [moodEmoji, setMoodEmoji] = useState<string | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState("");
  const [newTodoDueTime, setNewTodoDueTime] = useState("");
  const [newTodoPriority, setNewTodoPriority] = useState<TodoPriority>("low");
  const [showNewTodoDetails, setShowNewTodoDetails] = useState(false);
  const [expandedTodoId, setExpandedTodoId] = useState<string | null>(null);
  const [entryMode, setEntryMode] = useState<"write" | "preview">("write");
  const [showEntryEmojiPicker, setShowEntryEmojiPicker] = useState(false);
  const [showMoodPicker, setShowMoodPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [entryDirty, setEntryDirty] = useState(false);
  const [entryStatus, setEntryStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const entryRevision = useRef(0);
  const latestEntry = useRef("");
  const entryDirtyRef = useRef(false);
  const draggedTodo = useRef<string | null>(null);
  const newTodoInput = useRef<HTMLInputElement>(null);
  const entryInput = useRef<HTMLTextAreaElement>(null);

  latestEntry.current = entry;
  entryDirtyRef.current = entryDirty;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [content, nextMoodEmoji, nextTodos] = await Promise.all([
        repository.getEntry(date),
        repository.getEntryMood(date),
        repository.listTodos(date),
      ]);
      setEntry(content);
      setMoodEmoji(nextMoodEmoji);
      setTodos(groupTodos(nextTodos));
      setEntryMode("write");
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
          onDataChange?.();
        })
        .catch(() => setEntryStatus("error"));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [date, entry, entryDirty, onDataChange, repository]);

  useEffect(() => {
    const flushEntry = () => {
      if (!entryDirtyRef.current) return;
      const savedRevision = entryRevision.current;
      void repository.saveEntry(date, latestEntry.current).then(() => {
        if (entryRevision.current === savedRevision) entryDirtyRef.current = false;
        onDataChange?.();
      });
    };
    window.addEventListener("blur", flushEntry);
    window.addEventListener("pagehide", flushEntry);
    return () => {
      window.removeEventListener("blur", flushEntry);
      window.removeEventListener("pagehide", flushEntry);
      flushEntry();
    };
  }, [date, onDataChange, repository]);

  const changeEntry = (value: string) => {
    latestEntry.current = value;
    entryRevision.current += 1;
    setEntry(value);
    setEntryDirty(true);
    entryDirtyRef.current = true;
    setEntryStatus("idle");
  };

  const addTodo = async (event: FormEvent) => {
    event.preventDefault();
    if (!newTodo.trim()) return;
    try {
      await repository.createTodo(date, newTodo, {
        dueTime: newTodoDueTime || null,
        priority: newTodoPriority,
      });
      setNewTodo("");
      setNewTodoDueTime("");
      setNewTodoPriority("low");
      setShowNewTodoDetails(false);
      setTodos(groupTodos(await repository.listTodos(date)));
      onDataChange?.();
    } catch {
      setError("新增 Todo 失败，请重试");
    }
  };

  const setCompleted = async (todo: Todo, completed: boolean) => {
    setTodos((current) => {
      const lastOrder = current.reduce((maximum, item) => Math.max(maximum, item.sortOrder), -1);
      return groupTodos(current.map((item) => (
        item.id === todo.id
          ? { ...item, isCompleted: completed, sortOrder: completed ? lastOrder + 1 : item.sortOrder }
          : item
      )));
    });
    try {
      await repository.setTodoCompleted(todo.id, completed);
      onDataChange?.();
    } catch {
      setTodos((current) => groupTodos(current.map((item) => item.id === todo.id ? todo : item)));
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

  const updateDetails = async (todo: Todo, details: TodoDetails) => {
    setTodos((current) => current.map((item) => item.id === todo.id ? { ...item, ...details } : item));
    try {
      await repository.updateTodoDetails(todo.id, details);
      onDataChange?.();
    } catch {
      setTodos((current) => current.map((item) => item.id === todo.id ? todo : item));
      setError("更新 Todo 详情失败，请重试");
    }
  };

  const moveTodo = async (todo: Todo, targetDate: string) => {
    if (!targetDate || targetDate === date) return;
    try {
      await repository.moveTodo(todo.id, targetDate);
      setTodos((current) => current.filter((item) => item.id !== todo.id));
      onDataChange?.();
    } catch {
      setError("移动 Todo 失败，请重试");
    }
  };

  const deleteTodo = async (todo: Todo) => {
    try {
      await repository.deleteTodo(todo.id);
      setTodos((current) => current.filter((item) => item.id !== todo.id));
      onDataChange?.();
    } catch {
      setError("删除 Todo 失败，请重试");
    }
  };

  const dropBefore = async (targetId: string) => {
    const sourceId = draggedTodo.current;
    draggedTodo.current = null;
    if (!sourceId || sourceId === targetId) return;
    const sourceTodo = todos.find((todo) => todo.id === sourceId);
    const targetTodo = todos.find((todo) => todo.id === targetId);
    if (!sourceTodo || !targetTodo || sourceTodo.isCompleted !== targetTodo.isCompleted) return;
    const reordered = [...todos];
    const sourceIndex = reordered.findIndex((todo) => todo.id === sourceId);
    const targetIndex = reordered.findIndex((todo) => todo.id === targetId);
    const [source] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, source);
    const withOrder = reordered.map((todo, index) => ({ ...todo, sortOrder: index }));
    setTodos(withOrder);
    try {
      await repository.reorderTodos(withOrder.map((todo) => todo.id));
    } catch {
      setTodos(todos);
      setError("调整顺序失败，请重试");
    }
  };

  const chooseMood = async (emoji: string | null) => {
    const previousMood = moodEmoji;
    setMoodEmoji(emoji);
    setShowMoodPicker(false);
    try {
      await repository.setEntryMood(date, emoji);
      onDataChange?.();
    } catch {
      setMoodEmoji(previousMood);
      setError("保存今日状态失败，请重试");
    }
  };

  const insertEmoji = (emoji: string) => {
    const input = entryInput.current;
    const start = input?.selectionStart ?? entry.length;
    const end = input?.selectionEnd ?? entry.length;
    const nextEntry = `${entry.slice(0, start)}${emoji}${entry.slice(end)}`;
    changeEntry(nextEntry);
    setShowEntryEmojiPicker(false);
    setEntryMode("write");
    window.setTimeout(() => {
      entryInput.current?.focus();
      entryInput.current?.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  };

  const openMarkdownLink = (href: string | undefined) => {
    if (!href) return;
    void openExternalUrl(href).catch(() => setError("无法打开这个链接"));
  };

  const today = localDateKey();
  const tomorrow = addLocalDays(today, 1);
  const openTodos = todos.filter((todo) => !todo.isCompleted);
  const completedTodos = todos.filter((todo) => todo.isCompleted);

  const renderTodo = (todo: Todo) => {
    const displayPriority = todo.priority ?? "low";
    return (
    <article key={todo.id} className={todo.isCompleted ? "todo-item completed" : "todo-item"}
      draggable onDragStart={() => { draggedTodo.current = todo.id; }}
      onDragOver={(event) => event.preventDefault()} onDrop={() => void dropBefore(todo.id)}>
      <div className="todo-main">
        <GripVertical aria-label="拖动排序" className="todo-grip" size={15} />
        <input type="checkbox" aria-label={`完成 ${todo.content}`} checked={todo.isCompleted}
          onChange={(event) => void setCompleted(todo, event.target.checked)} />
        <div className="todo-copy">
          <input className="todo-content" aria-label={`Todo：${todo.content}`} value={todo.content}
            onChange={(event) => setTodos((current) => current.map((item) => (
              item.id === todo.id ? { ...item, content: event.target.value } : item
            )))}
            onBlur={(event) => void updateContent(todo, event.target.value)} />
          <div className="todo-meta">
            {todo.dueTime && <span><Clock3 aria-hidden="true" size={11} />{todo.dueTime}</span>}
            <PriorityBadge priority={displayPriority} />
          </div>
        </div>
        <button type="button" className={expandedTodoId === todo.id ? "icon-button active" : "icon-button"}
          onClick={() => setExpandedTodoId((current) => current === todo.id ? null : todo.id)}
          aria-expanded={expandedTodoId === todo.id} aria-label={`任务详情 ${todo.content}`}>
          <SlidersHorizontal aria-hidden="true" size={14} />
        </button>
        <button type="button" className="icon-button danger" onClick={() => void deleteTodo(todo)} aria-label={`删除 ${todo.content}`}>
          <Trash2 aria-hidden="true" size={14} />
        </button>
      </div>
      {expandedTodoId === todo.id && (
        <div className="todo-details-editor">
          <label>截止时刻
            <input type="time" aria-label={`设置 ${todo.content} 的截止时刻`} value={todo.dueTime ?? ""}
              onChange={(event) => void updateDetails(todo, { dueTime: event.target.value || null, priority: displayPriority })} />
          </label>
          <label>优先级
            <select aria-label={`设置 ${todo.content} 的优先级`} value={displayPriority}
              onChange={(event) => void updateDetails(todo, { dueTime: todo.dueTime, priority: event.target.value as TodoPriority })}>
              <option value="high">P1 · 高</option><option value="medium">P2 · 中</option><option value="low">P3 · 低</option>
            </select>
          </label>
          <label>移动到
            <select aria-label={`移动 ${todo.content} 到日期`} defaultValue=""
              onChange={(event) => { void moveTodo(todo, event.target.value); event.currentTarget.value = ""; }}>
              <option value="" disabled>快捷日期</option>
              {date !== today && <option value={today}>今天</option>}
              {date !== tomorrow && <option value={tomorrow}>明天</option>}
            </select>
          </label>
          <label>指定日期
            <input type="date" aria-label={`指定 ${todo.content} 的日期`} value={date}
              onChange={(event) => void moveTodo(todo, event.target.value)} />
          </label>
        </div>
      )}
    </article>
    );
  };

  return (
    <section className={compact ? "daily-workspace compact" : "daily-workspace"} aria-label={formatLocalDate(date)}>
      {error && <div role="alert" className="inline-error"><span>{error}</span><button onClick={() => void load()}>重试</button></div>}
      {loading ? <p className="bookmark-status">正在翻开这一天…</p> : (
        <div className="daily-columns">
          <section className="todo-panel">
            <div className="daily-section-heading">
              <div><h2>今日清单</h2></div>
              <span>{completedTodos.length}/{todos.length}</span>
            </div>
            <form className="todo-add-form" onSubmit={(event) => void addTodo(event)}>
              <div className="todo-add-main">
                <input ref={newTodoInput} aria-label="新增 Todo" value={newTodo} placeholder="添加一件要做的事…"
                  onChange={(event) => setNewTodo(event.target.value)} />
                <button type="button" className={showNewTodoDetails ? "icon-button active" : "icon-button"}
                  aria-expanded={showNewTodoDetails} aria-label="添加截止时刻和优先级"
                  onClick={() => setShowNewTodoDetails((current) => !current)}>
                  <ListPlus aria-hidden="true" size={16} />
                </button>
                <button type="submit" className="icon-button" disabled={!newTodo.trim()} aria-label="添加 Todo"><Plus aria-hidden="true" size={17} /></button>
              </div>
              {showNewTodoDetails && (
                <div className="todo-add-details">
                  <label>截止时刻<input type="time" aria-label="新 Todo 截止时刻" value={newTodoDueTime}
                    onChange={(event) => setNewTodoDueTime(event.target.value)} /></label>
                  <label>优先级<select aria-label="新 Todo 优先级" value={newTodoPriority}
                    onChange={(event) => setNewTodoPriority(event.target.value as TodoPriority)}>
                    <option value="high">P1 · 高</option><option value="medium">P2 · 中</option><option value="low">P3 · 低（默认）</option>
                  </select></label>
                </div>
              )}
            </form>
            <div className="todo-list">
              {openTodos.map(renderTodo)}
              {completedTodos.length > 0 && (
                <div className="todo-completed-heading"><span>已完成</span><span>{completedTodos.length}</span></div>
              )}
              {completedTodos.map(renderTodo)}
              {todos.length === 0 && <p className="compact-empty">这一天还没有 Todo</p>}
            </div>
          </section>

          <section className="entry-panel">
            <div className="daily-section-heading">
              <div><h2>随笔</h2></div>
              <div className="entry-heading-actions">
                <button type="button" className={moodEmoji ? "mood-button selected" : "mood-button"}
                  onClick={() => { setShowMoodPicker((current) => !current); setShowEntryEmojiPicker(false); }}
                  aria-expanded={showMoodPicker} aria-label={moodEmoji ? `今日状态 ${moodEmoji}` : "选择今日状态"}>
                  {moodEmoji ?? <SmilePlus aria-hidden="true" size={15} />}
                </button>
                <span role="status" className={`save-status ${entryStatus}`}>
                  {entryStatus === "saving" && "保存中…"}
                  {entryStatus === "saved" && <><Check aria-hidden="true" size={13} />已保存</>}
                  {entryStatus === "error" && "保存失败"}
                  {entryStatus === "idle" && "自动保存"}
                </span>
              </div>
            </div>
            {showMoodPicker && (
              <div className="entry-picker-wrap">
                {moodEmoji && <button type="button" className="clear-mood-button" onClick={() => void chooseMood(null)}>清除今日状态</button>}
                <EmojiPicker actionLabel="设为今日状态" onSelect={(emoji) => void chooseMood(emoji)} />
              </div>
            )}
            <div className="entry-toolbar" aria-label="随笔工具栏">
              <div className="editor-mode-switch">
                <button type="button" className={entryMode === "write" ? "active" : ""} onClick={() => setEntryMode("write")}>编辑</button>
                <button type="button" className={entryMode === "preview" ? "active" : ""} onClick={() => setEntryMode("preview")}>预览</button>
              </div>
              <button type="button" className={showEntryEmojiPicker ? "icon-button active" : "icon-button"}
                onClick={() => { setShowEntryEmojiPicker((current) => !current); setShowMoodPicker(false); }}
                aria-expanded={showEntryEmojiPicker} aria-label="插入 Emoji">
                <SmilePlus aria-hidden="true" size={15} />
              </button>
            </div>
            {showEntryEmojiPicker && <EmojiPicker actionLabel="插入表情" onSelect={insertEmoji} />}
            {entryMode === "write" ? (
              <textarea ref={entryInput} aria-label="每日随笔" value={entry} placeholder="用 Markdown 写下今天的想法、进展或片段…"
                onChange={(event) => changeEntry(event.target.value)} />
            ) : (
              <div className="markdown-preview" aria-label="Markdown 预览">
                {entry.trim() ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]} rehypePlugins={[rehypeKatex]} components={{
                    a: ({ href, children }) => <a href={href} onClick={(event) => { event.preventDefault(); openMarkdownLink(href); }}>{children}</a>,
                  }}>{entry}</ReactMarkdown>
                ) : <p className="markdown-empty">还没有内容，切换到编辑开始书写。</p>}
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
