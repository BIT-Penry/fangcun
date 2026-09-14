import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight, BookOpenText, Bookmark, Check, ChevronRight, Clock3, Inbox,
  MessageSquareText, Plus, Search,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { useBookmarksStore } from "../bookmarks/BookmarksContext";
import type { Bookmark as SavedBookmark } from "../bookmarks/types";
import { useJournalStore } from "../journal/JournalContext";
import { PriorityBadge } from "../journal/PriorityBadge";
import type { Todo, TodoPriority } from "../journal/types";
import { usePromptsStore } from "../prompts/PromptsContext";
import type { Prompt } from "../prompts/types";
import { formatLocalDate, localDateKey } from "../../shared/date";

const PRIORITY_ORDER: Record<TodoPriority, number> = { high: 0, medium: 1, low: 2 };

type RecentItem = {
  id: string;
  kind: "bookmark" | "prompt";
  title: string;
  detail: string;
  updatedAt: string;
};

function compactText(value: string | null | undefined, fallback: string) {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function formatRecentDate(value: string, today: string) {
  const date = value.slice(0, 10);
  if (date === today) return "今天";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(parsed);
}

function bookmarkLocation(bookmark: SavedBookmark) {
  if (bookmark.folderName) return bookmark.folderName;
  try {
    return new URL(bookmark.url).hostname.replace(/^www\./, "");
  } catch {
    return "书签";
  }
}

export function HomePage() {
  const today = localDateKey();
  const bookmarksRepository = useBookmarksStore();
  const promptsRepository = usePromptsStore();
  const journalRepository = useJournalStore();
  const navigate = useNavigate();
  const firstQuickActionRef = useRef<HTMLButtonElement>(null);
  const [bookmarks, setBookmarks] = useState<SavedBookmark[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [entry, setEntry] = useState("");
  const [mood, setMood] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextBookmarks, nextPrompts, nextTodos, nextEntry, nextMood] = await Promise.all([
        bookmarksRepository.listBookmarks(),
        promptsRepository.listPrompts(),
        journalRepository.listTodos(today),
        journalRepository.getEntry(today),
        journalRepository.getEntryMood(today),
      ]);
      setBookmarks(nextBookmarks);
      setPrompts(nextPrompts);
      setTodos(nextTodos);
      setEntry(nextEntry);
      setMood(nextMood);
    } catch {
      setError("首页内容暂时无法读取");
    } finally {
      setLoading(false);
    }
  }, [bookmarksRepository, journalRepository, promptsRepository, today]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const focusQuickAdd = () => firstQuickActionRef.current?.focus();
    window.addEventListener("fangcun:quick-add", focusQuickAdd);
    return () => window.removeEventListener("fangcun:quick-add", focusQuickAdd);
  }, []);

  const recentItems = useMemo<RecentItem[]>(() => [
    ...bookmarks.map((bookmark) => ({
      id: bookmark.id,
      kind: "bookmark" as const,
      title: bookmark.title,
      detail: bookmarkLocation(bookmark),
      updatedAt: bookmark.updatedAt ?? bookmark.createdAt ?? "",
    })),
    ...prompts.map((prompt) => ({
      id: prompt.id,
      kind: "prompt" as const,
      title: prompt.title,
      detail: prompt.tags.slice(0, 2).join(" · ") || compactText(prompt.content, "提示词"),
      updatedAt: prompt.updatedAt ?? prompt.createdAt ?? "",
    })),
  ].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).slice(0, 5), [bookmarks, prompts]);

  const focusTodos = useMemo(() => todos
    .filter((todo) => !todo.isCompleted)
    .sort((left, right) => (
      PRIORITY_ORDER[left.priority ?? "low"] - PRIORITY_ORDER[right.priority ?? "low"]
      || (left.dueTime ?? "99:99").localeCompare(right.dueTime ?? "99:99")
      || left.sortOrder - right.sortOrder
    ))
    .slice(0, 3), [todos]);

  const openQuickAdd = (path: "/bookmarks" | "/prompts" | "/journal") => {
    navigate(path === "/journal" ? `/journal?date=${today}` : path);
    if (path !== "/journal") {
      window.setTimeout(() => window.dispatchEvent(new CustomEvent("fangcun:quick-add")), 0);
    }
  };

  const completeTodo = async (todo: Todo) => {
    setTodos((current) => current.map((item) => item.id === todo.id ? { ...item, isCompleted: true } : item));
    try {
      await journalRepository.setTodoCompleted(todo.id, true);
    } catch {
      setTodos((current) => current.map((item) => item.id === todo.id ? todo : item));
      setError("任务状态没有保存，请重试");
    }
  };

  const unfiledBookmarks = bookmarks.filter((bookmark) => !bookmark.folderId).length;
  const untaggedPrompts = prompts.filter((prompt) => prompt.tags.length === 0).length;
  const hasEntry = entry.trim().length > 0;

  return (
    <section className="home-page">
      <header className="home-header home-start-header">
        <div>
          <h1>今天</h1>
          <p className="page-description">{formatLocalDate(today)}</p>
        </div>
        <Link className="journal-link" to={`/journal?date=${today}`}>打开今日日记 <ArrowRight aria-hidden="true" size={15} /></Link>
      </header>

      <div className="home-command-row">
        <button type="button" className="home-search-trigger"
          onClick={() => window.dispatchEvent(new CustomEvent("fangcun:open-search"))}>
          <Search aria-hidden="true" size={18} />
          <span>搜索书签、提示词和日记</span>
          <kbd>⌘K</kbd>
        </button>
        <div className="home-quick-actions" aria-label="快速添加">
          <button ref={firstQuickActionRef} type="button" onClick={() => openQuickAdd("/bookmarks")}><Plus aria-hidden="true" size={15} />书签</button>
          <button type="button" onClick={() => openQuickAdd("/prompts")}><Plus aria-hidden="true" size={15} />提示词</button>
          <button type="button" onClick={() => openQuickAdd("/journal")}><Plus aria-hidden="true" size={15} />今日一笔</button>
        </div>
      </div>

      {error && <div role="alert" className="inline-error"><span>{error}</span><button onClick={() => void load()}>重新读取</button></div>}

      {loading ? (
        <div className="home-loading" aria-label="正在整理首页">
          <span /><span /><span /><span />
        </div>
      ) : (
        <>
          <div className="home-workbench">
            <section className="home-recent-section" aria-labelledby="home-recent-title">
              <header className="home-section-heading">
                <div><h2 id="home-recent-title">继续处理</h2><p>最近整理过的内容</p></div>
              </header>
              <div className="home-recent-list">
                {recentItems.map((item) => {
                  const ItemIcon = item.kind === "bookmark" ? Bookmark : MessageSquareText;
                  return (
                    <Link key={`${item.kind}-${item.id}`}
                      to={item.kind === "bookmark" ? `/bookmarks?edit=${encodeURIComponent(item.id)}` : `/prompts?open=${encodeURIComponent(item.id)}`}
                      className="home-recent-item">
                      <span className={`home-recent-icon ${item.kind}`}><ItemIcon aria-hidden="true" size={16} /></span>
                      <span className="home-recent-copy"><strong>{item.title}</strong><small>{item.detail}</small></span>
                      <span className="home-recent-date">{formatRecentDate(item.updatedAt, today)}</span>
                      <ChevronRight aria-hidden="true" size={15} />
                    </Link>
                  );
                })}
                {recentItems.length === 0 && <p className="home-empty">保存一个书签或提示词后，会从这里继续。</p>}
              </div>
            </section>

            <aside className="home-focus-section" aria-labelledby="home-focus-title">
              <header className="home-section-heading">
                <div><h2 id="home-focus-title">今日焦点</h2><p>最多保留三件事</p></div>
                <Link to={`/journal?date=${today}`} aria-label="查看今天的全部任务"><ChevronRight aria-hidden="true" size={17} /></Link>
              </header>
              <div className="home-focus-list">
                {focusTodos.map((todo) => {
                  const priority = todo.priority ?? "low";
                  return (
                    <article key={todo.id} className="home-focus-item">
                      <button type="button" onClick={() => void completeTodo(todo)} aria-label={`完成 ${todo.content}`}>
                        <Check aria-hidden="true" size={13} />
                      </button>
                      <div><strong>{todo.content}</strong><span>
                        {todo.dueTime && <small><Clock3 aria-hidden="true" size={11} />{todo.dueTime}</small>}
                        <PriorityBadge priority={priority} />
                      </span></div>
                    </article>
                  );
                })}
                {focusTodos.length === 0 && <p className="home-empty">今天没有待办，可以从一条记录开始。</p>}
              </div>
            </aside>
          </div>

          <div className="home-secondary-row">
            <section className="home-inbox-section" aria-labelledby="home-inbox-title">
              <span className="home-secondary-icon"><Inbox aria-hidden="true" size={17} /></span>
              <div><h2 id="home-inbox-title">待整理</h2><p>把新收下的内容放回合适的位置。</p></div>
              <div className="home-inbox-links">
                <Link to="/bookmarks">{unfiledBookmarks} 条未归档书签</Link>
                <Link to="/prompts">{untaggedPrompts} 条未标记提示词</Link>
              </div>
            </section>

            <section className="home-note-section" aria-labelledby="home-note-title">
              <span className="home-note-mood" aria-label={mood ? `今日状态 ${mood}` : "尚未选择今日状态"}>{mood || <BookOpenText aria-hidden="true" size={18} />}</span>
              <div>
                <h2 id="home-note-title">今日一笔</h2>
                {hasEntry ? (
                  <div className="home-note-preview" aria-label="今日一笔 Markdown 预览">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      components={{
                        a: ({ children }) => <span>{children}</span>,
                      }}
                    >{entry}</ReactMarkdown>
                  </div>
                ) : <p>今天还没有留下记录</p>}
              </div>
              <Link to={`/journal?date=${today}`}>继续记录 <ArrowRight aria-hidden="true" size={14} /></Link>
            </section>
          </div>
        </>
      )}
    </section>
  );
}
