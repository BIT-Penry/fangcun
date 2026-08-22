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
    });
    render(<BookmarkEditor {...baseProps} metadataLoader={metadataLoader} />);

    await user.type(screen.getByLabelText("网页地址"), "https://example.com/docs");
    await user.tab();

    await waitFor(() => expect(metadataLoader).toHaveBeenCalledWith("https://example.com/docs"));
    expect(await screen.findByDisplayValue("Example Docs")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Reference guide")).toBeInTheDocument();
    expect(screen.getByText("已获取网页信息，可继续手动修改")).toBeInTheDocument();
  });

  it("preserves text the user already entered", async () => {
    const user = userEvent.setup();
    const metadataLoader = vi.fn().mockResolvedValue({
      title: "Fetched title",
      description: "Fetched description",
      faviconUrl: null,
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
    const metadataLoader = vi.fn().mockRejectedValue(new Error("offline"));
    render(<BookmarkEditor {...baseProps} onSave={onSave} metadataLoader={metadataLoader} />);

    await user.type(screen.getByLabelText("网页地址"), "https://example.com");
    await user.click(screen.getByRole("button", { name: "获取网页信息" }));
    expect(await screen.findByText("未能获取网页信息，仍可手动填写并保存")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/标题/), "Manual title");
    await user.click(screen.getByRole("button", { name: "保存书签" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      title: "Manual title",
      faviconUrl: "",
    })));
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
