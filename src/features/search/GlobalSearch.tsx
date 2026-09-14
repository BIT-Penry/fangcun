import { useEffect, useRef, useState, type ReactNode } from "react";
import { BookOpen, Bookmark, Boxes, CheckSquare, MessageSquareText, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useBookmarksStore } from "../bookmarks/BookmarksContext";
import type { Bookmark as BookmarkItem } from "../bookmarks/types";
import { useJournalStore } from "../journal/JournalContext";
import type { JournalSearchHit } from "../journal/types";
import { usePromptsStore } from "../prompts/PromptsContext";
import type { Prompt } from "../prompts/types";
import { useSkillsStore } from "../skills/SkillsContext";
import type { Skill } from "../skills/types";

interface SearchResults {
  bookmarks: BookmarkItem[];
  prompts: Prompt[];
  skills: Skill[];
  journal: JournalSearchHit[];
}

const EMPTY_RESULTS: SearchResults = { bookmarks: [], prompts: [], skills: [], journal: [] };

export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const bookmarksRepository = useBookmarksStore();
  const promptsRepository = usePromptsStore();
  const skillsRepository = useSkillsStore();
  const journalRepository = useJournalStore();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [status, setStatus] = useState<"idle" | "searching" | "error">("idle");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults(EMPTY_RESULTS);
    setStatus("idle");
    window.setTimeout(() => input.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!open || !trimmed) {
      setResults(EMPTY_RESULTS);
      setStatus("idle");
      return;
    }
    let active = true;
    setStatus("searching");
    const timer = window.setTimeout(() => {
      void Promise.all([
        bookmarksRepository.searchBookmarks(trimmed, 5),
        promptsRepository.searchPrompts(trimmed, 5),
        skillsRepository.searchSkills(trimmed, 5),
        journalRepository.searchJournal(trimmed, 8),
      ]).then(([bookmarks, prompts, skills, journal]) => {
        if (!active) return;
        setResults({ bookmarks, prompts, skills, journal });
        setStatus("idle");
      }).catch(() => active && setStatus("error"));
    }, 160);
    return () => { active = false; window.clearTimeout(timer); };
  }, [bookmarksRepository, journalRepository, open, promptsRepository, query, skillsRepository]);

  if (!open) return null;
  const resultCount = results.bookmarks.length + results.prompts.length + results.skills.length + results.journal.length;
  const go = (path: string) => { navigate(path); onClose(); };

  return (
    <div className="dialog-backdrop search-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="global-search-title" className="global-search">
        <h2 id="global-search-title" className="sr-only">全局搜索</h2>
        <div className="global-search-input">
          <Search aria-hidden="true" size={19} />
          <input ref={input} type="search" aria-label="搜索方寸" value={query} placeholder="搜索书签、提示词、Skill、随笔和 Todo…" onChange={(event) => setQuery(event.target.value)} />
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭搜索"><X aria-hidden="true" size={17} /></button>
        </div>
        <div className="global-search-results">
          {!query.trim() && <div className="search-guidance"><span>输入关键词开始检索本地资料</span><kbd>ESC</kbd></div>}
          {status === "searching" && <p className="compact-empty">正在搜索…</p>}
          {status === "error" && <p role="alert" className="compact-empty search-error">搜索失败，请稍后重试</p>}
          {status === "idle" && query.trim() && resultCount === 0 && <p className="compact-empty">没有找到相关内容</p>}
          {results.bookmarks.length > 0 && <SearchGroup title="书签" icon={<Bookmark aria-hidden="true" size={14} />} onAll={() => go("/bookmarks")}>
            {results.bookmarks.map((bookmark) => <button key={bookmark.id} type="button" className="search-result" onClick={() => go("/bookmarks")}><strong>{bookmark.title}</strong><span>{bookmark.url}</span></button>)}
          </SearchGroup>}
          {results.prompts.length > 0 && <SearchGroup title="提示词" icon={<MessageSquareText aria-hidden="true" size={14} />} onAll={() => go("/prompts")}>
            {results.prompts.map((prompt) => <button key={prompt.id} type="button" className="search-result" onClick={() => go("/prompts")}><strong>{prompt.title || "未命名提示词"}</strong><span>{prompt.content.replace(/\s+/g, " ").slice(0, 100)}</span></button>)}
          </SearchGroup>}
          {results.skills.length > 0 && <SearchGroup title="技能库" icon={<Boxes aria-hidden="true" size={14} />} onAll={() => go("/skills")}>
            {results.skills.map((skill) => <button key={skill.id} type="button" className="search-result" onClick={() => go(`/skills/${skill.id}`)}><strong>{skill.name}</strong><span>{skill.description || skill.content.replace(/\s+/g, " ").slice(0, 100)}</span></button>)}
          </SearchGroup>}
          {results.journal.length > 0 && <SearchGroup title="日记" icon={<BookOpen aria-hidden="true" size={14} />} onAll={() => go("/journal")}>
            {results.journal.map((hit) => <button key={`${hit.kind}-${hit.id}`} type="button" className="search-result" onClick={() => go("/journal")}><strong>{hit.kind === "todo" ? <><CheckSquare aria-hidden="true" size={13} /> Todo · {hit.date}</> : `随笔 · ${hit.date}`}</strong><span>{hit.content.replace(/\s+/g, " ").slice(0, 100)}</span></button>)}
          </SearchGroup>}
        </div>
      </section>
    </div>
  );
}

function SearchGroup({ title, icon, onAll, children }: {
  title: string;
  icon: ReactNode;
  onAll: () => void;
  children: ReactNode;
}) {
  return <section className="search-group"><header><span>{icon}{title}</span><button type="button" onClick={onAll}>查看全部</button></header>{children}</section>;
}
