import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ToolboxPage } from "./ToolboxPage";

describe("ToolboxPage", () => {
  it("links to each available tool", () => {
    render(<MemoryRouter><ToolboxPage /></MemoryRouter>);

    expect(screen.getByRole("heading", { name: "工具箱" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "打开公式识别" })).toHaveAttribute("href", "/tools/formula");
    expect(screen.getByRole("link", { name: "打开网速测量" })).toHaveAttribute("href", "/tools/speed-test");
    expect(within(screen.getByLabelText("工具箱概览")).getByText("2")).toBeInTheDocument();
    expect(within(screen.getByLabelText("工具箱概览")).getByText("0")).toBeInTheDocument();
  });
});
