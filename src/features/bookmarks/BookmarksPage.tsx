import { type FormEvent, type KeyboardEvent, type MouseEvent, type PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpDown, Check, ChevronDown, ChevronRight, Clipboard, Download, ExternalLink, Folder, FolderOpen, FolderPlus, Layers3, LayoutGrid, Pencil, Plus, Search, Tag, Trash2, Upload, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { BookmarkEditor } from "./BookmarkEditor";
import { buildBookmarkHtml } from "./export";
import { parseBookmarkHtml } from "./import";
import { fetchImportBookmarkMetadata } from "./metadata";
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

type DragItem = { kind: "folder" | "bookmark"; id: string };
type BookmarkSort = "updated-desc" | "created-desc" | "created-asc" | "title-asc" | "title-desc" | "domain-asc";
const AUTO_ENRICH_IMPORT_LIMIT = 30;
type FolderDeleteRequest = {
  id: string;
  path: string;
  parentId: string | null;
  descendantIds: Set<string>;
  childCount: number;
  bookmarkCount: number;
};
type PointerDragSession = {
  item: DragItem;
  pointerId: number;
  startX: number;
  startY: number;
  active: boolean;
};
type FolderContextMenu = {
  folderId: string | null;
  folderName: string;
  x: number;
  y: number;
  mode: "menu" | "create" | "rename";
};
const ROOT_DROP_TARGET = "__root__";
const BOOKMARK_CARD_BATCH_SIZE = 48;

function localDateForFilename(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function BookmarkCard({ bookmark, folderPath, copied, onOpen, onCopy, onEdit, onDelete }: BookmarkCardProps) {
  return (
    <article className="bookmark-card">
      <div className="bookmark-card-heading">
        {bookmark.faviconUrl ? (
          <img className="bookmark-favicon" src={bookmark.faviconUrl} alt=""
            loading="lazy" decoding="async"
            onError={(event) => { event.currentTarget.style.display = "none"; }} />
        ) : <span className="bookmark-favicon-fallback">{bookmarkHostname(bookmark.url).slice(0, 1).toUpperCase()}</span>}
        <div className="bookmark-card-main">
          <div className="bookmark-domain">{bookmarkHostname(bookmark.url)}</div>
          <h2 title={bookmark.title}>{bookmark.title}</h2>
        </div>
      </div>
      <p className={bookmark.description ? "" : "muted"}>{bookmark.description || "暂无简介，可在编辑中补充这条资料的用途。"}</p>
      <span className="bookmark-url" title={bookmark.url}>{bookmark.url}</span>
      <div className="bookmark-card-meta">
        {folderPath && <span><Folder aria-hidden="true" size={13} />{folderPath}</span>}
        {bookmark.tags.map((tag) => <span key={tag} className="bookmark-tag">{tag}</span>)}
      </div>
      <div className="bookmark-card-actions">
        <div className="bookmark-card-quick-actions">
          <button type="button" className="bookmark-action-button primary" onClick={() => onOpen(bookmark)} aria-label={`打开 ${bookmark.title}`}>
            <ExternalLink aria-hidden="true" size={14} />打开网页
          </button>
          <button type="button" className={copied ? "bookmark-action-button copied" : "bookmark-action-button"} onClick={() => onCopy(bookmark)} aria-label={`复制 ${bookmark.title} 的链接`}>
            {copied ? <Check aria-hidden="true" size={14} /> : <Clipboard aria-hidden="true" size={14} />}{copied ? "已复制" : "复制链接"}
          </button>
        </div>
        <div className="bookmark-card-manage-actions">
          <button type="button" className="icon-button" onClick={() => onEdit(bookmark)} aria-label={`编辑 ${bookmark.title}`}><Pencil aria-hidden="true" size={15} /></button>
          <button type="button" className="icon-button danger" onClick={() => onDelete(bookmark)} aria-label={`删除 ${bookmark.title}`}><Trash2 aria-hidden="true" size={15} /></button>
        </div>
      </div>
    </article>
  );
}

function FolderTreeNode({
  folder, childrenByParent, counts, expandedIds, selectedId, draggedItem, dropTargetId,
  onToggle, onSelect, onContextMenu, onPointerDown, onPointerMove, onPointerUp, onPointerCancel,
}: {
  folder: BookmarkFolder;
  childrenByParent: Map<string | null, BookmarkFolder[]>;
  counts: Map<string, number>;
  expandedIds: Set<string>;
  selectedId: string;
  draggedItem: DragItem | null;
  dropTargetId: string | null;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onContextMenu: (event: MouseEvent<HTMLElement>, folder: BookmarkFolder) => void;
  onPointerDown: (event: PointerEvent<HTMLElement>, item: DragItem) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  onPointerCancel: () => void;
}) {
  const children = childrenByParent.get(folder.id) ?? [];
  const expanded = expandedIds.has(folder.id);
  const rowClasses = [
    "bookmark-folder-tree-row",
    selectedId === folder.id ? "selected" : "",
    dropTargetId === folder.id ? "drop-target" : "",
    draggedItem?.kind === "folder" && draggedItem.id === folder.id ? "dragging" : "",
  ].filter(Boolean).join(" ");
  return (
    <div className="bookmark-folder-tree-node">
      <div className={rowClasses} data-folder-drop-id={folder.id}
        onContextMenu={(event) => onContextMenu(event, folder)}>
        {children.length > 0 ? (
          <button type="button" className="folder-disclosure" aria-expanded={expanded}
            aria-label={`${expanded ? "收起" : "展开"}文件夹 ${folder.name}`} onClick={() => onToggle(folder.id)}>
            {expanded ? <ChevronDown aria-hidden="true" size={14} /> : <ChevronRight aria-hidden="true" size={14} />}
          </button>
        ) : <span className="folder-disclosure-spacer" />}
        <button type="button" className="folder-tree-select"
          onPointerDown={(event) => onPointerDown(event, { kind: "folder", id: folder.id })}
          onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}
          onClick={() => onSelect(folder.id)} aria-label={`查看文件夹 ${folder.name}`} title="拖动到其他文件夹以调整层级">
          {expanded ? <FolderOpen aria-hidden="true" size={16} /> : <Folder aria-hidden="true" size={16} />}
          <span>{folder.name}</span><small>{counts.get(folder.id) ?? 0}</small>
        </button>
      </div>
      {expanded && children.length > 0 && <div className="bookmark-folder-tree-children">
        {children.map((child) => <FolderTreeNode key={child.id} folder={child} childrenByParent={childrenByParent}
          counts={counts} expandedIds={expandedIds} selectedId={selectedId} draggedItem={draggedItem} dropTargetId={dropTargetId}
          onToggle={onToggle} onSelect={onSelect} onContextMenu={onContextMenu}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove}
          onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} />)}
      </div>}
    </div>
  );
}

function FolderBookmarkRow({ bookmark, copied, dragging, onOpen, onCopy, onEdit, onDelete, onPointerDown, onPointerMove, onPointerUp, onPointerCancel }: Omit<BookmarkCardProps, "folderPath"> & {
  dragging: boolean;
  onPointerDown: (event: PointerEvent<HTMLElement>, item: DragItem) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  onPointerCancel: () => void;
}) {
  return (
    <article className={dragging ? "bookmark-folder-link-row dragging" : "bookmark-folder-link-row"}
      onPointerDown={(event) => onPointerDown(event, { kind: "bookmark", id: bookmark.id })}
      onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}
      aria-label={`拖动书签 ${bookmark.title}`} title="拖动到文件夹以移动书签">
      <button type="button" className="bookmark-folder-link-main" onClick={() => onOpen(bookmark)} aria-label={`打开书签 ${bookmark.title}`}>
        {bookmark.faviconUrl ? <img src={bookmark.faviconUrl} alt="" loading="lazy" decoding="async" onError={(event) => { event.currentTarget.style.display = "none"; }} />
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
  const [routeParams, setRouteParams] = useSearchParams();
  const routeBookmarkId = routeParams.get("edit");
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [folders, setFolders] = useState<BookmarkFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useSessionState("fangcun:bookmarks:search", "");
  const [folderFilter, setFolderFilter] = useSessionState("fangcun:bookmarks:folder", "");
  const [tagFilter, setTagFilter] = useSessionState("fangcun:bookmarks:tag", "");
  const [storedSort, setSort] = useSessionState<BookmarkSort>("fangcun:bookmarks:sort", "updated-desc");
  const sort: BookmarkSort = ["updated-desc", "created-desc", "created-asc", "title-asc", "title-desc", "domain-asc"].includes(storedSort)
    ? storedSort
    : "updated-desc";
  const [editor, setEditor] = useState<Bookmark | "new" | null>(null);
  const [storedView, setView] = useSessionState<"links" | "folders">("fangcun:bookmarks:view", "links");
  const view = storedView === "folders" ? "folders" : "links";
  const [selectedFolderId, setSelectedFolderId] = useSessionState("fangcun:bookmarks:folder-selection", "");
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(() => new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<BookmarkImportPreview | null>(null);
  const [importStrategy, setImportStrategy] = useState<BookmarkImportStrategy>("skip");
  const [enrichAfterImport, setEnrichAfterImport] = useState(true);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [enrichingImport, setEnrichingImport] = useState(false);
  const [importNotice, setImportNotice] = useState("");
  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [folderDeleteRequest, setFolderDeleteRequest] = useState<FolderDeleteRequest | null>(null);
  const [folderDeleteConfirmed, setFolderDeleteConfirmed] = useState(false);
  const [deletingFolder, setDeletingFolder] = useState(false);
  const [folderContextMenu, setFolderContextMenu] = useState<FolderContextMenu | null>(null);
  const [folderNameDraft, setFolderNameDraft] = useState("");
  const [contextMenuError, setContextMenuError] = useState("");
  const [savingFolder, setSavingFolder] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  const pointerDrag = useRef<PointerDragSession | null>(null);
  const suppressDragClick = useRef(false);
  const loadMoreCards = useRef<HTMLButtonElement>(null);
  const handledRouteBookmarkId = useRef<string | null>(null);
  const folderContextMenuRef = useRef<HTMLDivElement>(null);
  const [visibleCardCount, setVisibleCardCount] = useState(BOOKMARK_CARD_BATCH_SIZE);

  const clearBookmarkRoute = useCallback(() => {
    if (!routeBookmarkId) return;
    const nextParams = new URLSearchParams(routeParams);
    nextParams.delete("edit");
    setRouteParams(nextParams, { replace: true });
  }, [routeBookmarkId, routeParams, setRouteParams]);

  const closeBookmarkEditor = useCallback(() => {
    setEditor(null);
    clearBookmarkRoute();
  }, [clearBookmarkRoute]);

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
    if (!routeBookmarkId) {
      handledRouteBookmarkId.current = null;
      return;
    }
    if (loading || handledRouteBookmarkId.current === routeBookmarkId) return;
    handledRouteBookmarkId.current = routeBookmarkId;
    const target = bookmarks.find((bookmark) => bookmark.id === routeBookmarkId);
    if (target) setEditor(target);
    else setLoadError("没有找到首页中选择的书签");
  }, [bookmarks, loading, routeBookmarkId]);
  useEffect(() => {
    const openEditor = () => setEditor("new");
    window.addEventListener("fangcun:quick-add", openEditor);
    return () => window.removeEventListener("fangcun:quick-add", openEditor);
  }, []);

  const closeFolderContextMenu = useCallback(() => {
    setFolderContextMenu(null);
    setFolderNameDraft("");
    setContextMenuError("");
  }, []);

  useEffect(() => {
    if (!folderContextMenu) return;
    const closeOnOutsidePointer = (event: globalThis.PointerEvent) => {
      if (!folderContextMenuRef.current?.contains(event.target as Node)) closeFolderContextMenu();
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") closeFolderContextMenu();
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("blur", closeFolderContextMenu);
    window.addEventListener("resize", closeFolderContextMenu);
    window.addEventListener("scroll", closeFolderContextMenu, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("blur", closeFolderContextMenu);
      window.removeEventListener("resize", closeFolderContextMenu);
      window.removeEventListener("scroll", closeFolderContextMenu, true);
    };
  }, [closeFolderContextMenu, folderContextMenu]);

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
  const sortedVisibleBookmarks = useMemo(() => {
    const titleCompare = (left: Bookmark, right: Bookmark) => left.title.localeCompare(right.title, "zh-CN", {
      numeric: true,
      sensitivity: "base",
    });
    return [...visibleBookmarks].sort((left, right) => {
      switch (sort) {
        case "created-desc": return right.createdAt.localeCompare(left.createdAt) || titleCompare(left, right);
        case "created-asc": return left.createdAt.localeCompare(right.createdAt) || titleCompare(left, right);
        case "title-asc": return titleCompare(left, right);
        case "title-desc": return titleCompare(right, left);
        case "domain-asc": return bookmarkHostname(left.url).localeCompare(bookmarkHostname(right.url), "en", { sensitivity: "base" }) || titleCompare(left, right);
        default: return right.updatedAt.localeCompare(left.updatedAt) || titleCompare(left, right);
      }
    });
  }, [sort, visibleBookmarks]);
  const renderedBookmarks = useMemo(
    () => sortedVisibleBookmarks.slice(0, visibleCardCount),
    [sortedVisibleBookmarks, visibleCardCount],
  );
  const remainingBookmarkCount = Math.max(sortedVisibleBookmarks.length - renderedBookmarks.length, 0);

  useEffect(() => {
    setVisibleCardCount(BOOKMARK_CARD_BATCH_SIZE);
  }, [folderFilter, search, sort, tagFilter, view]);

  useEffect(() => {
    const target = loadMoreCards.current;
    if (view !== "links" || !target || remainingBookmarkCount === 0 || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisibleCardCount((count) => count + BOOKMARK_CARD_BATCH_SIZE);
      }
    }, { rootMargin: "500px 0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [remainingBookmarkCount, view]);

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
  const activeFolder = folders.find((folder) => folder.id === activeFolderId) ?? null;
  const activeFolderTrail = useMemo(() => {
    const foldersById = new Map(folders.map((folder) => [folder.id, folder]));
    const trail: BookmarkFolder[] = [];
    const visited = new Set<string>();
    let folder = activeFolder;
    while (folder && !visited.has(folder.id)) {
      visited.add(folder.id);
      trail.unshift(folder);
      folder = folder.parentId ? foldersById.get(folder.parentId) ?? null : null;
    }
    return trail;
  }, [activeFolder, folders]);
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

  const selectFolder = (id: string) => {
    if (suppressDragClick.current) return;
    setSelectedFolderId(id);
  };

  const canDropItem = (item: DragItem, targetFolderId: string | null): boolean => {
    if (item.kind === "bookmark") {
      return bookmarks.some((bookmark) => bookmark.id === item.id && bookmark.folderId !== targetFolderId);
    }
    const source = folders.find((folder) => folder.id === item.id);
    if (!source || source.id === targetFolderId || source.parentId === targetFolderId) return false;
    let cursor = targetFolderId;
    while (cursor) {
      if (cursor === source.id) return false;
      cursor = folders.find((folder) => folder.id === cursor)?.parentId ?? null;
    }
    return true;
  };

  const finishDrag = () => {
    pointerDrag.current = null;
    setDraggedItem(null);
    setDropTargetId(null);
  };

  const moveDraggedItem = async (item: DragItem, targetFolderId: string | null) => {
    if (!canDropItem(item, targetFolderId)) return;
    try {
      if (item.kind === "folder") await repository.moveFolder(item.id, targetFolderId);
      else await repository.moveBookmark(item.id, targetFolderId);
      if (targetFolderId) setExpandedFolderIds((current) => new Set(current).add(targetFolderId));
      await load();
    } catch {
      setLoadError(item.kind === "folder" ? "无法移动文件夹，请检查目标层级后重试" : "无法移动书签，请重试");
    }
  };

  const pointerTargetFolder = (clientX: number, clientY: number): string | null | undefined => {
    const target = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-folder-drop-id]");
    const targetId = target?.dataset.folderDropId;
    if (!targetId) return undefined;
    return targetId === ROOT_DROP_TARGET ? null : targetId;
  };

  const beginPointerDrag = (event: PointerEvent<HTMLElement>, item: DragItem) => {
    if (event.button !== 0 || (event.target as Element).closest(".bookmark-folder-link-actions")) return;
    pointerDrag.current = {
      item,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
    };
  };

  const movePointerDrag = (event: PointerEvent<HTMLElement>) => {
    const session = pointerDrag.current;
    if (!session || session.pointerId !== event.pointerId) return;
    if (!session.active && Math.hypot(event.clientX - session.startX, event.clientY - session.startY) < 6) return;
    if (!session.active) {
      session.active = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setDraggedItem(session.item);
    }
    event.preventDefault();
    const targetFolderId = pointerTargetFolder(event.clientX, event.clientY);
    setDropTargetId(targetFolderId !== undefined && canDropItem(session.item, targetFolderId)
      ? targetFolderId ?? ROOT_DROP_TARGET
      : null);
  };

  const endPointerDrag = (event: PointerEvent<HTMLElement>) => {
    const session = pointerDrag.current;
    if (!session || session.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    if (!session.active) {
      pointerDrag.current = null;
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const targetFolderId = pointerTargetFolder(event.clientX, event.clientY);
    suppressDragClick.current = true;
    window.setTimeout(() => { suppressDragClick.current = false; }, 0);
    finishDrag();
    if (targetFolderId !== undefined) void moveDraggedItem(session.item, targetFolderId);
  };

  const saveBookmark = async (input: BookmarkInput) => {
    if (editor !== "new" && editor) await repository.updateBookmark(editor.id, input);
    else await repository.createBookmark(input);
    await load();
    closeBookmarkEditor();
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

  const requestFolderDeletion = (folderId: string) => {
    const folder = folders.find((item) => item.id === folderId);
    if (!folder) return;
    const descendantIds = new Set([folder.id]);
    const pending = [folder.id];
    while (pending.length > 0) {
      const parentId = pending.pop();
      if (!parentId) continue;
      for (const child of childrenByParent.get(parentId) ?? []) {
        if (descendantIds.has(child.id)) continue;
        descendantIds.add(child.id);
        pending.push(child.id);
      }
    }
    setFolderDeleteConfirmed(false);
    setFolderDeleteRequest({
      id: folder.id,
      path: folderPaths.get(folder.id) ?? folder.name,
      parentId: folder.parentId,
      descendantIds,
      childCount: Math.max(descendantIds.size - 1, 0),
      bookmarkCount: bookmarks.filter((bookmark) => bookmark.folderId && descendantIds.has(bookmark.folderId)).length,
    });
  };

  const openFolderContextMenu = (event: MouseEvent<HTMLElement>, folder: BookmarkFolder | null) => {
    event.preventDefault();
    event.stopPropagation();
    finishDrag();
    setSelectedFolderId(folder?.id ?? "");
    setFolderNameDraft("");
    setContextMenuError("");
    setFolderContextMenu({
      folderId: folder?.id ?? null,
      folderName: folder?.name ?? "全部书签",
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - 250)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - 190)),
      mode: "menu",
    });
  };

  const saveContextFolder = async (event: FormEvent) => {
    event.preventDefault();
    if (!folderContextMenu || folderContextMenu.mode === "menu" || savingFolder) return;
    const name = folderNameDraft.trim();
    if (!name) {
      setContextMenuError("请输入文件夹名称");
      return;
    }
    setSavingFolder(true);
    setContextMenuError("");
    try {
      if (folderContextMenu.mode === "rename") {
        if (!folderContextMenu.folderId) throw new Error("要重命名的文件夹不存在");
        await repository.renameFolder(folderContextMenu.folderId, name);
      } else {
        const id = await repository.createFolder(name, folderContextMenu.folderId);
        if (folderContextMenu.folderId) {
          setExpandedFolderIds((current) => new Set(current).add(folderContextMenu.folderId as string));
        }
        setSelectedFolderId(id);
      }
      closeFolderContextMenu();
      await load();
    } catch (error) {
      setContextMenuError(error instanceof Error ? error.message : "无法保存文件夹名称，请重试");
    } finally {
      setSavingFolder(false);
    }
  };

  const handleContextMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')];
    if (items.length === 0) return;
    event.preventDefault();
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
    const direction = event.key === "ArrowDown" ? 1 : -1;
    items[(currentIndex + direction + items.length) % items.length]?.focus();
  };

  const deleteFolder = async () => {
    if (!folderDeleteRequest) return;
    const hasContents = folderDeleteRequest.childCount > 0 || folderDeleteRequest.bookmarkCount > 0;
    if (hasContents && !folderDeleteConfirmed) return;
    setDeletingFolder(true);
    try {
      await repository.deleteFolder(folderDeleteRequest.id);
      const deletedIds = folderDeleteRequest.descendantIds;
      setSelectedFolderId(folderDeleteRequest.parentId ?? "");
      if (folderFilter && deletedIds.has(folderFilter)) setFolderFilter("");
      setExpandedFolderIds((current) => {
        const next = new Set(current);
        deletedIds.forEach((id) => next.delete(id));
        return next;
      });
      setFolderDeleteRequest(null);
      await load();
    } catch {
      setLoadError("无法删除文件夹，请重试");
    } finally {
      setDeletingFolder(false);
    }
  };

  const openBookmark = (bookmark: Bookmark) => {
    if (suppressDragClick.current) return;
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
      setEnrichAfterImport(preview.bookmarks.length <= AUTO_ENRICH_IMPORT_LIMIT);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "无法解析 Bookmark HTML 文件");
    } finally {
      if (importInput.current) importInput.current.value = "";
    }
  };

  const enrichImportedBookmarks = async (
    targets: { id: string; url: string }[],
    importSummary: string,
  ) => {
    setEnrichingImport(true);
    let completed = 0;
    let enriched = 0;
    let failed = 0;
    for (let index = 0; index < targets.length; index += 3) {
      const batch = targets.slice(index, index + 3);
      const results = await Promise.all(batch.map(async (target) => {
        try {
          const metadata = await fetchImportBookmarkMetadata(target.url);
          if (!metadata.description && !metadata.faviconUrl) return false;
          await repository.updateBookmarkMetadata(target.id, metadata.description, metadata.faviconUrl);
          return true;
        } catch {
          return false;
        }
      }));
      completed += batch.length;
      enriched += results.filter(Boolean).length;
      failed += results.filter((ok) => !ok).length;
      setImportNotice(`${importSummary}。正在补全简介与图标 ${completed}/${targets.length}…`);
    }
    await load();
    setImportNotice(
      `${importSummary}。标题保留 HTML 原文，已补全 ${enriched} 条简介或图标${failed ? `，${failed} 条网页未能获取` : ""}`,
    );
    setEnrichingImport(false);
  };

  const importBookmarks = async () => {
    if (!importPreview) return;
    setImporting(true);
    try {
      const result = await repository.importBookmarks(importPreview.bookmarks, importStrategy);
      const summary = `已导入 ${result.importedCount} 条，更新 ${result.updatedCount} 条，跳过 ${result.skippedCount} 条`;
      setImportNotice(summary);
      setImportPreview(null);
      await load();
      if (enrichAfterImport && result.enrichmentTargets.length > 0) {
        void enrichImportedBookmarks(result.enrichmentTargets, summary);
      }
    } catch {
      setLoadError("导入失败，未完整写入的内容已撤销，请重试");
    } finally {
      setImporting(false);
    }
  };

  const exportBookmarks = async () => {
    setExporting(true);
    setLoadError("");
    try {
      const date = localDateForFilename();
      const target = await save({
        defaultPath: `fangcun-bookmarks-${date}.html`,
        filters: [{ name: "浏览器书签", extensions: ["html"] }],
      });
      if (!target) return;
      await writeTextFile(target, buildBookmarkHtml(bookmarks, folders));
      setImportNotice(`已导出 ${bookmarks.length} 条书签`);
    } catch {
      setLoadError("导出书签失败，请重新选择保存位置后重试");
    } finally {
      setExporting(false);
    }
  };

  const filtering = Boolean(search || folderFilter || tagFilter);
  const newImportCount = importPreview
    ? Math.max(importPreview.bookmarks.length - importPreview.existingCount, 0)
    : 0;
  const importActionLabel = importing
    ? "正在导入…"
    : importPreview?.existingCount && importStrategy === "fill"
      ? newImportCount > 0
        ? `导入 ${newImportCount} 条并补全 ${importPreview.existingCount} 条`
        : `补全 ${importPreview.existingCount} 条已有书签`
      : newImportCount > 0
        ? `导入 ${newImportCount} 条书签`
        : "没有可导入的书签";
  const importActionDisabled = importing
    || !importPreview
    || importPreview.bookmarks.length === 0
    || (importStrategy === "skip" && newImportCount === 0);

  return (
    <section className="bookmarks-page">
      <header className="bookmarks-header">
        <div>
          <h1>书签</h1>
          <p className="page-description">把常用资料放在一个安静、可检索的空间里。</p>
        </div>
        <div className="bookmark-header-actions">
          <input ref={importInput} className="sr-only" type="file" accept=".html,text/html" disabled={enrichingImport}
            aria-label="选择 Bookmark HTML 文件" onChange={(event) => void chooseImportFile(event.target.files?.[0])} />
          <button type="button" className="button-secondary" disabled={enrichingImport} onClick={() => importInput.current?.click()}>
            <Upload aria-hidden="true" size={16} />{enrichingImport ? "正在补全…" : "导入 HTML"}
          </button>
          <button type="button" className="button-secondary" disabled={exporting || loading || (bookmarks.length === 0 && folders.length === 0)}
            onClick={() => void exportBookmarks()}>
            <Download aria-hidden="true" size={16} />{exporting ? "正在导出…" : "导出 HTML"}
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
        <div className="bookmark-result-actions">
          {view === "links" && (
            <label className="bookmark-sort-field">
              <ArrowUpDown aria-hidden="true" size={14} />
              <span className="sr-only">卡片排序</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as BookmarkSort)}>
                <option value="updated-desc">最近更新</option>
                <option value="created-desc">最近添加</option>
                <option value="created-asc">最早添加</option>
                <option value="title-asc">标题 A–Z</option>
                <option value="title-desc">标题 Z–A</option>
                <option value="domain-asc">网站域名</option>
              </select>
            </label>
          )}
          {filtering && (
            <button type="button" onClick={() => { setSearch(""); setFolderFilter(""); setTagFilter(""); }}>
              清除筛选
            </button>
          )}
        </div>
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
            <button type="button" className={[
              "bookmark-folder-root",
              !activeFolderId ? "selected" : "",
              dropTargetId === ROOT_DROP_TARGET ? "drop-target" : "",
            ].filter(Boolean).join(" ")}
              data-folder-drop-id={ROOT_DROP_TARGET}
              onContextMenu={(event) => openFolderContextMenu(event, null)}
              onClick={() => selectFolder("")} aria-label="查看全部书签" title="把项目拖到这里可移回根目录">
              <Layers3 aria-hidden="true" size={16} /><span>全部书签</span><small>{visibleBookmarks.length}</small>
            </button>
            <div className="bookmark-folder-tree">
              {(childrenByParent.get(null) ?? []).map((folder) => <FolderTreeNode key={folder.id} folder={folder}
                childrenByParent={childrenByParent} counts={folderBookmarkCounts} expandedIds={expandedFolderIds}
                selectedId={activeFolderId} draggedItem={draggedItem} dropTargetId={dropTargetId}
                onToggle={toggleFolder} onSelect={selectFolder} onContextMenu={openFolderContextMenu}
                onPointerDown={beginPointerDrag}
                onPointerMove={movePointerDrag} onPointerUp={endPointerDrag} onPointerCancel={finishDrag} />)}
            </div>
          </aside>
          <section className="bookmark-folder-browser" aria-labelledby="bookmark-folder-browser-title">
            <header>
              <div className="bookmark-folder-location">
                <p>当前位置</p>
                <nav className="bookmark-folder-breadcrumb" aria-label="当前文件夹路径">
                  <ol>
                    <li>
                      {activeFolderId ? (
                        <button type="button" onClick={() => selectFolder("")} aria-label="打开全部书签">全部书签</button>
                      ) : (
                        <span id="bookmark-folder-browser-title" aria-current="page">全部书签</span>
                      )}
                    </li>
                    {activeFolderTrail.map((folder, index) => {
                      const isCurrent = index === activeFolderTrail.length - 1;
                      return (
                        <li key={folder.id}>
                          <ChevronRight className="bookmark-folder-breadcrumb-separator" aria-hidden="true" size={13} />
                          {isCurrent ? (
                            <span id="bookmark-folder-browser-title" aria-current="page">{folder.name}</span>
                          ) : (
                            <button type="button" onClick={() => selectFolder(folder.id)} aria-label={`打开文件夹 ${folder.name}`}>{folder.name}</button>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </nav>
              </div>
              <div className="bookmark-folder-browser-meta">
                <span>{folderViewFolders.length} 个文件夹 · {folderViewBookmarks.length} 条链接</span>
                {activeFolder && (
                  <button type="button" className="folder-delete-button" onClick={() => requestFolderDeletion(activeFolder.id)}
                    aria-label={`删除文件夹 ${folderPaths.get(activeFolder.id) ?? activeFolder.name}`}>
                    <Trash2 aria-hidden="true" size={14} />删除文件夹
                  </button>
                )}
              </div>
            </header>
            <div className="bookmark-folder-browser-list">
              {folderViewFolders.map((folder) => <button type="button" key={folder.id}
                className={[
                  "bookmark-folder-browser-folder",
                  dropTargetId === folder.id ? "drop-target" : "",
                  draggedItem?.kind === "folder" && draggedItem.id === folder.id ? "dragging" : "",
                ].filter(Boolean).join(" ")}
                data-folder-drop-id={folder.id}
                onContextMenu={(event) => openFolderContextMenu(event, folder)}
                onPointerDown={(event) => beginPointerDrag(event, { kind: "folder", id: folder.id })}
                onPointerMove={movePointerDrag} onPointerUp={endPointerDrag} onPointerCancel={finishDrag}
                onClick={() => {
                  if (suppressDragClick.current) return;
                  setSelectedFolderId(folder.id);
                  if (activeFolderId) setExpandedFolderIds((current) => new Set(current).add(activeFolderId));
                }} aria-label={`打开文件夹 ${folder.name}`} title="拖动到其他文件夹以调整层级">
                <Folder aria-hidden="true" size={18} /><span>{folder.name}</span><small>{folderBookmarkCounts.get(folder.id) ?? 0}</small><ChevronRight aria-hidden="true" size={15} />
              </button>)}
              {folderViewBookmarks.map((bookmark) => <FolderBookmarkRow key={bookmark.id} bookmark={bookmark}
                copied={copiedId === bookmark.id} dragging={draggedItem?.kind === "bookmark" && draggedItem.id === bookmark.id}
                onOpen={openBookmark} onCopy={(item) => void copyBookmark(item)} onEdit={setEditor}
                onDelete={(item) => void deleteBookmark(item)} onPointerDown={beginPointerDrag}
                onPointerMove={movePointerDrag} onPointerUp={endPointerDrag} onPointerCancel={finishDrag} />)}
              {folderViewFolders.length === 0 && folderViewBookmarks.length === 0 && <p className="bookmark-folder-browser-empty">这个文件夹还是空的</p>}
            </div>
          </section>
        </div>
      ) : (
        <div className="bookmark-list link-view">
          {renderedBookmarks.map((bookmark) => (
            <BookmarkCard key={bookmark.id} bookmark={bookmark} folderPath={bookmark.folderId ? folderPaths.get(bookmark.folderId) ?? bookmark.folderName ?? "" : ""}
              copied={copiedId === bookmark.id} onOpen={openBookmark} onCopy={(item) => void copyBookmark(item)}
              onEdit={setEditor} onDelete={(item) => void deleteBookmark(item)} />
          ))}
          {remainingBookmarkCount > 0 && <button ref={loadMoreCards} type="button" className="bookmark-load-more"
            onClick={() => setVisibleCardCount((count) => count + BOOKMARK_CARD_BATCH_SIZE)}>
            继续显示 <small>还有 {remainingBookmarkCount} 条</small>
          </button>}
        </div>
      )}

      {folderContextMenu && (
        <div ref={folderContextMenuRef}
          className={folderContextMenu.mode === "menu" ? "bookmark-context-menu" : "bookmark-context-menu edit-mode"}
          style={{ left: folderContextMenu.x, top: folderContextMenu.y }}
          role={folderContextMenu.mode === "menu" ? "menu" : "dialog"}
          aria-label={folderContextMenu.mode === "menu"
            ? `${folderContextMenu.folderName} 文件夹操作`
            : folderContextMenu.mode === "rename"
              ? `重命名文件夹 ${folderContextMenu.folderName}`
              : `在 ${folderContextMenu.folderName} 中新建文件夹`}
          onKeyDown={handleContextMenuKeyDown}>
          {folderContextMenu.mode === "menu" ? (
            <>
              <button type="button" role="menuitem" autoFocus
                onClick={() => setFolderContextMenu((current) => current ? { ...current, mode: "create" } : null)}>
                <FolderPlus aria-hidden="true" size={15} />
                <span>{folderContextMenu.folderId ? "新建子文件夹…" : "新建文件夹…"}</span>
              </button>
              {folderContextMenu.folderId && (
                <>
                  <button type="button" role="menuitem" onClick={() => {
                    setFolderNameDraft(folderContextMenu.folderName);
                    setFolderContextMenu((current) => current ? { ...current, mode: "rename" } : null);
                  }}>
                    <Pencil aria-hidden="true" size={15} /><span>重命名文件夹…</span>
                  </button>
                  <span className="bookmark-context-menu-separator" role="separator" />
                  <button type="button" role="menuitem" className="danger" onClick={() => {
                    requestFolderDeletion(folderContextMenu.folderId as string);
                    closeFolderContextMenu();
                  }}>
                    <Trash2 aria-hidden="true" size={15} /><span>删除文件夹</span>
                  </button>
                </>
              )}
            </>
          ) : (
            <form onSubmit={(event) => void saveContextFolder(event)}>
              <label htmlFor="bookmark-context-folder-name">
                {folderContextMenu.mode === "rename"
                  ? `重命名“${folderContextMenu.folderName}”`
                  : folderContextMenu.folderId ? `在“${folderContextMenu.folderName}”中新建` : "新建根文件夹"}
              </label>
              <input id="bookmark-context-folder-name" autoFocus value={folderNameDraft}
                onChange={(event) => { setFolderNameDraft(event.target.value); setContextMenuError(""); }}
                placeholder="文件夹名称" aria-invalid={Boolean(contextMenuError)} />
              {contextMenuError && <p role="alert">{contextMenuError}</p>}
              <div>
                <button type="button" onClick={closeFolderContextMenu}>取消</button>
                <button type="submit" className="primary" disabled={savingFolder || !folderNameDraft.trim()}>
                  {savingFolder ? "正在保存…" : folderContextMenu.mode === "rename" ? "保存名称" : "创建文件夹"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {editor && (
        <BookmarkEditor key={editor === "new" ? "new" : editor.id}
          bookmark={editor === "new" ? null : editor}
          folders={folders}
          availableTags={tags}
          onClose={closeBookmarkEditor}
          onSave={saveBookmark} />
      )}

      {folderDeleteRequest && (
        <div className="dialog-backdrop">
          <section role="dialog" aria-modal="true" aria-labelledby="folder-delete-title" className="bookmark-editor folder-delete-dialog">
            <header className="bookmark-editor-header">
              <div><h2 id="folder-delete-title">删除文件夹？</h2></div>
              <button type="button" className="icon-button" disabled={deletingFolder}
                onClick={() => setFolderDeleteRequest(null)} aria-label="关闭删除确认">
                <X aria-hidden="true" size={18} />
              </button>
            </header>
            <div className="folder-delete-content">
              <p>即将删除“{folderDeleteRequest.path}”。此操作无法撤销。</p>
              {(folderDeleteRequest.childCount > 0 || folderDeleteRequest.bookmarkCount > 0) && (
                <>
                  <div className="folder-delete-summary" role="note">
                    {folderDeleteRequest.childCount > 0 && <span><strong>{folderDeleteRequest.childCount}</strong> 个子文件夹</span>}
                    {folderDeleteRequest.bookmarkCount > 0 && <span><strong>{folderDeleteRequest.bookmarkCount}</strong> 条书签</span>}
                  </div>
                  <label className="folder-delete-confirmation">
                    <input type="checkbox" checked={folderDeleteConfirmed}
                      onChange={(event) => setFolderDeleteConfirmed(event.target.checked)} />
                    <span>我确认删除这个文件夹及其中全部内容</span>
                  </label>
                </>
              )}
              <footer className="bookmark-editor-actions">
                <button type="button" className="button-secondary" disabled={deletingFolder}
                  onClick={() => setFolderDeleteRequest(null)}>取消</button>
                <button type="button" className="button-danger" disabled={deletingFolder || (
                  (folderDeleteRequest.childCount > 0 || folderDeleteRequest.bookmarkCount > 0) && !folderDeleteConfirmed
                )} onClick={() => void deleteFolder()}>
                  {deletingFolder ? "正在删除…" : folderDeleteRequest.childCount > 0 || folderDeleteRequest.bookmarkCount > 0
                    ? "删除全部内容" : "删除文件夹"}
                </button>
              </footer>
            </div>
          </section>
        </div>
      )}

      {importPreview && (
        <div className="dialog-backdrop">
          <section role="dialog" aria-modal="true" aria-labelledby="bookmark-import-title" className="bookmark-editor import-dialog">
            <header className="bookmark-editor-header">
              <div><h2 id="bookmark-import-title">导入检查</h2></div>
              <button type="button" className="icon-button" onClick={() => setImportPreview(null)} disabled={importing} aria-label="关闭"><X aria-hidden="true" size={18} /></button>
            </header>
            <div className="import-preview">
              <div className="import-overview" aria-label="导入内容统计">
                <span><strong>{importPreview.bookmarks.length}</strong> 条有效书签</span>
                <span><strong>{importPreview.folderPaths.length}</strong> 个文件夹</span>
              </div>
              <div className="import-checks" aria-label="自动处理结果">
                <div className="import-check-row">
                  <Check aria-hidden="true" size={16} />
                  <div><strong>重复网址</strong><span>{importPreview.duplicateInFileCount > 0 ? `${importPreview.duplicateInFileCount} 条文件内重复将自动去重` : "未发现文件内重复"}</span></div>
                </div>
                <div className="import-check-row">
                  <Check aria-hidden="true" size={16} />
                  <div><strong>无效地址</strong><span>{importPreview.invalidCount > 0 ? `${importPreview.invalidCount} 条无效地址将自动跳过` : "未发现无效地址"}</span></div>
                </div>
                <div className="import-check-row">
                  <Check aria-hidden="true" size={16} />
                  <div><strong>资料库检查</strong><span>{importPreview.existingCount > 0 ? `${importPreview.existingCount} 条网址已存在于资料库` : "未发现资料库中的重复网址"}</span></div>
                </div>
              </div>
              {importPreview.existingCount > 0 && (
                <fieldset>
                  <legend>如何处理资料库中已有的网址？</legend>
                  <label className="import-strategy-option">
                    <input type="radio" name="import-strategy" checked={importStrategy === "skip"} onChange={() => setImportStrategy("skip")} />
                    <span><strong>保留现有书签</strong><small>跳过这些网址，不修改资料库中的内容</small></span>
                  </label>
                  <label className="import-strategy-option">
                    <input type="radio" name="import-strategy" checked={importStrategy === "fill"} onChange={() => setImportStrategy("fill")} />
                    <span><strong>补全缺失信息</strong><small>只补空白标题和文件夹，不覆盖已有内容</small></span>
                  </label>
                </fieldset>
              )}
              <label className="import-enrichment-option">
                <input type="checkbox" checked={enrichAfterImport} onChange={(event) => setEnrichAfterImport(event.target.checked)} />
                <span>
                  <strong>导入后补全卡片资料</strong>
                  <small>{importPreview.bookmarks.length > AUTO_ENRICH_IMPORT_LIMIT
                    ? `本次有 ${importPreview.bookmarks.length} 条书签，为避免大量联网与 AI 请求已默认关闭；需要时仍可手动开启。`
                    : "保留 HTML 中的标题；后台抓取网站图标，并用设置中的 AI 服务生成缺失简介。"}</small>
                </span>
              </label>
              <p className="import-security-note">只读取 HTML 中的链接与文件夹，不执行脚本，也不加载远程资源。</p>
              <footer className="bookmark-editor-actions">
                <button type="button" className="button-secondary" onClick={() => setImportPreview(null)} disabled={importing}>取消</button>
                <button type="button" className="button-primary" onClick={() => void importBookmarks()} disabled={importActionDisabled}>{importActionLabel}</button>
              </footer>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
