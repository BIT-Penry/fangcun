import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { BookmarksProvider } from "../features/bookmarks/BookmarksContext";
import type { BookmarksStore } from "../features/bookmarks/types";
import { AppShell } from "./AppShell";

const bookmarks: BookmarksStore = {
  listBookmarks: async () => [],
  listFolders: async () => [],
  createBookmark: async () => undefined,
  updateBookmark: async () => undefined,
  deleteBookmark: async () => undefined,
};

describe("AppShell", () => {
  it("renders the minimal navigation and changes pages", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <BookmarksProvider repository={bookmarks}><AppShell /></BookmarksProvider>
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
