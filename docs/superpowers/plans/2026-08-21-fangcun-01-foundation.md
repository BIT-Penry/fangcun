# Fangcun Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable macOS Tauri application shell for 方寸 with typed navigation, system-aware theming, SQLite initialization, persisted settings, baseline tests, and a verified `.app` build.

**Architecture:** React renders the desktop interface and calls feature-scoped TypeScript services. Tauri owns the native window and SQLite plugin initialization; the frontend accesses SQLite only through a shared database adapter and repositories. This plan creates placeholder feature pages but implements no bookmark, prompt, journal, search, backup, or metadata-fetching behavior.

**Tech Stack:** Tauri 2, React, TypeScript, Vite, Tailwind CSS, Lucide React, SQLite through `tauri-plugin-sql`, Vitest, React Testing Library, pnpm

**Spec:** `docs/superpowers/specs/2026-08-21-fangcun-design.md`

## Global Constraints

- Product name is `方寸`; English and repository identifier are `Fangcun` and `fangcun`.
- MVP is tested and packaged for macOS first; architecture must remain portable to Windows and Linux.
- Core behavior is local-first and must require no account, server, telemetry, or Python runtime.
- Use Tauri 2, React, TypeScript, Vite, Tailwind CSS, Lucide, SQLite, Vitest, and React Testing Library.
- Keep Rust code limited to native permissions, plugin setup, and system boundaries.
- React pages must never concatenate SQL; SQL access goes through adapters and repositories.
- Main navigation labels are `首页`, `书签`, `提示词`, `日记`, and bottom-aligned `设置`.
- Support `浅色`, `深色`, and `跟随系统` themes.
- Do not add browser extensions, cloud sync, AI calls, rich text, reminders, analytics, or a plugin system.
- Use pnpm and commit `pnpm-lock.yaml`; do not mix npm or Yarn lockfiles.

## Plan Boundaries and Follow-up Plans

This plan is the first independently reviewable milestone. The remaining MVP is intentionally split into later plans:

1. Bookmark storage, manual capture, metadata fetching, HTML import, folders, tags, and duplicate handling.
2. Prompt storage, editing, independent tags, favorites, search, autosave, and clipboard copy.
3. Journal, calendar, Todo ordering and migration, autosave, and Home aggregation.
4. Global search, backup and restore, end-to-end tests, DMG branding, signing documentation, and release QA.

Do not implement those follow-up scopes while executing this foundation plan.

## Target File Structure

```text
fangcun/
  .github/workflows/ci.yml              # Frontend and Rust validation on macOS
  docs/development.md                    # Local development and packaging commands
  package.json                           # pnpm scripts and frontend dependencies
  pnpm-lock.yaml                         # Reproducible dependency resolution
  src/
    app/App.tsx                          # Root providers and router
    app/App.test.tsx                     # Root smoke test
    app/AppShell.tsx                     # Desktop shell composition
    app/navigation.ts                    # Typed navigation configuration
    app/routes.tsx                       # Route definitions and placeholders
    app/theme/ThemeProvider.tsx          # Theme state and system appearance listener
    app/theme/theme.ts                   # Theme types and DOM application helpers
    app/theme/theme.test.ts              # Pure theme behavior tests
    features/home/HomePage.tsx           # Foundation placeholder
    features/bookmarks/BookmarksPage.tsx # Foundation placeholder
    features/prompts/PromptsPage.tsx     # Foundation placeholder
    features/journal/JournalPage.tsx     # Foundation placeholder
    features/settings/SettingsPage.tsx   # Working theme setting UI
    shared/db/database.ts                # Tauri SQL adapter initialization
    shared/db/types.ts                   # Minimal database port
    shared/settings/SettingsRepository.ts# Persisted settings interface and SQLite implementation
    shared/settings/SettingsRepository.test.ts
    styles.css                            # Tailwind import and theme tokens
  src-tauri/
    migrations/0001_settings.sql         # Initial settings schema
    src/database.rs                       # SQL plugin migration registration
    src/lib.rs                            # Tauri builder
    tauri.conf.json                       # Fangcun metadata and macOS window configuration
```

---

### Task 1: Scaffold the Tauri React Project and Test Harness

**Files:**
- Create: `package.json`
- Create: `pnpm-lock.yaml`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/app/App.test.tsx`
- Create: `src/test/setup.ts`
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/build.rs`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/src/lib.rs`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/capabilities/default.json`
- Create: `src-tauri/icons/*`

**Interfaces:**
- Consumes: Design spec and global constraints only.
- Produces: `App(): JSX.Element`; scripts `dev`, `build`, `test`, `test:run`, `typecheck`, `tauri`; a Tauri bundle identifier `com.fangcun.app`.

- [ ] **Step 1: Scaffold into the existing repository**

From the repository root, preserve `docs/` and run the official generator into a temporary sibling directory:

```bash
pnpm create tauri-app@latest fangcun-scaffold --template react-ts --manager pnpm
```

Choose these values if the generator prompts:

```text
Project name: fangcun
Identifier: com.fangcun.app
Frontend language: TypeScript / JavaScript
Package manager: pnpm
UI template: React
UI flavor: TypeScript
```

Copy only the generated project files into the repository root, then remove the temporary directory. Do not overwrite `docs/` or `.git/`. Verify that no npm or Yarn lockfile was copied:

```bash
test ! -e package-lock.json
test ! -e yarn.lock
test -f pnpm-lock.yaml
```

- [ ] **Step 2: Install the foundation dependencies**

```bash
pnpm add react-router-dom lucide-react @tauri-apps/plugin-sql
pnpm add -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event tailwindcss @tailwindcss/vite
pnpm tauri add sql
```

Keep the generated versions and commit the resulting `pnpm-lock.yaml`. Enable the SQLite Cargo feature in `src-tauri/Cargo.toml`:

```toml
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
```

- [ ] **Step 3: Add test and typecheck scripts**

Make the `package.json` script block contain these commands in addition to the generated Tauri scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "test:run": "vitest run",
    "tauri": "tauri"
  }
}
```

Configure `vite.config.ts` with React, Tailwind, and Vitest:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    strictPort: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    clearMocks: true,
  },
});
```

Create `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Write the failing root smoke test**

Replace generated demo expectations with `src/app/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the Fangcun product name", () => {
    render(<App />);
    expect(screen.getByText("方寸")).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run the test and verify the intentional failure**

```bash
pnpm test:run src/app/App.test.tsx
```

Expected: FAIL because `src/app/App.tsx` does not yet export `App` containing `方寸`.

- [ ] **Step 6: Implement the minimal root component**

Create `src/app/App.tsx`:

```tsx
export function App() {
  return <main>方寸</main>;
}
```

Update `src/main.tsx` to import the named export:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

Create `src/styles.css`:

```css
@import "tailwindcss";

:root {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
}

body {
  margin: 0;
}
```

- [ ] **Step 7: Verify frontend and Rust baselines**

```bash
pnpm test:run src/app/App.test.tsx
pnpm typecheck
pnpm build
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected: one passing test; TypeScript, Vite, and Cargo commands exit 0.

- [ ] **Step 8: Commit the scaffold**

```bash
git add package.json pnpm-lock.yaml vite.config.ts tsconfig*.json index.html src src-tauri
git commit -m "chore: scaffold Fangcun Tauri application"
```

---

### Task 2: Add Typed Routes and the Desktop Navigation Shell

**Files:**
- Create: `src/app/navigation.ts`
- Create: `src/app/AppShell.tsx`
- Create: `src/app/AppShell.test.tsx`
- Create: `src/app/routes.tsx`
- Create: `src/features/home/HomePage.tsx`
- Create: `src/features/bookmarks/BookmarksPage.tsx`
- Create: `src/features/prompts/PromptsPage.tsx`
- Create: `src/features/journal/JournalPage.tsx`
- Create: `src/features/settings/SettingsPage.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `App(): JSX.Element` from Task 1.
- Produces: `type AppRoute = "/" | "/bookmarks" | "/prompts" | "/journal" | "/settings"`; `PRIMARY_NAV_ITEMS`; `SETTINGS_NAV_ITEM`; `AppShell(): JSX.Element`.

- [ ] **Step 1: Write the failing shell test**

Create `src/app/AppShell.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppShell } from "./AppShell";

describe("AppShell", () => {
  it("renders the minimal navigation and changes pages", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppShell />
      </MemoryRouter>,
    );

    const navigation = screen.getByRole("navigation", { name: "主导航" });
    expect(within(navigation).getByRole("link", { name: "首页" })).toHaveAttribute("aria-current", "page");
    expect(within(navigation).getByRole("link", { name: "书签" })).toBeInTheDocument();
    expect(within(navigation).getByRole("link", { name: "提示词" })).toBeInTheDocument();
    expect(within(navigation).getByRole("link", { name: "日记" })).toBeInTheDocument();
    expect(within(navigation).getByRole("link", { name: "设置" })).toBeInTheDocument();

    await user.click(within(navigation).getByRole("link", { name: "书签" }));
    expect(screen.getByRole("heading", { name: "书签" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the shell test and verify it fails**

```bash
pnpm test:run src/app/AppShell.test.tsx
```

Expected: FAIL because `AppShell` and route configuration do not exist.

- [ ] **Step 3: Define navigation as typed data**

Create `src/app/navigation.ts`:

```ts
import type { LucideIcon } from "lucide-react";
import { Bookmark, BookOpen, House, MessageSquareText, Settings } from "lucide-react";

export type AppRoute = "/" | "/bookmarks" | "/prompts" | "/journal" | "/settings";

export interface NavigationItem {
  label: string;
  path: AppRoute;
  icon: LucideIcon;
}

export const PRIMARY_NAV_ITEMS: readonly NavigationItem[] = [
  { label: "首页", path: "/", icon: House },
  { label: "书签", path: "/bookmarks", icon: Bookmark },
  { label: "提示词", path: "/prompts", icon: MessageSquareText },
  { label: "日记", path: "/journal", icon: BookOpen },
];

export const SETTINGS_NAV_ITEM: NavigationItem = {
  label: "设置",
  path: "/settings",
  icon: Settings,
};
```

- [ ] **Step 4: Create focused placeholder pages**

Create each feature page with only its own heading:

```tsx
// src/features/home/HomePage.tsx
export function HomePage() {
  return <h1 className="text-xl font-medium">首页</h1>;
}

// src/features/bookmarks/BookmarksPage.tsx
export function BookmarksPage() {
  return <h1 className="text-xl font-medium">书签</h1>;
}

// src/features/prompts/PromptsPage.tsx
export function PromptsPage() {
  return <h1 className="text-xl font-medium">提示词</h1>;
}

// src/features/journal/JournalPage.tsx
export function JournalPage() {
  return <h1 className="text-xl font-medium">日记</h1>;
}

// src/features/settings/SettingsPage.tsx
export function SettingsPage() {
  return <h1 className="text-xl font-medium">设置</h1>;
}
```

Place each exported component in the file named by its leading comment. Do not add feature controls or sample data.

- [ ] **Step 5: Add route definitions**

Create `src/app/routes.tsx`:

```tsx
import { Route, Routes } from "react-router-dom";
import { BookmarksPage } from "../features/bookmarks/BookmarksPage";
import { HomePage } from "../features/home/HomePage";
import { JournalPage } from "../features/journal/JournalPage";
import { PromptsPage } from "../features/prompts/PromptsPage";
import { SettingsPage } from "../features/settings/SettingsPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/bookmarks" element={<BookmarksPage />} />
      <Route path="/prompts" element={<PromptsPage />} />
      <Route path="/journal" element={<JournalPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  );
}
```

- [ ] **Step 6: Implement the shell**

Create `src/app/AppShell.tsx`:

```tsx
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
```

Add semantic layout classes to `src/styles.css` using Tailwind `@apply`; use neutral theme tokens and do not add animations:

```css
@import "tailwindcss";

@theme {
  --color-surface: var(--surface);
  --color-surface-muted: var(--surface-muted);
  --color-text: var(--text);
  --color-border: var(--border);
  --color-selected: var(--selected);
  --color-selected-text: var(--selected-text);
}

.app-shell { @apply grid min-h-screen grid-cols-[184px_1fr] bg-surface text-text; }
.app-sidebar { @apply flex flex-col border-r border-border p-3; }
.app-brand { @apply px-3 py-4 font-medium; }
.app-navigation { @apply flex min-h-0 flex-1 flex-col gap-1; }
.app-navigation-spacer { @apply flex-1; }
.nav-link { @apply flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm; }
.nav-link-active { @apply bg-selected text-selected-text; }
.app-content { @apply min-w-0 p-6; }
```

- [ ] **Step 7: Add the browser router at the root**

Replace `src/app/App.tsx` with:

```tsx
import { BrowserRouter } from "react-router-dom";
import { AppShell } from "./AppShell";

export function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
```

- [ ] **Step 8: Run shell tests and validation**

```bash
pnpm test:run src/app/AppShell.test.tsx src/app/App.test.tsx
pnpm typecheck
pnpm build
```

Expected: all tests pass and both validation commands exit 0.

- [ ] **Step 9: Commit the shell**

```bash
git add src/app src/features src/styles.css
git commit -m "feat: add Fangcun desktop navigation shell"
```

---

### Task 3: Add Pure Theme Logic and System Appearance Handling

**Files:**
- Create: `src/app/theme/theme.ts`
- Create: `src/app/theme/theme.test.ts`
- Create: `src/app/theme/ThemeProvider.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `AppShell` from Task 2.
- Produces: `type ThemePreference = "light" | "dark" | "system"`; `resolveTheme(preference, systemDark): ResolvedTheme`; `applyTheme(root, theme): void`; `useTheme()` returning `{ preference, setPreference, resolvedTheme }`.

- [ ] **Step 1: Write failing pure theme tests**

Create `src/app/theme/theme.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { applyTheme, resolveTheme } from "./theme";

describe("resolveTheme", () => {
  it.each([
    ["light", true, "light"],
    ["dark", false, "dark"],
    ["system", true, "dark"],
    ["system", false, "light"],
  ] as const)("resolves %s with systemDark=%s", (preference, systemDark, expected) => {
    expect(resolveTheme(preference, systemDark)).toBe(expected);
  });
});

describe("applyTheme", () => {
  it("writes the resolved theme to the document root", () => {
    const root = document.createElement("div");
    applyTheme(root, "dark");
    expect(root.dataset.theme).toBe("dark");
    expect(root.style.colorScheme).toBe("dark");
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
pnpm test:run src/app/theme/theme.test.ts
```

Expected: FAIL because `theme.ts` does not exist.

- [ ] **Step 3: Implement pure theme helpers**

Create `src/app/theme/theme.ts`:

```ts
export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  return preference === "system" ? (systemDark ? "dark" : "light") : preference;
}

export function applyTheme(root: HTMLElement, theme: ResolvedTheme): void {
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}
```

- [ ] **Step 4: Run pure tests and verify they pass**

```bash
pnpm test:run src/app/theme/theme.test.ts
```

Expected: four resolution cases and one DOM application test pass.

- [ ] **Step 5: Implement the provider with an injectable initial preference**

Create `src/app/theme/ThemeProvider.tsx`:

```tsx
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { applyTheme, resolveTheme, type ThemePreference } from "./theme";

interface ThemeContextValue {
  preference: ThemePreference;
  setPreference: (value: ThemePreference) => void;
  resolvedTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children, initialPreference = "system" }: {
  children: ReactNode;
  initialPreference?: ThemePreference;
}) {
  const media = useMemo(() => window.matchMedia("(prefers-color-scheme: dark)"), []);
  const [preference, setPreference] = useState<ThemePreference>(initialPreference);
  const [systemDark, setSystemDark] = useState(media.matches);
  const resolvedTheme = resolveTheme(preference, systemDark);

  useEffect(() => {
    const listener = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [media]);

  useEffect(() => applyTheme(document.documentElement, resolvedTheme), [resolvedTheme]);

  const value = useMemo(
    () => ({ preference, setPreference, resolvedTheme }),
    [preference, resolvedTheme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}
```

Wrap `AppShell` with `ThemeProvider` in `src/app/App.tsx`. Extend `src/test/setup.ts` so jsdom has a stable media-query implementation:

```ts
import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
```

- [ ] **Step 6: Add theme tokens**

Append to `src/styles.css`:

```css
:root,
:root[data-theme="light"] {
  --surface: #ffffff;
  --surface-muted: #f4f4f5;
  --text: #18181b;
  --border: #e4e4e7;
  --selected: #18181b;
  --selected-text: #ffffff;
}

:root[data-theme="dark"] {
  --surface: #18181b;
  --surface-muted: #27272a;
  --text: #fafafa;
  --border: #3f3f46;
  --selected: #fafafa;
  --selected-text: #18181b;
}

body { margin: 0; background: var(--surface); }
button, input, textarea, select { font: inherit; }
```

- [ ] **Step 7: Validate theme behavior**

```bash
pnpm test:run src/app/theme/theme.test.ts src/app/AppShell.test.tsx
pnpm typecheck
pnpm build
```

Expected: all commands exit 0.

- [ ] **Step 8: Commit theme support**

```bash
git add src/app/theme src/app/App.tsx src/styles.css
git commit -m "feat: add system-aware theme foundation"
```

---

### Task 4: Initialize SQLite Through a Shared Adapter

**Files:**
- Create: `src/shared/db/types.ts`
- Create: `src/shared/db/database.ts`
- Create: `src/shared/db/database.test.ts`
- Create: `src-tauri/migrations/0001_settings.sql`
- Create: `src-tauri/src/database.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/capabilities/default.json`

**Interfaces:**
- Consumes: Tauri SQL plugin installed in Task 1.
- Produces: `interface DatabasePort`; `initializeDatabase(loader?): Promise<DatabasePort>`; `resetDatabaseForTests(): void`; Rust `database::sql_plugin()`.

- [ ] **Step 1: Define the database port**

Create `src/shared/db/types.ts`:

```ts
export interface DatabasePort {
  execute(query: string, bindValues?: unknown[]): Promise<{ rowsAffected: number; lastInsertId?: number }>;
  select<T>(query: string, bindValues?: unknown[]): Promise<T[]>;
}
```

- [ ] **Step 2: Write failing adapter tests**

Create `src/shared/db/database.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { initializeDatabase, resetDatabaseForTests } from "./database";
import type { DatabasePort } from "./types";

describe("database adapter", () => {
  beforeEach(() => resetDatabaseForTests());

  it("loads the application database once", async () => {
    const fakeDb = {} as DatabasePort;
    const loader = vi.fn().mockResolvedValue(fakeDb);
    await expect(initializeDatabase(loader)).resolves.toBe(fakeDb);
    await expect(initializeDatabase(loader)).resolves.toBe(fakeDb);
    expect(loader).toHaveBeenCalledOnce();
    expect(loader).toHaveBeenCalledWith("sqlite:fangcun.db");
  });

  it("allows retry after an initialization failure", async () => {
    const fakeDb = {} as DatabasePort;
    const loader = vi.fn()
      .mockRejectedValueOnce(new Error("open failed"))
      .mockResolvedValueOnce(fakeDb);
    await expect(initializeDatabase(loader)).rejects.toThrow("open failed");
    await expect(initializeDatabase(loader)).resolves.toBe(fakeDb);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 3: Run the adapter test and verify it fails**

```bash
pnpm test:run src/shared/db/database.test.ts
```

Expected: FAIL because `database.ts` does not exist.

- [ ] **Step 4: Implement the adapter**

Create `src/shared/db/database.ts`:

```ts
import Database from "@tauri-apps/plugin-sql";
import type { DatabasePort } from "./types";

type DatabaseLoader = (url: string) => Promise<DatabasePort>;
const defaultLoader: DatabaseLoader = (url) => Database.load(url) as Promise<DatabasePort>;
let databasePromise: Promise<DatabasePort> | null = null;

export function initializeDatabase(loader: DatabaseLoader = defaultLoader): Promise<DatabasePort> {
  databasePromise ??= loader("sqlite:fangcun.db").catch((error: unknown) => {
    databasePromise = null;
    throw error;
  });
  return databasePromise;
}

export function resetDatabaseForTests(): void {
  databasePromise = null;
}
```

- [ ] **Step 5: Run the corrected adapter test**

```bash
pnpm test:run src/shared/db/database.test.ts
```

Expected: PASS; concurrent initialization is reused and a rejected initialization can be retried.

- [ ] **Step 6: Add the initial migration**

Create `src-tauri/migrations/0001_settings.sql`:

```sql
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
```

Create `src-tauri/src/database.rs`:

```rust
use tauri_plugin_sql::{Migration, MigrationKind};

pub fn sql_plugin() -> tauri_plugin_sql::Builder {
    tauri_plugin_sql::Builder::default().add_migrations(
        "sqlite:fangcun.db",
        vec![Migration {
            version: 1,
            description: "create settings table",
            sql: include_str!("../migrations/0001_settings.sql"),
            kind: MigrationKind::Up,
        }],
    )
}
```

- [ ] **Step 7: Register the plugin and narrow permissions**

Update `src-tauri/src/lib.rs`:

```rust
mod database;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(database::sql_plugin().build())
        .run(tauri::generate_context!())
        .expect("error while running Fangcun");
}
```

Set `src-tauri/capabilities/default.json` to the generated desktop window capability plus the SQL default permission:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Permissions for the Fangcun main window",
  "windows": ["main"],
  "permissions": ["core:default", "sql:default"]
}
```

Do not enable shell execution, unrestricted filesystem access, or unrelated plugins.

- [ ] **Step 8: Verify frontend and Rust database setup**

```bash
pnpm test:run src/shared/db/database.test.ts
pnpm typecheck
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected: adapter test passes; TypeScript and Cargo exit 0.

- [ ] **Step 9: Commit the database foundation**

```bash
git add src/shared/db src-tauri
git commit -m "feat: add SQLite database foundation"
```

---

### Task 5: Persist and Edit the Theme Preference

**Files:**
- Create: `src/shared/settings/SettingsRepository.ts`
- Create: `src/shared/settings/SettingsRepository.test.ts`
- Create: `src/app/AppBootstrap.tsx`
- Create: `src/app/AppBootstrap.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/features/settings/SettingsPage.tsx`
- Create: `src/features/settings/SettingsPage.test.tsx`
- Modify: `src/app/theme/ThemeProvider.tsx`

**Interfaces:**
- Consumes: `DatabasePort` and `initializeDatabase()` from Task 4; `ThemePreference` and `ThemeProvider` from Task 3.
- Produces: `SettingsRepository.getThemePreference(): Promise<ThemePreference>`; `SettingsRepository.setThemePreference(value): Promise<void>`; `AppBootstrap` that opens the database before rendering the shell.

- [ ] **Step 1: Write failing repository tests**

Create `src/shared/settings/SettingsRepository.test.ts` with an in-memory fake:

```ts
import { describe, expect, it, vi } from "vitest";
import type { DatabasePort } from "../db/types";
import { SettingsRepository } from "./SettingsRepository";

describe("SettingsRepository", () => {
  it("returns system when no theme preference exists", async () => {
    const db = { select: vi.fn().mockResolvedValue([]), execute: vi.fn() } as unknown as DatabasePort;
    await expect(new SettingsRepository(db).getThemePreference()).resolves.toBe("system");
  });

  it("upserts the selected theme", async () => {
    const execute = vi.fn().mockResolvedValue({ rowsAffected: 1 });
    const db = { select: vi.fn(), execute } as unknown as DatabasePort;
    await new SettingsRepository(db).setThemePreference("dark");
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining("ON CONFLICT(key) DO UPDATE"),
      ["theme", "dark"],
    );
  });

  it("ignores an invalid stored theme", async () => {
    const db = {
      select: vi.fn().mockResolvedValue([{ value: "sepia" }]),
      execute: vi.fn(),
    } as unknown as DatabasePort;
    await expect(new SettingsRepository(db).getThemePreference()).resolves.toBe("system");
  });
});
```

- [ ] **Step 2: Run repository tests and verify they fail**

```bash
pnpm test:run src/shared/settings/SettingsRepository.test.ts
```

Expected: FAIL because the repository does not exist.

- [ ] **Step 3: Implement the settings repository**

Create `src/shared/settings/SettingsRepository.ts`:

```ts
import type { ThemePreference } from "../../app/theme/theme";
import type { DatabasePort } from "../db/types";

const THEMES: readonly ThemePreference[] = ["light", "dark", "system"];

export class SettingsRepository {
  constructor(private readonly db: DatabasePort) {}

  async getThemePreference(): Promise<ThemePreference> {
    const rows = await this.db.select<{ value: string }>(
      "SELECT value FROM settings WHERE key = $1 LIMIT 1",
      ["theme"],
    );
    const value = rows[0]?.value;
    return THEMES.includes(value as ThemePreference) ? value as ThemePreference : "system";
  }

  async setThemePreference(value: ThemePreference): Promise<void> {
    await this.db.execute(
      `INSERT INTO settings(key, value) VALUES ($1, $2)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ["theme", value],
    );
  }
}
```

- [ ] **Step 4: Run repository tests and verify they pass**

```bash
pnpm test:run src/shared/settings/SettingsRepository.test.ts
```

Expected: all three tests pass.

- [ ] **Step 5: Write the failing bootstrap test**

Create `src/app/AppBootstrap.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { DatabasePort } from "../shared/db/types";
import { AppBootstrap } from "./AppBootstrap";

describe("AppBootstrap", () => {
  it("shows the app after loading the persisted theme", async () => {
    const db = { select: vi.fn().mockResolvedValue([{ value: "dark" }]), execute: vi.fn() } as unknown as DatabasePort;
    render(<MemoryRouter><AppBootstrap loadDatabase={vi.fn().mockResolvedValue(db)} /></MemoryRouter>);
    expect(screen.getByText("正在打开方寸…")).toBeInTheDocument();
    expect(await screen.findByText("方寸")).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("shows a retryable message when initialization fails", async () => {
    render(<MemoryRouter><AppBootstrap loadDatabase={vi.fn().mockRejectedValue(new Error("open failed"))} /></MemoryRouter>);
    expect(await screen.findByRole("alert")).toHaveTextContent("无法打开本地数据库");
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run bootstrap tests and verify they fail**

```bash
pnpm test:run src/app/AppBootstrap.test.tsx
```

Expected: FAIL because `AppBootstrap` does not exist.

- [ ] **Step 7: Implement asynchronous bootstrap**

Create `src/app/AppBootstrap.tsx` with this state contract:

```tsx
import { useEffect, useState } from "react";
import type { ThemePreference } from "./theme/theme";
import { ThemeProvider } from "./theme/ThemeProvider";
import { AppShell } from "./AppShell";
import { initializeDatabase } from "../shared/db/database";
import type { DatabasePort } from "../shared/db/types";
import { SettingsRepository } from "../shared/settings/SettingsRepository";

type BootstrapState =
  | { status: "loading" }
  | { status: "ready"; theme: ThemePreference }
  | { status: "error" };

export function AppBootstrap({ loadDatabase = initializeDatabase }: {
  loadDatabase?: () => Promise<DatabasePort>;
}) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<BootstrapState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    loadDatabase()
      .then((db) => new SettingsRepository(db).getThemePreference())
      .then((theme) => active && setState({ status: "ready", theme }))
      .catch(() => active && setState({ status: "error" }));
    return () => { active = false; };
  }, [attempt, loadDatabase]);

  if (state.status === "loading") return <p>正在打开方寸…</p>;
  if (state.status === "error") {
    return <div role="alert">无法打开本地数据库 <button onClick={() => setAttempt((value) => value + 1)}>重试</button></div>;
  }
  return <ThemeProvider initialPreference={state.theme}><AppShell /></ThemeProvider>;
}
```

Replace `App.tsx` so the router wraps `AppBootstrap`, not `AppShell` directly.

- [ ] **Step 8: Connect the Settings page to the repository**

Replace the public context contract and preference setter in `ThemeProvider.tsx` with:

```tsx
export type ThemeSaveStatus = "idle" | "saving" | "saved" | "error";

interface ThemeContextValue {
  preference: ThemePreference;
  setPreference: (value: ThemePreference) => Promise<void>;
  resolvedTheme: "light" | "dark";
  saveStatus: ThemeSaveStatus;
}

export function ThemeProvider({
  children,
  initialPreference = "system",
  onPreferenceChange = async () => undefined,
}: {
  children: ReactNode;
  initialPreference?: ThemePreference;
  onPreferenceChange?: (value: ThemePreference) => Promise<void>;
}) {
  const media = useMemo(() => window.matchMedia("(prefers-color-scheme: dark)"), []);
  const [preference, setPreferenceState] = useState<ThemePreference>(initialPreference);
  const [saveStatus, setSaveStatus] = useState<ThemeSaveStatus>("idle");
  const [systemDark, setSystemDark] = useState(media.matches);
  const resolvedTheme = resolveTheme(preference, systemDark);

  useEffect(() => {
    const listener = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [media]);

  useEffect(() => applyTheme(document.documentElement, resolvedTheme), [resolvedTheme]);

  async function setPreference(value: ThemePreference): Promise<void> {
    if (value === preference) return;
    const previous = preference;
    setPreferenceState(value);
    setSaveStatus("saving");
    try {
      await onPreferenceChange(value);
      setSaveStatus("saved");
    } catch {
      setPreferenceState(previous);
      setSaveStatus("error");
    }
  }

  const value = useMemo(
    () => ({ preference, setPreference, resolvedTheme, saveStatus }),
    [preference, resolvedTheme, saveStatus],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
```

Retain the existing `useTheme()` guard. Update the ready branch in `AppBootstrap.tsx` so `BootstrapState` stores the repository and the provider persists through it:

```tsx
type BootstrapState =
  | { status: "loading" }
  | { status: "ready"; theme: ThemePreference; repository: SettingsRepository }
  | { status: "error" };

// Inside the effect:
loadDatabase()
  .then(async (db) => {
    const repository = new SettingsRepository(db);
    const theme = await repository.getThemePreference();
    return { theme, repository };
  })
  .then(({ theme, repository }) => active && setState({ status: "ready", theme, repository }))
  .catch(() => active && setState({ status: "error" }));

// Ready return:
return (
  <ThemeProvider
    initialPreference={state.theme}
    onPreferenceChange={(value) => state.repository.setThemePreference(value)}
  >
    <AppShell />
  </ThemeProvider>
);
```

Implement `src/features/settings/SettingsPage.tsx` without importing any database code:

```tsx
import { useTheme } from "../../app/theme/ThemeProvider";
import type { ThemePreference } from "../../app/theme/theme";

const OPTIONS: readonly { value: ThemePreference; label: string }[] = [
  { value: "system", label: "跟随系统" },
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
];

export function SettingsPage() {
  const { preference, setPreference, saveStatus } = useTheme();
  return (
    <section>
      <h1 className="text-xl font-medium">设置</h1>
      <fieldset className="mt-6">
        <legend className="font-medium">主题</legend>
        {OPTIONS.map((option) => (
          <label key={option.value} className="mt-3 flex items-center gap-2">
            <input
              type="radio"
              name="theme"
              value={option.value}
              checked={preference === option.value}
              onChange={() => void setPreference(option.value)}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      <p role="status" className="mt-3 text-sm">
        {saveStatus === "saving" && "保存中…"}
        {saveStatus === "saved" && "已保存"}
        {saveStatus === "error" && "保存失败，请重试"}
      </p>
    </section>
  );
}
```

Create `src/features/settings/SettingsPage.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../../app/theme/ThemeProvider";
import { SettingsPage } from "./SettingsPage";

describe("SettingsPage", () => {
  it("persists a theme selection", async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue(undefined);
    render(<ThemeProvider initialPreference="system" onPreferenceChange={save}><SettingsPage /></ThemeProvider>);
    await user.click(screen.getByRole("radio", { name: "深色" }));
    expect(save).toHaveBeenCalledWith("dark");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("已保存"));
  });

  it("restores the previous selection after a failed save", async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockRejectedValue(new Error("write failed"));
    render(<ThemeProvider initialPreference="system" onPreferenceChange={save}><SettingsPage /></ThemeProvider>);
    await user.click(screen.getByRole("radio", { name: "深色" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("保存失败，请重试"));
    await waitFor(() => expect(screen.getByRole("radio", { name: "跟随系统" })).toBeChecked());
  });
});
```

- [ ] **Step 9: Run the complete settings validation**

```bash
pnpm test:run src/shared/settings/SettingsRepository.test.ts src/app/AppBootstrap.test.tsx src/app/theme/theme.test.ts
pnpm typecheck
pnpm build
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected: all tests and validation commands pass.

- [ ] **Step 10: Commit persisted settings**

```bash
git add src/app src/features/settings src/shared/settings
git commit -m "feat: persist Fangcun theme preference"
```

---

### Task 6: Add macOS Configuration, CI, and Foundation Acceptance Checks

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `docs/development.md`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/capabilities/default.json`
- Modify: `README.md`

**Interfaces:**
- Consumes: runnable application and tests from Tasks 1-5.
- Produces: repeatable `pnpm test:run`, `pnpm typecheck`, `pnpm build`, `cargo check`, and macOS `.app` build workflow.

- [ ] **Step 1: Configure the Fangcun macOS window**

Set these values in `src-tauri/tauri.conf.json` while retaining generated build paths:

```json
{
  "productName": "方寸",
  "identifier": "com.fangcun.app",
  "app": {
    "windows": [
      {
        "title": "方寸",
        "width": 1120,
        "height": 720,
        "minWidth": 860,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false
      }
    ]
  },
  "bundle": {
    "active": true,
    "targets": ["app", "dmg"]
  }
}
```

Do not enable updater, shell, global shortcut, notification, or unrestricted filesystem permissions.

- [ ] **Step 2: Write the development guide**

Create `docs/development.md` with exact prerequisites and commands:

```markdown
# Development

## Prerequisites

- macOS with Xcode Command Line Tools
- Node.js LTS
- pnpm
- stable Rust toolchain

## Run

`pnpm install`

`pnpm tauri dev`

## Validate

`pnpm test:run`

`pnpm typecheck`

`pnpm build`

`cargo check --manifest-path src-tauri/Cargo.toml`

## Package

`pnpm tauri build -- --bundles app`

The unsigned application is written under `src-tauri/target/release/bundle/macos/`.
```

Replace the generated `README.md` with:

```markdown
# 方寸 · Fangcun

方寸是一款本地优先的个人桌面工作台，用于集中管理书签、提示词、每日待办和随笔记录。

## Status

The repository is implementing the foundation milestone. Bookmark, prompt, journal, search, and backup workflows are on the MVP roadmap and are not complete yet.

## MVP modules

- 首页
- 书签
- 提示词
- 日记
- 设置

Fangcun stores core data locally and requires no account or hosted server.

## Development

See [docs/development.md](docs/development.md).

## Design

See [the MVP design specification](docs/superpowers/specs/2026-08-21-fangcun-design.md).
```

- [ ] **Step 3: Add macOS CI**

Create `.github/workflows/ci.yml`:

```yaml
name: ci

on:
  push:
  pull_request:

jobs:
  validate:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - uses: dtolnay/rust-toolchain@stable
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:run
      - run: pnpm typecheck
      - run: pnpm build
      - run: cargo check --manifest-path src-tauri/Cargo.toml
```

- [ ] **Step 4: Run the complete automated verification**

```bash
pnpm install --frozen-lockfile
pnpm test:run
pnpm typecheck
pnpm build
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected: every command exits 0 with no failed tests.

- [ ] **Step 5: Build and inspect the macOS app bundle**

```bash
pnpm tauri build -- --bundles app
test -d 'src-tauri/target/release/bundle/macos/方寸.app'
```

Launch the built app manually and verify:

```text
1. The title bar says 方寸.
2. 首页, 书签, 提示词, 日记, and 设置 routes open.
3. 设置 remains at the bottom of the sidebar.
4. Light, dark, and system themes render readable text and selected navigation.
5. Closing and reopening preserves the selected theme.
6. No account, network request, or Python runtime is required to start.
```

- [ ] **Step 6: Commit CI and packaging documentation**

```bash
git add .github/workflows/ci.yml docs/development.md README.md src-tauri/tauri.conf.json src-tauri/capabilities/default.json
git commit -m "chore: add macOS foundation checks"
```

- [ ] **Step 7: Record the milestone tag only after review passes**

After a reviewer confirms Tasks 1-6 satisfy this plan and the working tree is clean:

```bash
git tag -a foundation-0.1 -m "Fangcun foundation milestone"
git status --short
```

Expected: `git status --short` prints nothing. Do not push the tag unless the repository remote and publication workflow have been explicitly authorized.
