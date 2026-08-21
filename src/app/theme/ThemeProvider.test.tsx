import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "./ThemeProvider";

function createMediaQueryList(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mediaQueryList = {
    get matches() {
      return matches;
    },
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addEventListener: (_type: "change", listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: "change", listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    },
  } as unknown as MediaQueryList;

  return {
    mediaQueryList,
    emitChange(nextMatches: boolean) {
      matches = nextMatches;
      listeners.forEach((listener) => listener({ matches: nextMatches } as MediaQueryListEvent));
    },
    listenerCount() {
      return listeners.size;
    },
  };
}

function ThemeState() {
  const { resolvedTheme } = useTheme();
  return <output aria-label="当前主题">{resolvedTheme}</output>;
}

describe("ThemeProvider", () => {
  it("updates a system preference when the operating-system theme changes", () => {
    const systemTheme = createMediaQueryList(false);
    vi.mocked(window.matchMedia).mockReturnValue(systemTheme.mediaQueryList);

    render(
      <ThemeProvider>
        <ThemeState />
      </ThemeProvider>,
    );
    expect(screen.getByLabelText("当前主题")).toHaveTextContent("light");

    act(() => systemTheme.emitChange(true));

    expect(screen.getByLabelText("当前主题")).toHaveTextContent("dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("removes the operating-system theme listener when unmounted", () => {
    const systemTheme = createMediaQueryList(false);
    vi.mocked(window.matchMedia).mockReturnValue(systemTheme.mediaQueryList);

    const { unmount } = render(
      <ThemeProvider>
        <ThemeState />
      </ThemeProvider>,
    );
    expect(systemTheme.listenerCount()).toBe(1);

    unmount();

    expect(systemTheme.listenerCount()).toBe(0);
  });
});
