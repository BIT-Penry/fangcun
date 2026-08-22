import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PromptsProvider } from "./PromptsContext";
import { PromptsPage } from "./PromptsPage";
import type { Prompt, PromptsStore } from "./types";

const prompt: Prompt = {
  id: "prompt-1",
  title: "论文摘要",
  content: "Summarize the following paper.",
  notes: "用于精读",
  isFavorite: true,
  tags: ["研究"],
  createdAt: "2026-08-21T00:00:00.000Z",
  updatedAt: "2026-08-21T00:00:00.000Z",
};

function createStore(overrides: Partial<PromptsStore> = {}): PromptsStore {
  return {
    listPrompts: vi.fn().mockResolvedValue([prompt]),
    createPrompt: vi.fn().mockResolvedValue("prompt-new"),
    updatePrompt: vi.fn().mockResolvedValue(undefined),
    deletePrompt: vi.fn().mockResolvedValue(undefined),
    searchPrompts: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function renderPage(store: PromptsStore) {
  return render(<PromptsProvider repository={store}><PromptsPage /></PromptsProvider>);
}

describe("PromptsPage", () => {
  it("filters and opens a saved prompt", async () => {
    const user = userEvent.setup();
    renderPage(createStore());
    await user.click(await screen.findByRole("button", { name: /论文摘要/ }));
    const dialog = screen.getByRole("dialog", { name: "编辑提示词" });
    expect(within(dialog).getByLabelText("提示词正文")).toHaveValue("Summarize the following paper.");
    await user.click(within(dialog).getByRole("button", { name: "关闭" }));
    await user.type(screen.getByRole("searchbox", { name: "搜索提示词" }), "不存在");
    expect(screen.getByText("没有符合条件的提示词")).toBeInTheDocument();
  });

  it("groups the library by tags and keeps untagged prompts visible", async () => {
    const untagged = { ...prompt, id: "prompt-2", title: "临时想法", tags: [], isFavorite: false };
    renderPage(createStore({ listPrompts: vi.fn().mockResolvedValue([prompt, untagged]) }));

    expect(await screen.findByRole("heading", { name: "研究" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "未分类" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /论文摘要/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /临时想法/ })).toBeInTheDocument();
    expect(screen.queryByText("把好用的表达留下来")).not.toBeInTheDocument();
  });

  it("creates a prompt after the autosave delay", async () => {
    const user = userEvent.setup();
    const store = createStore({ listPrompts: vi.fn().mockResolvedValue([]) });
    renderPage(store);
    await user.click(screen.getByRole("button", { name: "新建提示词" }));
    const dialog = screen.getByRole("dialog", { name: "新建提示词" });
    await user.type(within(dialog).getByLabelText("提示词标题"), "代码审查");
    await user.type(within(dialog).getByLabelText("提示词正文"), "Review this change.");
    window.dispatchEvent(new Event("blur"));
    await waitFor(() => expect(store.createPrompt).toHaveBeenCalledWith(expect.objectContaining({
      title: "代码审查",
      content: "Review this change.",
    })), { timeout: 2000 });
    expect(await within(dialog).findByText("已保存")).toBeInTheDocument();
  });
});
