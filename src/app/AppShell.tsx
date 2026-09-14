import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Search, SquarePlus } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { PRIMARY_NAV_ITEMS, SETTINGS_NAV_ITEM, type NavigationItem } from "./navigation";
import { AppRoutes } from "./routes";
import { GlobalSearch } from "../features/search/GlobalSearch";

function NavigationLink({ item }: { item: NavigationItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      end={item.path === "/"}
      className={({ isActive }) => `nav-link${isActive ? " nav-link-active" : ""}`}
    >
      <span className="nav-icon" aria-hidden="true"><Icon size={18} /></span>
      <span>{item.label}</span>
    </NavLink>
  );
}

export function AppShell() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const location = useLocation();
  const content = useRef<HTMLElement>(null);
  const canQuickAdd = ["/", "/bookmarks", "/prompts", "/skills", "/journal"].includes(location.pathname);
  const quickAdd = useCallback(() => {
    window.dispatchEvent(new CustomEvent("fangcun:quick-add"));
  }, []);

  useEffect(() => {
    const showSearch = () => setSearchOpen(true);
    const openSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "n" && canQuickAdd) {
        event.preventDefault();
        quickAdd();
      }
    };
    window.addEventListener("keydown", openSearch);
    window.addEventListener("fangcun:open-search", showSearch);
    return () => {
      window.removeEventListener("keydown", openSearch);
      window.removeEventListener("fangcun:open-search", showSearch);
    };
  }, [canQuickAdd, quickAdd]);

  useLayoutEffect(() => {
    const element = content.current;
    if (!element) return;
    const key = `fangcun:scroll:${location.pathname}`;
    const saved = Number(window.sessionStorage.getItem(key) ?? 0);
    element.scrollTop = Number.isFinite(saved) ? saved : 0;
    return () => {
      try { window.sessionStorage.setItem(key, String(element.scrollTop)); } catch { /* non-critical UI state */ }
    };
  }, [location.pathname]);

  return (
    <div className={sidebarCollapsed ? "app-shell sidebar-collapsed" : "app-shell"}>
      <aside className="app-sidebar">
        <div className="app-sidebar-heading">
          <div className="app-brand" aria-label="方寸">
            <span className="app-brand-mark" aria-hidden="true">方</span>
            <span className="app-brand-word">方寸</span>
          </div>
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed((current) => !current)}
            aria-label={sidebarCollapsed ? "展开侧栏" : "收起侧栏"}
          >
            {sidebarCollapsed
              ? <ChevronRight aria-hidden="true" size={18} />
              : <ChevronLeft aria-hidden="true" size={18} />}
          </button>
        </div>
        <nav aria-label="主导航" className="app-navigation">
          {PRIMARY_NAV_ITEMS.map((item) => <NavigationLink key={item.path} item={item} />)}
          <div className="app-navigation-utilities">
            <button type="button" className="nav-link nav-search-button" onClick={() => setSearchOpen(true)}>
              <span className="nav-icon" aria-hidden="true"><Search size={18} /></span><span>搜索</span><kbd>⌘K</kbd>
            </button>
            {canQuickAdd && <button type="button" className="nav-link nav-search-button" onClick={quickAdd}>
              <span className="nav-icon" aria-hidden="true"><SquarePlus size={18} /></span><span>快速添加</span><kbd>⌘N</kbd>
            </button>}
          </div>
          <div className="app-navigation-spacer" />
          <NavigationLink item={SETTINGS_NAV_ITEM} />
        </nav>
      </aside>
      <main ref={content} className="app-content"><AppRoutes /></main>
      <GlobalSearch open={searchOpen} onClose={closeSearch} />
    </div>
  );
}
