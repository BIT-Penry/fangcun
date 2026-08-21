import { render, screen, waitFor } from "@testing-library/react";
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
    expect(screen.getByLabelText("提示词正文")).toHaveValue("Summarize the following paper.");
    await user.type(screen.getByRole("searchbox", { name: "搜索提示词" }), "不存在");
    expect(screen.getByText("没有符合条件的提示词")).toBeInTheDocument();
  });

  it("creates a prompt after the autosave delay", async () => {
    const user = userEvent.setup();
    const store = createStore({ listPrompts: vi.fn().mockResolvedValue([]) });
    renderPage(store);
    await user.click(screen.getAllByRole("button", { name: "新建提示词" })[0]);
    await user.type(screen.getByLabelText("提示词标题"), "代码审查");
    await user.type(screen.getByLabelText("提示词正文"), "Review this change.");
    window.dispatchEvent(new Event("blur"));
    await waitFor(() => expect(store.createPrompt).toHaveBeenCalledWith(expect.objectContaining({
      title: "代码审查",
      content: "Review this change.",
    })), { timeout: 2000 });
    expect(await screen.findByText("已保存")).toBeInTheDocument();
  });
});
