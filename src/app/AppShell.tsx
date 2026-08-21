import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Plus, Search } from "lucide-react";
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
      <Icon aria-hidden="true" size={18} />
      <span>{item.label}</span>
    </NavLink>
  );
}

export function AppShell() {
  const [searchOpen, setSearchOpen] = useState(false);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const location = useLocation();
  const content = useRef<HTMLElement>(null);
  const canQuickAdd = ["/", "/bookmarks", "/prompts", "/journal"].includes(location.pathname);
  const quickAdd = useCallback(() => {
    window.dispatchEvent(new CustomEvent("fangcun:quick-add"));
  }, []);

  useEffect(() => {
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
    return () => window.removeEventListener("keydown", openSearch);
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
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-brand">方寸</div>
        <nav aria-label="主导航" className="app-navigation">
          {PRIMARY_NAV_ITEMS.map((item) => <NavigationLink key={item.path} item={item} />)}
          <button type="button" className="nav-link nav-search-button" onClick={() => setSearchOpen(true)}>
            <Search aria-hidden="true" size={18} /><span>搜索</span><kbd>⌘K</kbd>
          </button>
          {canQuickAdd && <button type="button" className="nav-link nav-search-button" onClick={quickAdd}>
            <Plus aria-hidden="true" size={18} /><span>快速添加</span><kbd>⌘N</kbd>
          </button>}
          <div className="app-navigation-spacer" />
          <NavigationLink item={SETTINGS_NAV_ITEM} />
        </nav>
      </aside>
      <main ref={content} className="app-content"><AppRoutes /></main>
      <GlobalSearch open={searchOpen} onClose={closeSearch} />
    </div>
  );
}
