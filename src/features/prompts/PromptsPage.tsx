import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Clipboard, Plus, Search, Star, Tag, Trash2, X } from "lucide-react";
import { usePromptsStore } from "./PromptsContext";
import type { Prompt, PromptInput } from "./types";
import { useSessionState } from "../../shared/useSessionState";

interface PromptDraft extends PromptInput { id: string | null }

const EMPTY_DRAFT: PromptDraft = {
  id: null, title: "", content: "", notes: "", isFavorite: false, tags: [],
};

function toDraft(prompt: Prompt): PromptDraft {
  return {
    id: prompt.id,
    title: prompt.title,
    content: prompt.content,
    notes: prompt.notes,
    isFavorite: prompt.isFavorite,
    tags: prompt.tags,
  };
}

export function PromptsPage() {
  const repository = usePromptsStore();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [draft, setDraft] = useState<PromptDraft | null>(null);
  const [tagsText, setTagsText] = useState("");
  const [search, setSearch] = useSessionState("fangcun:prompts:search", "");
  const [tagFilter, setTagFilter] = useSessionState("fangcun:prompts:tag", "");
  const [favoriteOnly, setFavoriteOnly] = useSessionState("fangcun:prompts:favorites", false);
  const [loadError, setLoadError] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const revision = useRef(0);
  const latestDraft = useRef<PromptDraft | null>(null);
  const latestTagsText = useRef("");
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const pendingFlush = useRef(false);
  const flushPromptRef = useRef<() => Promise<void>>(async () => undefined);

  latestDraft.current = draft;
  latestTagsText.current = tagsText;
  dirtyRef.current = dirty;

  const load = useCallback(async () => {
    try {
      setLoadError("");
      setPrompts(await repository.listPrompts());
    } catch {
      setLoadError("无法读取本地提示词，请重试");
    }
  }, [repository]);

  useEffect(() => { void load(); }, [load]);

  const selectPrompt = (prompt: Prompt) => {
    setDraft(toDraft(prompt));
    setTagsText(prompt.tags.join(", "));
    setDirty(false);
    setSaveStatus("idle");
  };

  const startNewPrompt = useCallback(() => {
    setDraft({ ...EMPTY_DRAFT });
    setTagsText("");
    setDirty(false);
    setSaveStatus("idle");
  }, []);

  useEffect(() => {
    window.addEventListener("fangcun:quick-add", startNewPrompt);
    return () => window.removeEventListener("fangcun:quick-add", startNewPrompt);
  }, [startNewPrompt]);

  const changeDraft = (patch: Partial<PromptDraft>) => {
    revision.current += 1;
    setDraft((current) => current ? { ...current, ...patch } : current);
    setDirty(true);
    setSaveStatus("idle");
    if (savingRef.current) pendingFlush.current = true;
  };

  const flushPrompt = useCallback(async () => {
    const current = latestDraft.current;
    if (!current || !dirtyRef.current || !current.content.trim()) return;
    if (savingRef.current) {
      pendingFlush.current = true;
      return;
    }
    const snapshot = {
      ...current,
      tags: latestTagsText.current.split(",").map((tag) => tag.trim()).filter(Boolean),
    };
    const savedRevision = revision.current;
    savingRef.current = true;
    setSaving(true);
    setSaveStatus("saving");
    try {
      const id = snapshot.id
        ? await repository.updatePrompt(snapshot.id, snapshot).then(() => snapshot.id as string)
        : await repository.createPrompt(snapshot);
      setDraft((value) => value && !value.id ? { ...value, id } : value);
      if (revision.current === savedRevision) {
        dirtyRef.current = false;
        setDirty(false);
      }
      setSaveStatus("saved");
      await load();
    } catch {
      setSaveStatus("error");
    } finally {
      savingRef.current = false;
      setSaving(false);
      if (pendingFlush.current) {
        pendingFlush.current = false;
        window.setTimeout(() => void flushPromptRef.current(), 0);
      }
    }
  }, [load, repository]);
  flushPromptRef.current = flushPrompt;

  useEffect(() => {
    if (!draft || !dirty || saving || !draft.content.trim()) return;
    const timer = window.setTimeout(() => void flushPrompt(), 500);
    return () => window.clearTimeout(timer);
  }, [dirty, draft, flushPrompt, saving, tagsText]);

  useEffect(() => {
    const flush = () => void flushPromptRef.current();
    window.addEventListener("blur", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("blur", flush);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  const allTags = useMemo(
    () => [...new Set(prompts.flatMap((prompt) => prompt.tags))].sort((a, b) => a.localeCompare(b, "zh-CN")),
    [prompts],
  );
  const visiblePrompts = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return prompts.filter((prompt) => {
      const matchesSearch = !needle || [prompt.title, prompt.content, prompt.notes, ...prompt.tags]
        .some((value) => value.toLocaleLowerCase().includes(needle));
      return matchesSearch
        && (!tagFilter || prompt.tags.includes(tagFilter))
        && (!favoriteOnly || prompt.isFavorite);
    });
  }, [favoriteOnly, prompts, search, tagFilter]);
  const promptGroups = useMemo(() => {
    if (tagFilter) return [{ name: tagFilter, prompts: visiblePrompts }];
    const tagged = allTags.map((tag) => ({
      name: tag,
      prompts: visiblePrompts.filter((prompt) => prompt.tags.includes(tag)),
    })).filter((group) => group.prompts.length > 0);
    const untagged = visiblePrompts.filter((prompt) => prompt.tags.length === 0);
    return untagged.length > 0 ? [...tagged, { name: "未分类", prompts: untagged }] : tagged;
  }, [allTags, tagFilter, visiblePrompts]);
  const filtering = Boolean(search || tagFilter || favoriteOnly);

  const copyPrompt = async (prompt: Prompt | PromptDraft) => {
    await navigator.clipboard.writeText(prompt.content);
    setSaveStatus("saved");
  };

  const deletePrompt = async () => {
    if (!draft?.id || !window.confirm(`删除提示词“${draft.title || "未命名提示词"}”？此操作无法撤销。`)) return;
    try {
      await repository.deletePrompt(draft.id);
      setDraft(null);
      setTagsText("");
      await load();
    } catch {
      setSaveStatus("error");
    }
  };

  const closeEditor = useCallback(() => {
    if (savingRef.current) return;
    void flushPrompt();
    setDraft(null);
    setTagsText("");
    setDirty(false);
    setSaveStatus("idle");
  }, [flushPrompt]);

  useEffect(() => {
    if (!draft) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeEditor();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [closeEditor, draft]);

  return (
    <section className="prompts-page">
      <header className="bookmarks-header">
        <div>
          <p className="eyebrow">PROMPT CABINET</p>
          <h1>提示词</h1>
          <p className="page-description">整理可复用的表达，让灵感随时可以被调用。</p>
        </div>
        <button type="button" className="button-primary" onClick={startNewPrompt}>
          <Plus aria-hidden="true" size={17} />新建提示词
        </button>
      </header>

      <div className="prompt-library-toolbar">
        <label className="search-field">
          <Search aria-hidden="true" size={16} />
          <span className="sr-only">搜索提示词</span>
          <input type="search" value={search} placeholder="搜索标题、正文或标签"
            onChange={(event) => setSearch(event.target.value)} />
        </label>
        <label className="filter-field">
          <Tag aria-hidden="true" size={15} />
          <span className="sr-only">按提示词标签筛选</span>
          <select aria-label="按提示词标签筛选" value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
            <option value="">全部标签</option>
            {allTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
          </select>
        </label>
        <button type="button" className={favoriteOnly ? "filter-toggle active" : "filter-toggle"}
          aria-pressed={favoriteOnly} onClick={() => setFavoriteOnly((value) => !value)}>
          <Star aria-hidden="true" size={14} />收藏
        </button>
        <div className="prompt-result-meta">
          <span>{visiblePrompts.length} 条提示词</span>
          {filtering && <button type="button" onClick={() => { setSearch(""); setTagFilter(""); setFavoriteOnly(false); }}>清除筛选</button>}
        </div>
      </div>

      {loadError && <div role="alert" className="inline-error"><span>{loadError}</span><button onClick={() => void load()}>重试</button></div>}

      {visiblePrompts.length > 0 ? (
        <div className="prompt-catalog" aria-label="提示词库">
          {promptGroups.map((group) => (
            <section className="prompt-group" key={group.name}>
              <header><h2>{group.name}</h2><span>{group.prompts.length}</span></header>
              <div className="prompt-card-grid">
                {group.prompts.map((prompt) => (
                  <button key={`${group.name}-${prompt.id}`} type="button" className="prompt-card" onClick={() => selectPrompt(prompt)}>
                    <span className="prompt-card-title">{prompt.title || "未命名提示词"}{prompt.isFavorite && <Star aria-label="已收藏" size={13} fill="currentColor" />}</span>
                    <span className="prompt-card-content">{prompt.content.replace(/\s+/g, " ").slice(0, 160)}</span>
                    <span className="prompt-card-tags">
                      {prompt.tags.length > 0 ? prompt.tags.map((tag) => <span key={tag}>{tag}</span>) : <span>未分类</span>}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="prompt-catalog-empty">
          <div className="bookmark-empty-mark">✦</div>
          <h2>{prompts.length ? "没有符合条件的提示词" : "提示词库还是空的"}</h2>
          <p>{prompts.length ? "调整搜索或筛选条件，再看看其他内容。" : "使用右上角的“新建提示词”保存第一条内容。"}</p>
          {filtering && <button type="button" className="button-secondary" onClick={() => { setSearch(""); setTagFilter(""); setFavoriteOnly(false); }}>清除筛选</button>}
        </div>
      )}

      {draft && (
        <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEditor(); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="prompt-editor-title" className="bookmark-editor prompt-editor-dialog">
            <header className="bookmark-editor-header">
              <div><p className="eyebrow">{draft.id ? "PROMPT DETAIL" : "NEW PROMPT"}</p><h2 id="prompt-editor-title">{draft.id ? "编辑提示词" : "新建提示词"}</h2></div>
              <button type="button" className="icon-button" onClick={closeEditor} disabled={saving} aria-label="关闭"><X aria-hidden="true" size={18} /></button>
            </header>
            <div className="prompt-editor-form">
              <div className="prompt-editor-topbar">
                <span role="status" className={`save-status ${saveStatus}`}>
                  {saveStatus === "saving" && "保存中…"}
                  {saveStatus === "saved" && <><Check aria-hidden="true" size={13} />已保存</>}
                  {saveStatus === "error" && "保存失败，将保留当前内容"}
                  {saveStatus === "idle" && (draft.id ? "修改后自动保存" : "输入正文后自动保存")}
                </span>
                <div>
                  <button type="button" className="icon-button" disabled={!draft.content}
                    onClick={() => void copyPrompt(draft)} aria-label="复制提示词正文"><Clipboard aria-hidden="true" size={16} /></button>
                  <button type="button" className="icon-button danger" disabled={!draft.id}
                    onClick={() => void deletePrompt()} aria-label="删除提示词"><Trash2 aria-hidden="true" size={16} /></button>
                </div>
              </div>
              <input className="prompt-title-input" aria-label="提示词标题" autoFocus={!draft.id} value={draft.title} placeholder="未命名提示词"
                onChange={(event) => changeDraft({ title: event.target.value })} />
              <textarea className="prompt-content-input" aria-label="提示词正文" value={draft.content}
                placeholder="在这里写下提示词正文…" onChange={(event) => changeDraft({ content: event.target.value })} />
              <div className="prompt-detail-grid">
                <label className="field-label">标签 <span>逗号分隔</span>
                  <input value={tagsText} placeholder="写作, 研究" onChange={(event) => {
                    revision.current += 1;
                    setTagsText(event.target.value);
                    setDirty(true);
                    setSaveStatus("idle");
                    if (savingRef.current) pendingFlush.current = true;
                  }} />
                </label>
                <label className="favorite-field">
                  <input type="checkbox" checked={draft.isFavorite} onChange={(event) => changeDraft({ isFavorite: event.target.checked })} />
                  <Star aria-hidden="true" size={15} />收藏这条提示词
                </label>
              </div>
              <label className="field-label prompt-notes">备注
                <textarea rows={3} value={draft.notes} placeholder="记录使用场景或注意事项"
                  onChange={(event) => changeDraft({ notes: event.target.value })} />
              </label>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
