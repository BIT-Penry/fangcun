import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { DatabasePort } from "../shared/db/types";
import { AppBootstrap } from "./AppBootstrap";

describe("AppBootstrap", () => {
  it("shows the app after loading the persisted theme", async () => {
    const db = { select: vi.fn().mockResolvedValue([{ value: "dark" }]), execute: vi.fn() } as unknown as DatabasePort;
    render(<MemoryRouter><AppBootstrap loadDatabase={vi.fn().mockResolvedValue(db)} /></MemoryRouter>);
    expect(screen.getByText("正在打开方寸…")).toBeInTheDocument();
    expect(await screen.findByText("方寸")).toBeInTheDocument();
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("dark"));
  });

  it("retries initialization and restores the persisted theme", async () => {
    const user = userEvent.setup();
    const db = { select: vi.fn().mockResolvedValue([{ value: "dark" }]), execute: vi.fn() } as unknown as DatabasePort;
    const loadDatabase = vi.fn()
      .mockRejectedValueOnce(new Error("open failed"))
      .mockResolvedValueOnce(db);
    render(<MemoryRouter><AppBootstrap loadDatabase={loadDatabase} /></MemoryRouter>);
    expect(await screen.findByRole("alert")).toHaveTextContent("无法打开本地数据库");
    await user.click(screen.getByRole("button", { name: "重试" }));
    expect(loadDatabase).toHaveBeenCalledTimes(2);
    expect(await screen.findByText("方寸")).toBeInTheDocument();
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("dark"));
  });
});
