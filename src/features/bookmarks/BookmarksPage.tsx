import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, Clipboard, ExternalLink, Folder, FolderOpen, Layers3, LayoutGrid, Pencil, Plus, Search, Tag, Trash2, Upload, X } from "lucide-react";
import { BookmarkEditor } from "./BookmarkEditor";
import { parseBookmarkHtml } from "./import";
import { useBookmarksStore } from "./BookmarksContext";
import type { Bookmark, BookmarkFolder, BookmarkImportPreview, BookmarkImportStrategy, BookmarkInput } from "./types";
import { bookmarkHostname } from "./url";
import { openExternalUrl } from "../../shared/openExternal";
import { useSessionState } from "../../shared/useSessionState";
import { useBrowserPreference } from "../../app/browser/BrowserPreferenceProvider";
import { folderPathById } from "./folders";

interface BookmarkCardProps {
  bookmark: Bookmark;
  folderPath: string;
  copied: boolean;
  onOpen: (bookmark: Bookmark) => void;
  onCopy: (bookmark: Bookmark) => void;
  onEdit: (bookmark: Bookmark) => void;
  onDelete: (bookmark: Bookmark) => void;
}

function BookmarkCard({ bookmark, folderPath, copied, onOpen, onCopy, onEdit, onDelete }: BookmarkCardProps) {
  return (
    <article className="bookmark-card">
      <div className="bookmark-card-heading">
        {bookmark.faviconUrl ? (
          <img className="bookmark-favicon" src={bookmark.faviconUrl} alt=""
            onError={(event) => { event.currentTarget.style.display = "none"; }} />
        ) : <span className="bookmark-favicon-fallback">{bookmarkHostname(bookmark.url).slice(0, 1).toUpperCase()}</span>}
        <div className="bookmark-card-main">
          <div className="bookmark-domain">{bookmarkHostname(bookmark.url)}</div>
          <h2>{bookmark.title}</h2>
        </div>
      </div>
      <p className={bookmark.description ? "" : "muted"}>{bookmark.description || "暂无简介，可在编辑中补充这条资料的用途。"}</p>
      <span className="bookmark-url">{bookmark.url}</span>
      <div className="bookmark-card-meta">
        {folderPath && <span><Folder aria-hidden="true" size={13} />{folderPath}</span>}
        {bookmark.tags.map((tag) => <span key={tag} className="bookmark-tag">{tag}</span>)}
      </div>
      <div className="bookmark-card-actions">
        <button type="button" className="bookmark-action-button primary" onClick={() => onOpen(bookmark)} aria-label={`打开 ${bookmark.title}`}>
          <ExternalLink aria-hidden="true" size={14} />打开
        </button>
        <button type="button" className={copied ? "bookmark-action-button copied" : "bookmark-action-button"} onClick={() => onCopy(bookmark)} aria-label={`复制 ${bookmark.title} 的链接`}>
          {copied ? <Check aria-hidden="true" size={14} /> : <Clipboard aria-hidden="true" size={14} />}{copied ? "已复制" : "复制链接"}
        </button>
        <button type="button" className="icon-button" onClick={() => onEdit(bookmark)} aria-label={`编辑 ${bookmark.title}`}><Pencil aria-hidden="true" size={15} /></button>
        <button type="button" className="icon-button danger" onClick={() => onDelete(bookmark)} aria-label={`删除 ${bookmark.title}`}><Trash2 aria-hidden="true" size={15} /></button>
      </div>
    </article>
  );
}

function FolderTreeNode({ folder, childrenByParent, counts, expandedIds, selectedId, onToggle, onSelect }: {
  folder: BookmarkFolder;
  childrenByParent: Map<string | null, BookmarkFolder[]>;
  counts: Map<string, number>;
  expandedIds: Set<string>;
  selectedId: string;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const children = childrenByParent.get(folder.id) ?? [];
  const expanded = expandedIds.has(folder.id);
  return (
    <div className="bookmark-folder-tree-node">
      <div className={selectedId === folder.id ? "bookmark-folder-tree-row selected" : "bookmark-folder-tree-row"}>
        {children.length > 0 ? (
          <button type="button" className="folder-disclosure" aria-expanded={expanded}
            aria-label={`${expanded ? "收起" : "展开"}文件夹 ${folder.name}`} onClick={() => onToggle(folder.id)}>
            {expanded ? <ChevronDown aria-hidden="true" size={14} /> : <ChevronRight aria-hidden="true" size={14} />}
          </button>
        ) : <span className="folder-disclosure-spacer" />}
        <button type="button" className="folder-tree-select" onClick={() => onSelect(folder.id)} aria-label={`查看文件夹 ${folder.name}`}>
          {expanded ? <FolderOpen aria-hidden="true" size={16} /> : <Folder aria-hidden="true" size={16} />}
          <span>{folder.name}</span><small>{counts.get(folder.id) ?? 0}</small>
        </button>
      </div>
      {expanded && children.length > 0 && <div className="bookmark-folder-tree-children">
        {children.map((child) => <FolderTreeNode key={child.id} folder={child} childrenByParent={childrenByParent}
          counts={counts} expandedIds={expandedIds} selectedId={selectedId} onToggle={onToggle} onSelect={onSelect} />)}
      </div>}
    </div>
  );
}

function FolderBookmarkRow({ bookmark, copied, onOpen, onCopy, onEdit, onDelete }: Omit<BookmarkCardProps, "folderPath">) {
  return (
    <article className="bookmark-folder-link-row">
      <button type="button" className="bookmark-folder-link-main" onClick={() => onOpen(bookmark)} aria-label={`打开书签 ${bookmark.title}`}>
        {bookmark.faviconUrl ? <img src={bookmark.faviconUrl} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} />
          : <span className="bookmark-folder-link-fallback">{bookmarkHostname(bookmark.url).slice(0, 1).toUpperCase()}</span>}
        <span>{bookmark.title}</span>
      </button>
      <div className="bookmark-folder-link-actions">
        <button type="button" className={copied ? "icon-button copied" : "icon-button"} onClick={() => onCopy(bookmark)} aria-label={`复制 ${bookmark.title} 的链接`}>
          {copied ? <Check aria-hidden="true" size={15} /> : <Clipboard aria-hidden="true" size={15} />}
        </button>
        <button type="button" className="icon-button" onClick={() => onEdit(bookmark)} aria-label={`编辑 ${bookmark.title}`}><Pencil aria-hidden="true" size={15} /></button>
        <button type="button" className="icon-button danger" onClick={() => onDelete(bookmark)} aria-label={`删除 ${bookmark.title}`}><Trash2 aria-hidden="true" size={15} /></button>
      </div>
    </article>
  );
}

export function BookmarksPage() {
  const repository = useBookmarksStore();
  const { preference: browserPreference } = useBrowserPreference();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [folders, setFolders] = useState<BookmarkFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useSessionState("fangcun:bookmarks:search", "");
  const [folderFilter, setFolderFilter] = useSessionState("fangcun:bookmarks:folder", "");
  const [tagFilter, setTagFilter] = useSessionState("fangcun:bookmarks:tag", "");
  const [editor, setEditor] = useState<Bookmark | "new" | null>(null);
  const [storedView, setView] = useSessionState<"links" | "folders">("fangcun:bookmarks:view", "links");
  const view = storedView === "folders" ? "folders" : "links";
  const [selectedFolderId, setSelectedFolderId] = useSessionState("fangcun:bookmarks:folder-selection", "");
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(() => new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<BookmarkImportPreview | null>(null);
  const [importStrategy, setImportStrategy] = useState<BookmarkImportStrategy>("skip");
  const [importing, setImporting] = useState(false);
  const [importNotice, setImportNotice] = useState("");
  const importInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [nextBookmarks, nextFolders] = await Promise.all([
        repository.listBookmarks(),
        repository.listFolders(),
      ]);
      setBookmarks(nextBookmarks);
      setFolders(nextFolders);
    } catch {
      setLoadError("无法读取本地书签，请重试");
    } finally {
      setLoading(false);
    }
  }, [repository]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const openEditor = () => setEditor("new");
    window.addEventListener("fangcun:quick-add", openEditor);
    return () => window.removeEventListener("fangcun:quick-add", openEditor);
  }, []);

  const tags = useMemo(
    () => [...new Set(bookmarks.flatMap((bookmark) => bookmark.tags))]
      .sort((a, b) => a.localeCompare(b, "zh-CN")),
    [bookmarks],
  );
  const folderPaths = useMemo(() => folderPathById(folders), [folders]);
  const descendantFolderIds = useMemo(() => {
    if (!folderFilter) return null;
    const ids = new Set([folderFilter]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const folder of folders) {
        if (folder.parentId && ids.has(folder.parentId) && !ids.has(folder.id)) {
          ids.add(folder.id);
          changed = true;
        }
      }
    }
    return ids;
  }, [folderFilter, folders]);

  const visibleBookmarks = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return bookmarks.filter((bookmark) => {
      const matchesSearch = !needle || [
        bookmark.title,
        bookmark.description,
        bookmark.url,
        bookmark.folderName ?? "",
        ...bookmark.tags,
      ].some((value) => value.toLocaleLowerCase().includes(needle));
      const matchesFolder = !descendantFolderIds || (bookmark.folderId ? descendantFolderIds.has(bookmark.folderId) : false);
      const matchesTag = !tagFilter || bookmark.tags.includes(tagFilter);
      return matchesSearch && matchesFolder && matchesTag;
    });
  }, [bookmarks, descendantFolderIds, search, tagFilter]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, BookmarkFolder[]>();
    const folderIds = new Set(folders.map((folder) => folder.id));
    for (const folder of folders) {
      const parent = folder.parentId && folderIds.has(folder.parentId) ? folder.parentId : null;
      map.set(parent, [...(map.get(parent) ?? []), folder]);
    }
    return map;
  }, [folders]);
  const bookmarksByFolder = useMemo(() => {
    const map = new Map<string | null, Bookmark[]>();
    for (const bookmark of visibleBookmarks) {
      map.set(bookmark.folderId, [...(map.get(bookmark.folderId) ?? []), bookmark]);
    }
    return map;
  }, [visibleBookmarks]);
  const folderBookmarkCounts = useMemo(() => {
    const counts = new Map<string, number>();
    const count = (id: string, seen = new Set<string>()): number => {
      if (seen.has(id)) return 0;
      const nextSeen = new Set(seen).add(id);
      const total = (bookmarksByFolder.get(id)?.length ?? 0)
        + (childrenByParent.get(id) ?? []).reduce((sum, child) => sum + count(child.id, nextSeen), 0);
      counts.set(id, total);
      return total;
    };
    folders.forEach((folder) => count(folder.id));
    return counts;
  }, [bookmarksByFolder, childrenByParent, folders]);
  const activeFolderId = folders.some((folder) => folder.id === selectedFolderId) ? selectedFolderId : "";
  const folderViewFolders = childrenByParent.get(activeFolderId || null) ?? [];
  const folderViewBookmarks = bookmarksByFolder.get(activeFolderId || null) ?? [];

  const toggleFolder = (id: string) => {
    setExpandedFolderIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const saveBookmark = async (input: BookmarkInput) => {
    if (editor !== "new" && editor) await repository.updateBookmark(editor.id, input);
    else await repository.createBookmark(input);
    await load();
    setEditor(null);
  };

  const deleteBookmark = async (bookmark: Bookmark) => {
    if (!window.confirm(`删除书签“${bookmark.title}”？此操作无法撤销。`)) return;
    try {
      await repository.deleteBookmark(bookmark.id);
      await load();
    } catch {
      setLoadError("删除书签失败，请重试");
    }
  };

  const openBookmark = (bookmark: Bookmark) => {
    void openExternalUrl(bookmark.url, browserPreference)
      .catch(() => setLoadError("无法使用所选浏览器打开这个网址"));
  };

  const copyBookmark = async (bookmark: Bookmark) => {
    try {
      await navigator.clipboard.writeText(bookmark.url);
      setCopiedId(bookmark.id);
    } catch {
      setLoadError("无法复制书签链接");
    }
  };

  const chooseImportFile = async (file: File | undefined) => {
    if (!file) return;
    setLoadError("");
    setImportNotice("");
    try {
      const preview = parseBookmarkHtml(await file.text());
      const existingCount = await repository.countExistingBookmarks(
        preview.bookmarks.map((bookmark) => bookmark.normalizedUrl),
      );
      setImportPreview({ ...preview, existingCount });
      setImportStrategy("skip");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "无法解析 Bookmark HTML 文件");
    } finally {
      if (importInput.current) importInput.current.value = "";
    }
  };

  const importBookmarks = async () => {
    if (!importPreview) return;
    setImporting(true);
    try {
      const result = await repository.importBookmarks(importPreview.bookmarks, importStrategy);
      setImportNotice(`已导入 ${result.importedCount} 条，更新 ${result.updatedCount} 条，跳过 ${result.skippedCount} 条`);
      setImportPreview(null);
      await load();
    } catch {
      setLoadError("导入失败，未完整写入的内容已撤销，请重试");
    } finally {
      setImporting(false);
    }
  };

  const filtering = Boolean(search || folderFilter || tagFilter);

  return (
    <section className="bookmarks-page">
      <header className="bookmarks-header">
        <div>
          <p className="eyebrow">LOCAL LIBRARY</p>
          <h1>书签</h1>
          <p className="page-description">把常用资料放在一个安静、可检索的空间里。</p>
        </div>
        <div className="bookmark-header-actions">
          <input ref={importInput} className="sr-only" type="file" accept=".html,text/html"
            aria-label="选择 Bookmark HTML 文件" onChange={(event) => void chooseImportFile(event.target.files?.[0])} />
          <button type="button" className="button-secondary" onClick={() => importInput.current?.click()}>
            <Upload aria-hidden="true" size={16} />导入 HTML
          </button>
          <button type="button" className="button-primary" onClick={() => setEditor("new")}>
            <Plus aria-hidden="true" size={17} />添加书签
          </button>
        </div>
      </header>

      <div className="bookmark-toolbar">
        <label className="search-field">
          <Search aria-hidden="true" size={17} />
          <span className="sr-only">搜索书签</span>
          <input type="search" value={search} placeholder="搜索标题、网址、简介或标签"
            onChange={(event) => setSearch(event.target.value)} />
        </label>
        <label className="filter-field">
          <Folder aria-hidden="true" size={16} />
          <span className="sr-only">按文件夹筛选</span>
          <select value={folderFilter} onChange={(event) => setFolderFilter(event.target.value)}>
            <option value="">全部文件夹</option>
            {folders.map((folder) => <option key={folder.id} value={folder.id}>{folderPaths.get(folder.id) ?? folder.name}</option>)}
          </select>
        </label>
        <label className="filter-field">
          <Tag aria-hidden="true" size={16} />
          <span className="sr-only">按标签筛选</span>
          <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
            <option value="">全部标签</option>
            {tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
          </select>
        </label>
        <div className="view-toggle" aria-label="书签视图">
          <button type="button" className={view === "links" ? "active" : ""} aria-label="链接卡片视图" aria-pressed={view === "links"} onClick={() => setView("links")}><LayoutGrid aria-hidden="true" size={15} /><span>链接</span></button>
          <button type="button" className={view === "folders" ? "active" : ""} aria-label="文件夹视图" aria-pressed={view === "folders"} onClick={() => setView("folders")}><Layers3 aria-hidden="true" size={15} /><span>文件夹</span></button>
        </div>
      </div>

      <div className="bookmark-result-meta">
        <span>{visibleBookmarks.length} 条资料</span>
        {filtering && (
          <button type="button" onClick={() => { setSearch(""); setFolderFilter(""); setTagFilter(""); }}>
            清除筛选
          </button>
        )}
      </div>

      {loadError && (
        <div role="alert" className="inline-error">
          <span>{loadError}</span>
          <button type="button" onClick={() => void load()}>重试</button>
        </div>
      )}
      {importNotice && <div role="status" className="import-notice">{importNotice}</div>}

      {loading ? (
        <p className="bookmark-status">正在整理书签…</p>
      ) : visibleBookmarks.length === 0 ? (
        <div className="bookmark-empty">
          <div className="bookmark-empty-mark">⌁</div>
          <h2>{filtering ? "没有符合条件的书签" : "这里还没有书签"}</h2>
          <p>{filtering ? "换个关键词或清除筛选试试。" : "保存第一条常用网址，开始建立你的资料索引。"}</p>
          {!filtering && <button type="button" className="button-secondary" onClick={() => setEditor("new")}>添加第一条书签</button>}
        </div>
      ) : view === "folders" ? (
        <div className="bookmark-folder-view">
          <aside className="bookmark-folder-sidebar" aria-label="文件夹目录">
            <button type="button" className={!activeFolderId ? "bookmark-folder-root selected" : "bookmark-folder-root"}
              onClick={() => setSelectedFolderId("")}>
              <Layers3 aria-hidden="true" size={16} /><span>全部书签</span><small>{visibleBookmarks.length}</small>
            </button>
            <div className="bookmark-folder-tree">
              {(childrenByParent.get(null) ?? []).map((folder) => <FolderTreeNode key={folder.id} folder={folder}
                childrenByParent={childrenByParent} counts={folderBookmarkCounts} expandedIds={expandedFolderIds}
                selectedId={activeFolderId} onToggle={toggleFolder} onSelect={setSelectedFolderId} />)}
            </div>
          </aside>
          <section className="bookmark-folder-browser" aria-labelledby="bookmark-folder-browser-title">
            <header>
              <div><p>当前位置</p><h2 id="bookmark-folder-browser-title">{activeFolderId ? folderPaths.get(activeFolderId) : "全部书签"}</h2></div>
              <span>{folderViewFolders.length} 个文件夹 · {folderViewBookmarks.length} 条链接</span>
            </header>
            <div className="bookmark-folder-browser-list">
              {folderViewFolders.map((folder) => <button type="button" key={folder.id} className="bookmark-folder-browser-folder"
                onClick={() => {
                  setSelectedFolderId(folder.id);
                  if (activeFolderId) setExpandedFolderIds((current) => new Set(current).add(activeFolderId));
                }}>
                <Folder aria-hidden="true" size={18} /><span>{folder.name}</span><small>{folderBookmarkCounts.get(folder.id) ?? 0}</small><ChevronRight aria-hidden="true" size={15} />
              </button>)}
              {folderViewBookmarks.map((bookmark) => <FolderBookmarkRow key={bookmark.id} bookmark={bookmark}
                copied={copiedId === bookmark.id} onOpen={openBookmark} onCopy={(item) => void copyBookmark(item)}
                onEdit={setEditor} onDelete={(item) => void deleteBookmark(item)} />)}
              {folderViewFolders.length === 0 && folderViewBookmarks.length === 0 && <p className="bookmark-folder-browser-empty">这个文件夹还是空的</p>}
            </div>
          </section>
        </div>
      ) : (
        <div className="bookmark-list link-view">
          {visibleBookmarks.map((bookmark) => (
            <BookmarkCard key={bookmark.id} bookmark={bookmark} folderPath={bookmark.folderId ? folderPaths.get(bookmark.folderId) ?? bookmark.folderName ?? "" : ""}
              copied={copiedId === bookmark.id} onOpen={openBookmark} onCopy={(item) => void copyBookmark(item)}
              onEdit={setEditor} onDelete={(item) => void deleteBookmark(item)} />
          ))}
        </div>
      )}

      {editor && (
        <BookmarkEditor key={editor === "new" ? "new" : editor.id}
          bookmark={editor === "new" ? null : editor}
          folders={folders}
          availableTags={tags}
          onClose={() => setEditor(null)}
          onSave={saveBookmark} />
      )}

      {importPreview && (
        <div className="dialog-backdrop">
          <section role="dialog" aria-modal="true" aria-labelledby="bookmark-import-title" className="bookmark-editor import-dialog">
            <header className="bookmark-editor-header">
              <div><p className="eyebrow">BOOKMARK IMPORT</p><h2 id="bookmark-import-title">确认导入</h2></div>
              <button type="button" className="icon-button" onClick={() => setImportPreview(null)} disabled={importing} aria-label="关闭"><X aria-hidden="true" size={18} /></button>
            </header>
            <div className="import-preview">
              <div className="import-stats">
                <span><strong>{importPreview.bookmarks.length}</strong> 条有效书签</span>
                <span><strong>{importPreview.folderPaths.length}</strong> 个文件夹</span>
                <span><strong>{importPreview.existingCount}</strong> 条资料库重复</span>
                <span><strong>{importPreview.duplicateInFileCount}</strong> 条文件内重复</span>
                <span><strong>{importPreview.invalidCount}</strong> 条无效地址</span>
              </div>
              <fieldset>
                <legend>遇到资料库中已有的网址</legend>
                <label><input type="radio" name="import-strategy" checked={importStrategy === "skip"} onChange={() => setImportStrategy("skip")} />跳过重复项</label>
                <label><input type="radio" name="import-strategy" checked={importStrategy === "fill"} onChange={() => setImportStrategy("fill")} />用导入内容补全缺失标题和文件夹</label>
              </fieldset>
              <p>导入只读取 HTML 中的链接与文件夹，不执行脚本，也不会加载其中的远程资源。</p>
              <footer className="bookmark-editor-actions">
                <button type="button" className="button-secondary" onClick={() => setImportPreview(null)} disabled={importing}>取消</button>
                <button type="button" className="button-primary" onClick={() => void importBookmarks()} disabled={importing || importPreview.bookmarks.length === 0}>{importing ? "导入中…" : "开始导入"}</button>
              </footer>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
