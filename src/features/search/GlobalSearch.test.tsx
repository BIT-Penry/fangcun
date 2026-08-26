import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { BookmarksProvider } from "../bookmarks/BookmarksContext";
import type { BookmarksStore } from "../bookmarks/types";
import { JournalProvider } from "../journal/JournalContext";
import type { JournalStore } from "../journal/types";
import { PromptsProvider } from "../prompts/PromptsContext";
import type { PromptsStore } from "../prompts/types";
import { GlobalSearch } from "./GlobalSearch";
import { SkillsProvider } from "../skills/SkillsContext";
import type { SkillsStore } from "../skills/types";

const bookmarks = {
  searchBookmarks: vi.fn().mockResolvedValue([{
    id: "bookmark-1", url: "https://pytorch.org", normalizedUrl: "https://pytorch.org/",
    title: "PyTorch", description: "", faviconUrl: null, folderId: null, folderName: null,
    tags: [], createdAt: "", updatedAt: "",
  }]),
} as unknown as BookmarksStore;
const prompts = {
  searchPrompts: vi.fn().mockResolvedValue([{
    id: "prompt-1", title: "代码审查", content: "Review PyTorch code", notes: "",
    isFavorite: false, tags: [], createdAt: "", updatedAt: "",
  }]),
} as unknown as PromptsStore;
const journal = {
  searchJournal: vi.fn().mockResolvedValue([{
    id: "todo-1", date: "2026-08-21", content: "更新 PyTorch 实验", kind: "todo",
  }]),
} as unknown as JournalStore;
const skills = {
  searchSkills: vi.fn().mockResolvedValue([{
    id: "skill-1", name: "PyTorch 论文精读", description: "读取论文与代码", content: "# Skill",
    notes: "", sourceName: "SKILL.md", packageType: "markdown", packageData: null,
    coverDataUrl: null, isFavorite: false, tags: [], compatibility: [], resources: [],
    createdAt: "", updatedAt: "",
  }]),
} as unknown as SkillsStore;

describe("GlobalSearch", () => {
  it("searches all local modules and groups the results", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <BookmarksProvider repository={bookmarks}>
          <PromptsProvider repository={prompts}>
            <SkillsProvider repository={skills}>
              <JournalProvider repository={journal}>
                <GlobalSearch open onClose={vi.fn()} />
              </JournalProvider>
            </SkillsProvider>
          </PromptsProvider>
        </BookmarksProvider>
      </MemoryRouter>,
    );
    await user.type(screen.getByRole("searchbox", { name: "搜索方寸" }), "PyTorch");
    await waitFor(() => expect(bookmarks.searchBookmarks).toHaveBeenCalledWith("PyTorch", 5));
    expect(await screen.findByText("Review PyTorch code")).toBeInTheDocument();
    expect(screen.getByText("读取论文与代码")).toBeInTheDocument();
    expect(screen.getByText("更新 PyTorch 实验")).toBeInTheDocument();
  });
});
