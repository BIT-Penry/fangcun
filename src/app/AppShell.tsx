import { NavLink } from "react-router-dom";
import { PRIMARY_NAV_ITEMS, SETTINGS_NAV_ITEM, type NavigationItem } from "./navigation";
import { AppRoutes } from "./routes";

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
  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-brand">方寸</div>
        <nav aria-label="主导航" className="app-navigation">
          {PRIMARY_NAV_ITEMS.map((item) => <NavigationLink key={item.path} item={item} />)}
          <div className="app-navigation-spacer" />
          <NavigationLink item={SETTINGS_NAV_ITEM} />
        </nav>
      </aside>
      <main className="app-content"><AppRoutes /></main>
    </div>
  );
}
