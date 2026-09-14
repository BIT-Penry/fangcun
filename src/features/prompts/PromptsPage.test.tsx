import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { PromptsProvider } from "./PromptsContext";
import { PromptsPage } from "./PromptsPage";
import type { Prompt, PromptsStore } from "./types";
import { formatPromptContent } from "../../shared/aiService";

vi.mock("../../shared/aiService", () => ({
  formatPromptContent: vi.fn(),
}));

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

function renderPage(store: PromptsStore, route = "/prompts") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <PromptsProvider repository={store}><PromptsPage /></PromptsProvider>
    </MemoryRouter>,
  );
}

describe("PromptsPage", () => {
  it("opens the exact prompt selected from the homepage", async () => {
    renderPage(createStore(), "/prompts?open=prompt-1");

    const dialog = await screen.findByRole("dialog", { name: "编辑提示词" });
    expect(within(dialog).getByLabelText("提示词正文")).toHaveValue("Summarize the following paper.");
  });

  it("filters and opens a saved prompt", async () => {
    const user = userEvent.setup();
    renderPage(createStore());
    await user.click(await screen.findByRole("button", { name: "查看 论文摘要" }));
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
    expect(screen.getByRole("button", { name: "查看 论文摘要" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "查看 临时想法" })).toBeInTheDocument();
    expect(screen.queryByText("把好用的表达留下来")).not.toBeInTheDocument();
  });

  it("reuses existing tags and creates new tags", async () => {
    const user = userEvent.setup();
    const writingPrompt = { ...prompt, id: "prompt-2", title: "写作助手", tags: ["写作"], isFavorite: false };
    const store = createStore({ listPrompts: vi.fn().mockResolvedValue([prompt, writingPrompt]) });
    renderPage(store);

    await user.click(await screen.findByRole("button", { name: "查看 论文摘要" }));
    const dialog = screen.getByRole("dialog", { name: "编辑提示词" });
    const tagInput = within(dialog).getByRole("textbox", { name: "搜索或新建标签" });
    await user.click(tagInput);
    const writingTag = within(dialog).getByRole("checkbox", { name: "写作" });
    await user.click(writingTag);
    expect(writingTag).toBeChecked();
    expect(within(dialog).getByRole("checkbox", { name: "研究" })).toBeChecked();
    await user.type(tagInput, "灵感");
    await user.click(within(dialog).getByRole("button", { name: "创建“灵感”" }));
    window.dispatchEvent(new Event("blur"));

    await waitFor(() => expect(store.updatePrompt).toHaveBeenCalledWith("prompt-1", expect.objectContaining({
      tags: ["研究", "写作", "灵感"],
    })), { timeout: 2000 });
    expect(within(dialog).getByRole("button", { name: "移除标签 灵感" })).toBeInTheDocument();
  });

  it("copies the prompt body with one click", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    renderPage(createStore());

    await user.click(await screen.findByRole("button", { name: "查看 论文摘要" }));
    const dialog = screen.getByRole("dialog", { name: "编辑提示词" });
    await user.click(within(dialog).getByRole("button", { name: "复制正文" }));

    expect(writeText).toHaveBeenCalledWith("Summarize the following paper.");
    expect(within(dialog).getByRole("button", { name: "已复制" })).toBeInTheDocument();
  });

  it("copies a prompt directly from its library card without opening the editor", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    renderPage(createStore());

    await user.click(await screen.findByRole("button", { name: "复制 论文摘要 的正文" }));

    expect(writeText).toHaveBeenCalledWith("Summarize the following paper.");
    expect(screen.getByRole("button", { name: "复制 论文摘要 的正文" })).toHaveTextContent("已复制");
    expect(screen.queryByRole("dialog", { name: "编辑提示词" })).not.toBeInTheDocument();
  });

  it("previews AI format corrections before applying them", async () => {
    const user = userEvent.setup();
    const store = createStore();
    vi.mocked(formatPromptContent).mockResolvedValueOnce({
      content: "# 任务\n\n- Summarize the following paper.",
    });
    renderPage(store);

    await user.click(await screen.findByRole("button", { name: "查看 论文摘要" }));
    const dialog = screen.getByRole("dialog", { name: "编辑提示词" });
    await user.click(within(dialog).getByRole("button", { name: "AI 校正格式" }));

    expect(formatPromptContent).toHaveBeenCalledWith("Summarize the following paper.");
    expect(await within(dialog).findByRole("region", { name: "格式校正预览" })).toHaveTextContent("# 任务");
    expect(within(dialog).getByLabelText("提示词正文")).toHaveValue("Summarize the following paper.");

    await user.click(within(dialog).getByRole("button", { name: "应用格式" }));
    expect(within(dialog).getByLabelText("提示词正文")).toHaveValue("# 任务\n\n- Summarize the following paper.");
    await waitFor(() => expect(store.updatePrompt).toHaveBeenCalledWith("prompt-1", expect.objectContaining({
      content: "# 任务\n\n- Summarize the following paper.",
    })), { timeout: 2000 });
  });

  it("keeps the original prompt when AI format correction fails", async () => {
    const user = userEvent.setup();
    vi.mocked(formatPromptContent).mockRejectedValueOnce(new Error("请先在设置中配置 AI 服务"));
    renderPage(createStore());

    await user.click(await screen.findByRole("button", { name: "查看 论文摘要" }));
    const dialog = screen.getByRole("dialog", { name: "编辑提示词" });
    await user.click(within(dialog).getByRole("button", { name: "AI 校正格式" }));

    expect(await within(dialog).findByText("请先在设置中配置 AI 服务")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("提示词正文")).toHaveValue("Summarize the following paper.");
    expect(within(dialog).queryByRole("region", { name: "格式校正预览" })).not.toBeInTheDocument();
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
