import { useMemo, useRef, useState, type FormEvent } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Folder, FolderOpen, Plus, Search, Sparkles, X } from "lucide-react";
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
  const folderPaths = useMemo(() => folderPathById(folders), [folders]);
  const foldersById = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders]);
  const childrenByParent = useMemo(() => {
    const children = new Map<string | null, BookmarkFolder[]>();
    const folderIds = new Set(folders.map((folder) => folder.id));
    for (const folder of folders) {
      const parentId = folder.parentId && folderIds.has(folder.parentId) ? folder.parentId : null;
      children.set(parentId, [...(children.get(parentId) ?? []), folder]);
    }
    for (const siblings of children.values()) siblings.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
    return children;
  }, [folders]);
  const [input, setInput] = useState(() => initialInput(bookmark, folders));
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [browsingFolderId, setBrowsingFolderId] = useState<string | null>(bookmark?.folderId ?? null);
  const [tagQuery, setTagQuery] = useState("");
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [metadataStatus, setMetadataStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [metadataMessage, setMetadataMessage] = useState("");
  const lastFetchedUrl = useRef(bookmark?.normalizedUrl ?? "");
  const titleEdited = useRef(Boolean(bookmark?.title));
  const descriptionEdited = useRef(Boolean(bookmark?.description));

  const browsingFolder = browsingFolderId ? foldersById.get(browsingFolderId) ?? null : null;
  const browsingChildren = childrenByParent.get(browsingFolderId) ?? [];
  const selectedFolderId = folderOptions.find((folder) => folder.path === input.folderName)?.id ?? null;
  const browsingTrail = useMemo(() => {
    const trail: BookmarkFolder[] = [];
    const visited = new Set<string>();
    let folder = browsingFolderId ? foldersById.get(browsingFolderId) ?? null : null;
    while (folder && !visited.has(folder.id)) {
      visited.add(folder.id);
      trail.unshift(folder);
      folder = folder.parentId ? foldersById.get(folder.parentId) ?? null : null;
    }
    return trail;
  }, [browsingFolderId, foldersById]);

  const toggleFolderPicker = () => {
    if (!folderPickerOpen) {
      const selected = folderOptions.find((folder) => folder.path === input.folderName);
      setBrowsingFolderId(selected?.id ?? null);
    }
    setFolderPickerOpen((open) => !open);
  };

  const selectBrowsingFolder = () => {
    setInput((current) => ({
      ...current,
      folderName: browsingFolderId ? folderPaths.get(browsingFolderId) ?? "" : "",
    }));
    setFolderPickerOpen(false);
  };

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

          <div className={folderPickerOpen ? "bookmark-form-grid folder-picker-open" : "bookmark-form-grid"}>
            <div className="field-label bookmark-folder-picker">
              文件夹 <span>逐级选择已有文件夹，或用 / 创建层级</span>
              <div className="bookmark-folder-picker-shell" onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFolderPickerOpen(false);
              }} onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  setFolderPickerOpen(false);
                }
              }}>
                <button type="button" className="bookmark-folder-picker-trigger" aria-label="选择已有文件夹"
                  aria-expanded={folderPickerOpen} aria-controls="bookmark-folder-picker-browser" onClick={toggleFolderPicker}>
                  {input.folderName ? <FolderOpen aria-hidden="true" size={16} /> : <Folder aria-hidden="true" size={16} />}
                  <span><small>保存位置</small><strong>{input.folderName || "不放入文件夹"}</strong></span>
                  <ChevronDown aria-hidden="true" size={15} />
                </button>

                {folderPickerOpen && <div id="bookmark-folder-picker-browser" className="bookmark-folder-picker-browser">
                  <header>
                    <button type="button" className="bookmark-folder-picker-back" disabled={!browsingFolder}
                      aria-label="返回上一级文件夹" onClick={() => setBrowsingFolderId(browsingFolder?.parentId ?? null)}>
                      <ChevronLeft aria-hidden="true" size={15} />
                    </button>
                    <nav aria-label="正在浏览的文件夹路径">
                      <button type="button" onClick={() => setBrowsingFolderId(null)}>全部文件夹</button>
                      {browsingTrail.map((folder, index) => <span key={folder.id}>
                        <ChevronRight aria-hidden="true" size={11} />
                        {index === browsingTrail.length - 1
                          ? <strong aria-current="page">{folder.name}</strong>
                          : <button type="button" onClick={() => setBrowsingFolderId(folder.id)}>{folder.name}</button>}
                      </span>)}
                    </nav>
                  </header>

                  <div className="bookmark-folder-picker-list" role="group" aria-label="当前层级的文件夹">
                    {browsingChildren.map((folder) => <button type="button" key={folder.id}
                      className={selectedFolderId === folder.id ? "selected" : ""}
                      onClick={() => setBrowsingFolderId(folder.id)} aria-label={`进入文件夹 ${folder.name}`}>
                      <Folder aria-hidden="true" size={16} />
                      <span><strong>{folder.name}</strong><small>{(childrenByParent.get(folder.id) ?? []).length} 个子文件夹</small></span>
                      {selectedFolderId === folder.id && <Check aria-hidden="true" size={14} />}
                      <ChevronRight aria-hidden="true" size={14} />
                    </button>)}
                    {browsingChildren.length === 0 && <p>{browsingFolder ? "这个文件夹没有子文件夹" : "还没有可选择的文件夹"}</p>}
                  </div>

                  <footer>
                    <span title={browsingFolderId ? folderPaths.get(browsingFolderId) : ""}>
                      {browsingFolder ? `当前位置：${browsingFolder.name}` : "当前位置：文件夹之外"}
                    </span>
                    <button type="button" className="button-primary" onClick={selectBrowsingFolder}
                      aria-label={browsingFolder ? `选择文件夹 ${folderPaths.get(browsingFolder.id) ?? browsingFolder.name}` : "不放入文件夹"}>
                      {browsingFolder ? "选择这里" : "不放入文件夹"}
                    </button>
                  </footer>
                </div>}
              </div>
              <input aria-label="新建文件夹路径" value={input.folderName} placeholder="例如：研究 / 论文 / UAV"
                onChange={(event) => { setInput({ ...input, folderName: event.target.value }); setFolderPickerOpen(false); }} />
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
