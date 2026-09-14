import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronRight, Clipboard, Plus, Search, Sparkles, Star, Tag, Trash2, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { usePromptsStore } from "./PromptsContext";
import type { Prompt, PromptInput } from "./types";
import { formatPromptContent } from "../../shared/aiService";
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

function parseTags(value: string) {
  return [...new Set(value.split(",").map((tag) => tag.trim()).filter(Boolean))];
}

export function PromptsPage() {
  const repository = usePromptsStore();
  const [routeParams, setRouteParams] = useSearchParams();
  const routePromptId = routeParams.get("open");
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [draft, setDraft] = useState<PromptDraft | null>(null);
  const [tagsText, setTagsText] = useState("");
  const [tagQuery, setTagQuery] = useState("");
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [cardCopyStatus, setCardCopyStatus] = useState<{ id: string; status: "copied" | "error" } | null>(null);
  const [search, setSearch] = useSessionState("fangcun:prompts:search", "");
  const [tagFilter, setTagFilter] = useSessionState("fangcun:prompts:tag", "");
  const [favoriteOnly, setFavoriteOnly] = useSessionState("fangcun:prompts:favorites", false);
  const [loadError, setLoadError] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [formatStatus, setFormatStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [formatPreview, setFormatPreview] = useState<string | null>(null);
  const [formatMessage, setFormatMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const revision = useRef(0);
  const latestDraft = useRef<PromptDraft | null>(null);
  const latestTagsText = useRef("");
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const pendingFlush = useRef(false);
  const formatRequest = useRef(0);
  const cardCopyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handledRoutePromptId = useRef<string | null>(null);
  const flushPromptRef = useRef<() => Promise<void>>(async () => undefined);

  const clearPromptRoute = useCallback(() => {
    if (!routePromptId) return;
    const nextParams = new URLSearchParams(routeParams);
    nextParams.delete("open");
    setRouteParams(nextParams, { replace: true });
  }, [routeParams, routePromptId, setRouteParams]);

  latestDraft.current = draft;
  latestTagsText.current = tagsText;
  dirtyRef.current = dirty;

  const resetFormatState = useCallback(() => {
    formatRequest.current += 1;
    setFormatStatus("idle");
    setFormatPreview(null);
    setFormatMessage("");
  }, []);

  const load = useCallback(async () => {
    try {
      setLoadError("");
      setPrompts(await repository.listPrompts());
    } catch {
      setLoadError("无法读取本地提示词，请重试");
    }
  }, [repository]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => () => {
    if (cardCopyTimer.current) clearTimeout(cardCopyTimer.current);
  }, []);

  const selectPrompt = useCallback((prompt: Prompt) => {
    setDraft(toDraft(prompt));
    setTagsText(prompt.tags.join(", "));
    setTagQuery("");
    setTagPickerOpen(false);
    setCopyStatus("idle");
    resetFormatState();
    setDirty(false);
    setSaveStatus("idle");
  }, [resetFormatState]);

  useEffect(() => {
    if (!routePromptId) {
      handledRoutePromptId.current = null;
      return;
    }
    if (handledRoutePromptId.current === routePromptId) return;
    const target = prompts.find((prompt) => prompt.id === routePromptId);
    if (!target) return;
    handledRoutePromptId.current = routePromptId;
    selectPrompt(target);
  }, [prompts, routePromptId, selectPrompt]);

  const startNewPrompt = useCallback(() => {
    setDraft({ ...EMPTY_DRAFT });
    setTagsText("");
    setTagQuery("");
    setTagPickerOpen(false);
    setCopyStatus("idle");
    resetFormatState();
    setDirty(false);
    setSaveStatus("idle");
  }, [resetFormatState]);

  useEffect(() => {
    window.addEventListener("fangcun:quick-add", startNewPrompt);
    return () => window.removeEventListener("fangcun:quick-add", startNewPrompt);
  }, [startNewPrompt]);

  const changeDraft = (patch: Partial<PromptDraft>) => {
    revision.current += 1;
    setDraft((current) => current ? { ...current, ...patch } : current);
    setDirty(true);
    setSaveStatus("idle");
    if ("content" in patch) {
      setCopyStatus("idle");
      resetFormatState();
    }
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
      tags: parseTags(latestTagsText.current),
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
  const selectedTags = useMemo(() => parseTags(tagsText), [tagsText]);
  const matchingTags = useMemo(() => {
    const needle = tagQuery.trim().toLocaleLowerCase();
    return allTags.filter((tag) => !needle || tag.toLocaleLowerCase().includes(needle));
  }, [allTags, tagQuery]);

  const updateTags = (nextTags: string[]) => {
    revision.current += 1;
    setTagsText([...new Set(nextTags)].join(", "));
    setDirty(true);
    setSaveStatus("idle");
    if (savingRef.current) pendingFlush.current = true;
  };

  const addTag = (value: string) => {
    const normalized = value.trim();
    if (!normalized) return;
    const existing = [...allTags, ...selectedTags]
      .find((tag) => tag.toLocaleLowerCase() === normalized.toLocaleLowerCase());
    const tag = existing ?? normalized;
    if (!selectedTags.includes(tag)) updateTags([...selectedTags, tag]);
    setTagQuery("");
    setTagPickerOpen(true);
  };

  const toggleTag = (tag: string) => {
    updateTags(selectedTags.includes(tag) ? selectedTags.filter((value) => value !== tag) : [...selectedTags, tag]);
  };

  const copyPrompt = async (prompt: Prompt | PromptDraft) => {
    try {
      await navigator.clipboard.writeText(prompt.content);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  };

  const copyPromptFromCard = async (prompt: Prompt) => {
    if (!prompt.content.trim()) return;
    if (cardCopyTimer.current) clearTimeout(cardCopyTimer.current);
    try {
      await navigator.clipboard.writeText(prompt.content);
      setCardCopyStatus({ id: prompt.id, status: "copied" });
    } catch {
      setCardCopyStatus({ id: prompt.id, status: "error" });
    }
    cardCopyTimer.current = setTimeout(() => setCardCopyStatus(null), 1800);
  };

  const formatPrompt = async () => {
    const source = latestDraft.current?.content ?? "";
    if (!source.trim()) return;
    const requestId = ++formatRequest.current;
    setFormatStatus("loading");
    setFormatPreview(null);
    setFormatMessage("正在整理段落、列表与 Markdown 结构…");
    try {
      const result = await formatPromptContent(source);
      if (formatRequest.current !== requestId) return;
      if (latestDraft.current?.content !== source) {
        setFormatStatus("error");
        setFormatMessage("正文在校正期间发生了变化，请重新校正");
        return;
      }
      if (result.content === source) {
        setFormatStatus("idle");
        setFormatMessage("当前格式已经很整齐，无需调整");
        return;
      }
      setFormatPreview(result.content);
      setFormatStatus("ready");
      setFormatMessage("已生成格式预览，确认后才会替换正文");
    } catch (error) {
      if (formatRequest.current !== requestId) return;
      setFormatStatus("error");
      setFormatMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const applyFormattedPrompt = () => {
    if (!formatPreview) return;
    const content = formatPreview;
    changeDraft({ content });
    setFormatMessage("已应用格式校正，正在自动保存");
  };

  const deletePrompt = async () => {
    if (!draft?.id || !window.confirm(`删除提示词“${draft.title || "未命名提示词"}”？此操作无法撤销。`)) return;
    try {
      await repository.deletePrompt(draft.id);
      setDraft(null);
      setTagsText("");
      clearPromptRoute();
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
    setTagQuery("");
    setTagPickerOpen(false);
    setCopyStatus("idle");
    resetFormatState();
    setDirty(false);
    setSaveStatus("idle");
    clearPromptRoute();
  }, [clearPromptRoute, flushPrompt, resetFormatState]);

  useEffect(() => {
    if (!draft) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (tagPickerOpen) {
        setTagPickerOpen(false);
        setTagQuery("");
        return;
      }
      closeEditor();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [closeEditor, draft, tagPickerOpen]);

  return (
    <section className="prompts-page">
      <header className="bookmarks-header">
        <div>
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
                  <article key={`${group.name}-${prompt.id}`} className="prompt-card">
                    <button type="button" className="prompt-card-open" aria-label={`查看 ${prompt.title || "未命名提示词"}`}
                      onClick={() => selectPrompt(prompt)}>
                      <span className="prompt-card-heading">
                        <span className="prompt-card-title" title={prompt.title || "未命名提示词"}>{prompt.title || "未命名提示词"}</span>
                        {prompt.isFavorite && <span className="prompt-card-favorite" title="已收藏"><Star aria-label="已收藏" size={13} fill="currentColor" /></span>}
                      </span>
                      <span className={prompt.content.trim() ? "prompt-card-content" : "prompt-card-content muted"}>
                        {prompt.content.trim() ? prompt.content.replace(/\s+/g, " ").slice(0, 180) : "暂无正文，可打开卡片后补充内容。"}
                      </span>
                    </button>
                    <footer className="prompt-card-footer">
                      <span className="prompt-card-tags">
                        {prompt.tags.length > 0 ? prompt.tags.map((tag) => <span key={tag}>{tag}</span>) : <span>未分类</span>}
                      </span>
                      <span className="prompt-card-actions">
                        <button type="button"
                          className={`prompt-card-copy ${cardCopyStatus?.id === prompt.id ? cardCopyStatus.status : ""}`}
                          disabled={!prompt.content.trim()} onClick={() => void copyPromptFromCard(prompt)}
                          aria-label={`复制 ${prompt.title || "未命名提示词"} 的正文`}>
                          {cardCopyStatus?.id === prompt.id && cardCopyStatus.status === "copied"
                            ? <Check aria-hidden="true" size={13} /> : <Clipboard aria-hidden="true" size={13} />}
                          {cardCopyStatus?.id === prompt.id
                            ? cardCopyStatus.status === "copied" ? "已复制" : "复制失败"
                            : "复制"}
                        </button>
                        <button type="button" className="prompt-card-affordance" onClick={() => selectPrompt(prompt)}
                          aria-label={`查看 ${prompt.title || "未命名提示词"} 的详情`}>
                          查看<ChevronRight aria-hidden="true" size={13} />
                        </button>
                      </span>
                    </footer>
                  </article>
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
              <div><h2 id="prompt-editor-title">{draft.id ? "编辑提示词" : "新建提示词"}</h2></div>
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
                  <button type="button" className={`prompt-copy-button ${copyStatus}`} disabled={!draft.content}
                    onClick={() => void copyPrompt(draft)}>
                    {copyStatus === "copied" ? <Check aria-hidden="true" size={15} /> : <Clipboard aria-hidden="true" size={15} />}
                    {copyStatus === "copied" ? "已复制" : copyStatus === "error" ? "复制失败" : "复制正文"}
                  </button>
                  <button type="button" className="icon-button danger" disabled={!draft.id}
                    onClick={() => void deletePrompt()} aria-label="删除提示词"><Trash2 aria-hidden="true" size={16} /></button>
                </div>
              </div>
              <input className="prompt-title-input" aria-label="提示词标题" autoFocus={!draft.id} value={draft.title} placeholder="未命名提示词"
                onChange={(event) => changeDraft({ title: event.target.value })} />
              <div className="prompt-content-toolbar">
                <span>正文</span>
                <button type="button" className="prompt-format-button" disabled={!draft.content.trim() || formatStatus === "loading"}
                  onClick={() => void formatPrompt()}>
                  <Sparkles aria-hidden="true" size={13} className={formatStatus === "loading" ? "spinning" : ""} />
                  {formatStatus === "loading" ? "正在校正…" : "AI 校正格式"}
                </button>
              </div>
              <textarea className="prompt-content-input" aria-label="提示词正文" value={draft.content}
                placeholder="在这里写下提示词正文…" onChange={(event) => changeDraft({ content: event.target.value })} />
              {formatMessage && <p role="status" className={`prompt-format-message ${formatStatus}`}>{formatMessage}</p>}
              {formatPreview && formatStatus === "ready" && (
                <section className="prompt-format-preview" aria-label="格式校正预览">
                  <header>
                    <div><strong>格式校正预览</strong><span>原正文尚未被修改</span></div>
                    <div>
                      <button type="button" className="button-secondary" onClick={resetFormatState}>保留原文</button>
                      <button type="button" className="button-primary" onClick={applyFormattedPrompt}>应用格式</button>
                    </div>
                  </header>
                  <pre>{formatPreview}</pre>
                </section>
              )}
              <div className="prompt-detail-grid">
                <div className="field-label">标签 <span>选择已有标签，或输入名称创建</span>
                  <div className="tag-combobox" onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setTagPickerOpen(false);
                  }}>
                    {selectedTags.length > 0 && <div className="selected-tag-list">
                      {selectedTags.map((tag) => <span key={tag}>{tag}<button type="button" aria-label={`移除标签 ${tag}`} onClick={() => toggleTag(tag)}><X aria-hidden="true" size={11} /></button></span>)}
                    </div>}
                    <div className="tag-combobox-input">
                      <Search aria-hidden="true" size={14} />
                      <input aria-label="搜索或新建标签" value={tagQuery} placeholder="搜索或新建标签"
                        aria-expanded={tagPickerOpen} aria-controls="prompt-tag-options"
                        onFocus={() => setTagPickerOpen(true)} onChange={(event) => { setTagQuery(event.target.value); setTagPickerOpen(true); }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") { event.preventDefault(); addTag(tagQuery); }
                        }} />
                    </div>
                    {tagPickerOpen && <div id="prompt-tag-options" className="tag-options" role="group" aria-label="可用标签">
                      {matchingTags.map((tag) => <label key={tag} onMouseDown={(event) => event.preventDefault()}>
                        <input type="checkbox" checked={selectedTags.includes(tag)} onChange={() => toggleTag(tag)} />
                        <span>{tag}</span>
                      </label>)}
                      {tagQuery.trim() && !allTags.some((tag) => tag.toLocaleLowerCase() === tagQuery.trim().toLocaleLowerCase()) &&
                        <button type="button" className="create-tag-option" onMouseDown={(event) => event.preventDefault()} onClick={() => addTag(tagQuery)}><Plus aria-hidden="true" size={13} />创建“{tagQuery.trim()}”</button>}
                      {matchingTags.length === 0 && !tagQuery.trim() && <p>还没有可复用的标签</p>}
                    </div>}
                  </div>
                </div>
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
