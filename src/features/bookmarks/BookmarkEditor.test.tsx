import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BookmarkEditor } from "./BookmarkEditor";

const baseProps = {
  bookmark: null,
  folders: [],
  availableTags: [],
  onClose: vi.fn(),
  onSave: vi.fn().mockResolvedValue(undefined),
};

describe("BookmarkEditor metadata", () => {
  it("fetches metadata after the URL loses focus and fills empty fields", async () => {
    const user = userEvent.setup();
    const metadataLoader = vi.fn().mockResolvedValue({
      title: "Example Docs",
      description: "Reference guide",
      faviconUrl: "https://example.com/icon.png",
      aiEnhanced: false,
      warning: null,
    });
    render(<BookmarkEditor {...baseProps} metadataLoader={metadataLoader} />);

    await user.type(screen.getByLabelText("网页地址"), "https://example.com/docs");
    await user.tab();

    await waitFor(() => expect(metadataLoader).toHaveBeenCalledWith("https://example.com/docs"));
    expect(await screen.findByDisplayValue("Example Docs")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Reference guide")).toBeInTheDocument();
    expect(screen.getByText("已读取网页原始信息")).toBeInTheDocument();
  });

  it("preserves text the user already entered", async () => {
    const user = userEvent.setup();
    const metadataLoader = vi.fn().mockResolvedValue({
      title: "Fetched title",
      description: "Fetched description",
      faviconUrl: null,
      aiEnhanced: false,
      warning: null,
    });
    render(<BookmarkEditor {...baseProps} metadataLoader={metadataLoader} />);

    await user.type(screen.getByLabelText(/标题/), "My title");
    await user.type(screen.getByLabelText("网页地址"), "https://example.com");
    await user.click(screen.getByLabelText("简介"));

    await screen.findByDisplayValue("Fetched description");
    expect(screen.getByDisplayValue("My title")).toBeInTheDocument();
  });

  it("keeps manual saving available when metadata fetching fails", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const aiMetadataLoader = vi.fn().mockRejectedValue(new Error("offline"));
    render(<BookmarkEditor {...baseProps} onSave={onSave} aiMetadataLoader={aiMetadataLoader} />);

    await user.type(screen.getByLabelText("网页地址"), "https://example.com");
    await user.click(screen.getByRole("button", { name: "AI 获取网页信息" }));
    expect(await screen.findByText("offline")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/标题/), "Manual title");
    await user.click(screen.getByRole("button", { name: "保存书签" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      title: "Manual title",
      faviconUrl: "",
    })));
  });

  it("uses DeepSeek metadata when the user explicitly requests AI整理", async () => {
    const user = userEvent.setup();
    const aiMetadataLoader = vi.fn().mockResolvedValue({
      title: "面向开发者的示例文档",
      description: "介绍示例接口的主要用途与使用方式。",
      faviconUrl: "https://example.com/icon.png",
      aiEnhanced: true,
      warning: null,
    });
    render(<BookmarkEditor {...baseProps} aiMetadataLoader={aiMetadataLoader} />);

    await user.type(screen.getByLabelText("网页地址"), "https://example.com/docs");
    await user.click(screen.getByRole("button", { name: "AI 获取网页信息" }));

    await waitFor(() => expect(aiMetadataLoader).toHaveBeenCalledWith("https://example.com/docs"));
    expect(await screen.findByDisplayValue("面向开发者的示例文档")).toBeInTheDocument();
    expect(screen.getByDisplayValue("介绍示例接口的主要用途与使用方式。")).toBeInTheDocument();
    expect(screen.getByText("DeepSeek 已生成标题与简介，可继续修改")).toBeInTheDocument();
  });

  it("selects nested folders and reuses existing tags", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<BookmarkEditor {...baseProps} onSave={onSave} availableTags={["研究", "工具"]} folders={[
      { id: "research", name: "研究", parentId: null },
      { id: "papers", name: "论文", parentId: "research" },
    ]} />);

    await user.type(screen.getByLabelText("网页地址"), "https://example.com");
    await user.selectOptions(screen.getByRole("combobox", { name: "选择已有文件夹" }), "研究 / 论文");
    await user.click(screen.getByLabelText("搜索或新建书签标签"));
    await user.click(screen.getByRole("checkbox", { name: "研究" }));
    expect(screen.getByRole("checkbox", { name: "研究" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "保存书签" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      folderName: "研究 / 论文",
      tags: ["研究"],
    })));
  });
});
