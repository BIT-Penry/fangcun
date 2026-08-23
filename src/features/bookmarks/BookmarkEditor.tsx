import { useMemo, useRef, useState, type FormEvent } from "react";
import { Plus, Search, Sparkles, X } from "lucide-react";
import { fetchAiBookmarkMetadata, fetchBookmarkMetadata, type BookmarkMetadata } from "./metadata";
import type { Bookmark, BookmarkFolder, BookmarkInput } from "./types";
import { buildBookmarkFolderOptions, folderPathById } from "./folders";
import { normalizeBookmarkUrl } from "./url";

function initialInput(bookmark: Bookmark | null, folders: BookmarkFolder[]): BookmarkInput {
  const folderPath = bookmark?.folderId ? folderPathById(folders).get(bookmark.folderId) : null;
  return {
    url: bookmark?.url ?? "",
    title: bookmark?.title ?? "",
    description: bookmark?.description ?? "",
    faviconUrl: bookmark?.faviconUrl ?? "",
    folderName: folderPath ?? bookmark?.folderName ?? "",
    tags: bookmark?.tags ?? [],
  };
}

export function BookmarkEditor({
  bookmark,
  folders,
  availableTags,
  onClose,
  onSave,
  metadataLoader = fetchBookmarkMetadata,
  aiMetadataLoader = fetchAiBookmarkMetadata,
}: {
  bookmark: Bookmark | null;
  folders: BookmarkFolder[];
  availableTags: string[];
  onClose: () => void;
  onSave: (input: BookmarkInput) => Promise<void>;
  metadataLoader?: (url: string) => Promise<BookmarkMetadata>;
  aiMetadataLoader?: (url: string) => Promise<BookmarkMetadata>;
}) {
  const folderOptions = useMemo(() => buildBookmarkFolderOptions(folders), [folders]);
  const [input, setInput] = useState(() => initialInput(bookmark, folders));
  const [tagQuery, setTagQuery] = useState("");
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [metadataStatus, setMetadataStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [metadataMessage, setMetadataMessage] = useState("");
  const lastFetchedUrl = useRef(bookmark?.normalizedUrl ?? "");
  const titleEdited = useRef(Boolean(bookmark?.title));
  const descriptionEdited = useRef(Boolean(bookmark?.description));

  const loadMetadata = async (force = false, useAi = false) => {
    let normalizedUrl: string;
    try {
      normalizedUrl = normalizeBookmarkUrl(input.url);
    } catch {
      if (force) setMetadataStatus("error");
      return;
    }
    if (!force && normalizedUrl === lastFetchedUrl.current) return;

    lastFetchedUrl.current = normalizedUrl;
    setMetadataStatus("loading");
    setMetadataMessage(useAi ? "正在读取网页并交给 AI 整理…" : "正在读取网页信息…");
    try {
      const metadata = await (useAi ? aiMetadataLoader(normalizedUrl) : metadataLoader(normalizedUrl));
      setInput((current) => {
        try {
          if (normalizeBookmarkUrl(current.url) !== normalizedUrl) return current;
        } catch {
          return current;
        }
        return {
          ...current,
          title: (!titleEdited.current || !current.title.trim()) ? metadata.title || current.title : current.title,
          description: (!descriptionEdited.current || !current.description.trim()) ? metadata.description || current.description : current.description,
          faviconUrl: metadata.faviconUrl || current.faviconUrl,
        };
      });
      if (metadata.warning) {
        setMetadataStatus("error");
        setMetadataMessage(metadata.warning);
      } else if (metadata.title || metadata.description || metadata.faviconUrl) {
        setMetadataStatus("success");
        setMetadataMessage(metadata.aiEnhanced ? "AI 已生成标题与简介，可继续修改" : "已读取网页原始信息");
      } else {
        setMetadataStatus("error");
        setMetadataMessage("网页没有提供可用信息，仍可手动填写");
      }
    } catch (metadataError) {
      setMetadataStatus("error");
      setMetadataMessage(metadataError instanceof Error ? metadataError.message : String(metadataError));
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      normalizeBookmarkUrl(input.url);
      setSaving(true);
      await onSave({
        ...input,
        tags: input.tags,
      });
    } catch (saveError) {
      setError(saveError instanceof Error
        ? saveError.message
        : "保存失败，请重试");
      setSaving(false);
    }
  };

  const toggleTag = (tag: string) => {
    setInput((current) => ({
      ...current,
      tags: current.tags.includes(tag) ? current.tags.filter((value) => value !== tag) : [...current.tags, tag],
    }));
  };

  const addTag = () => {
    const normalized = tagQuery.trim();
    if (!normalized) return;
    const existing = [...availableTags, ...input.tags]
      .find((tag) => tag.toLocaleLowerCase() === normalized.toLocaleLowerCase());
    const tag = existing ?? normalized;
    if (!input.tags.includes(tag)) setInput((current) => ({ ...current, tags: [...current.tags, tag] }));
    setTagQuery("");
    setTagPickerOpen(true);
  };

  const matchingTags = availableTags.filter((tag) => {
    const needle = tagQuery.trim().toLocaleLowerCase();
    return !needle || tag.toLocaleLowerCase().includes(needle);
  });

  return (
    <div className="dialog-backdrop">
      <section role="dialog" aria-modal="true" aria-labelledby="bookmark-editor-title" className="bookmark-editor">
        <header className="bookmark-editor-header">
          <div>
            <p className="eyebrow">{bookmark ? "编辑资料" : "保存到方寸"}</p>
            <h2 id="bookmark-editor-title">{bookmark ? "编辑书签" : "添加书签"}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} disabled={saving} aria-label="关闭">
            <X aria-hidden="true" size={18} />
          </button>
        </header>

        <form onSubmit={(event) => void submit(event)} className="bookmark-form">
          <div className="field-label">
            <div className="field-label-row">
              <label htmlFor="bookmark-url">网页地址</label>
              <button type="button" className="metadata-button" data-metadata-ai="true"
                onClick={() => void loadMetadata(true, true)} disabled={saving || metadataStatus === "loading" || !input.url.trim()}>
                <Sparkles aria-hidden="true" size={12} className={metadataStatus === "loading" ? "spinning" : ""} />
                {metadataStatus === "loading" ? "AI 整理中" : "AI 获取网页信息"}
              </button>
            </div>
            <input id="bookmark-url" autoFocus required type="url" value={input.url} placeholder="https://example.com"
              onBlur={(event) => {
                if ((event.relatedTarget as HTMLElement | null)?.dataset.metadataAi !== "true") void loadMetadata();
              }}
              onChange={(event) => {
                setInput({ ...input, url: event.target.value, faviconUrl: "" });
                setMetadataStatus("idle");
                setMetadataMessage("");
              }} />
            {metadataMessage && <span className={metadataStatus === "error" ? "metadata-hint warning" : "metadata-hint"}>{metadataMessage}</span>}
          </div>
          <label className="field-label">
            标题 <span>可留空</span>
            <input value={input.title} placeholder="留空时使用网站域名"
              onChange={(event) => { titleEdited.current = true; setInput({ ...input, title: event.target.value }); }} />
          </label>
          <label className="field-label">
            简介
            <textarea rows={3} value={input.description} placeholder="这条资料为什么值得保留？"
              onChange={(event) => { descriptionEdited.current = true; setInput({ ...input, description: event.target.value }); }} />
          </label>

          <div className="bookmark-form-grid">
            <div className="field-label bookmark-folder-picker">
              文件夹 <span>选择已有文件夹，或用 / 创建层级</span>
              <select aria-label="选择已有文件夹" value={folderOptions.some((folder) => folder.path === input.folderName) ? input.folderName : ""}
                onChange={(event) => setInput({ ...input, folderName: event.target.value })}>
                <option value="">不放入文件夹</option>
                {folderOptions.map((folder) => <option key={folder.id} value={folder.path}>{folder.path}</option>)}
              </select>
              <input aria-label="新建文件夹路径" value={input.folderName} placeholder="例如：研究 / 论文 / UAV"
                onChange={(event) => setInput({ ...input, folderName: event.target.value })} />
            </div>
            <div className="field-label">
              标签 <span>勾选已有标签，或输入名称创建</span>
              <div className="tag-combobox" onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setTagPickerOpen(false);
              }}>
                {input.tags.length > 0 && <div className="selected-tag-list">
                  {input.tags.map((tag) => <span key={tag}>{tag}<button type="button" aria-label={`移除标签 ${tag}`} onClick={() => toggleTag(tag)}><X aria-hidden="true" size={11} /></button></span>)}
                </div>}
                <div className="tag-combobox-input">
                  <Search aria-hidden="true" size={14} />
                  <input aria-label="搜索或新建书签标签" value={tagQuery} placeholder="搜索或新建标签"
                    aria-expanded={tagPickerOpen} aria-controls="bookmark-tag-options"
                    onFocus={() => setTagPickerOpen(true)} onChange={(event) => { setTagQuery(event.target.value); setTagPickerOpen(true); }}
                    onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTag(); } }} />
                </div>
                {tagPickerOpen && <div id="bookmark-tag-options" className="tag-options" role="group" aria-label="可用书签标签">
                  {matchingTags.map((tag) => <label key={tag} onMouseDown={(event) => event.preventDefault()}>
                    <input type="checkbox" checked={input.tags.includes(tag)} onChange={() => toggleTag(tag)} />
                    <span>{tag}</span>
                  </label>)}
                  {tagQuery.trim() && ![...availableTags, ...input.tags].some((tag) => tag.toLocaleLowerCase() === tagQuery.trim().toLocaleLowerCase()) &&
                    <button type="button" className="create-tag-option" onMouseDown={(event) => event.preventDefault()} onClick={addTag}><Plus aria-hidden="true" size={13} />创建“{tagQuery.trim()}”</button>}
                  {matchingTags.length === 0 && !tagQuery.trim() && <p>还没有可复用的标签</p>}
                </div>}
              </div>
            </div>
          </div>

          {error && <p role="alert" className="form-error">{error}</p>}

          <footer className="bookmark-editor-actions">
            <button type="button" className="button-secondary" onClick={onClose} disabled={saving}>取消</button>
            <button type="submit" className="button-primary" disabled={saving}>
              {saving ? "保存中…" : "保存书签"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
