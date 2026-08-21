import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppErrorBoundary } from "./AppErrorBoundary";

function BrokenPage(): never {
  throw new Error("private content must not be logged");
}

describe("AppErrorBoundary", () => {
  it("keeps a page failure from blanking the application", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<AppErrorBoundary><BrokenPage /></AppErrorBoundary>);
    expect(screen.getByRole("alert")).toHaveTextContent("本地数据没有被删除");
    expect(error).toHaveBeenCalledWith("Fangcun page rendering failed");
    expect(error).not.toHaveBeenCalledWith(expect.stringContaining("private content"));
    error.mockRestore();
  });
});
