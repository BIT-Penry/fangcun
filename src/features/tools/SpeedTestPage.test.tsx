import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  measureDownloadSpeed,
  measureNetworkLatency,
  measureUploadSpeed,
} from "../../shared/networkSpeed";
import { SpeedTestPage } from "./SpeedTestPage";

vi.mock("../../shared/networkSpeed", () => ({
  measureNetworkLatency: vi.fn(),
  measureDownloadSpeed: vi.fn(),
  measureUploadSpeed: vi.fn(),
}));

describe("SpeedTestPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(measureNetworkLatency).mockResolvedValue({ latencyMs: 24.6, jitterMs: 3.2, samples: 10 });
    vi.mocked(measureDownloadSpeed).mockResolvedValue({ mbps: 128.4, bytes: 10_000_000, totalBytes: 10_250_000, durationMs: 1_820, samples: 3, variationPercent: 4.2, loadedLatencyMs: 48.3, loadedJitterMs: 5.1 });
    vi.mocked(measureUploadSpeed).mockResolvedValue({ mbps: 42.8, bytes: 3_000_000, totalBytes: 3_125_000, durationMs: 1_680, samples: 3, variationPercent: 6.4, loadedLatencyMs: 72.1, loadedJitterMs: 7.6 });
  });

  it("runs latency, download and upload tests in order", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><SpeedTestPage /></MemoryRouter>);

    expect(screen.getByRole("link", { name: "返回工具箱" })).toHaveAttribute("href", "/tools");
    expect(screen.getByText("等待测量")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "开始测量" }));

    await waitFor(() => expect(measureUploadSpeed).toHaveBeenCalledOnce());
    expect(measureNetworkLatency).toHaveBeenCalledOnce();
    expect(measureDownloadSpeed).toHaveBeenCalledOnce();
    expect(vi.mocked(measureNetworkLatency).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(measureDownloadSpeed).mock.invocationCallOrder[0]);
    expect(vi.mocked(measureDownloadSpeed).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(measureUploadSpeed).mock.invocationCallOrder[0]);
    expect(await screen.findByText("连接状态优秀")).toBeInTheDocument();
    expect(screen.getByText("128")).toBeInTheDocument();
    expect(screen.getByText("42.8")).toBeInTheDocument();
    expect(screen.getByText("24.6")).toBeInTheDocument();
    expect(screen.getByText("13.4 MB")).toBeInTheDocument();
    expect(screen.getByText(/3 轮采样 · 波动 4.2% · 负载延迟 48.3 ms/)).toBeInTheDocument();
    expect(screen.getByText(/3 轮采样 · 波动 6.4% · 负载延迟 72.1 ms/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "复制结果" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "重新测量" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "复制结果" }));
    expect(screen.getByRole("button", { name: "已复制" })).toBeEnabled();
    expect(await navigator.clipboard.readText()).toContain("下载 128 Mbps");
    expect(await navigator.clipboard.readText()).toContain("下载负载延迟 48.3 ms");
  });

  it("shows a retry path when the service is unavailable", async () => {
    const user = userEvent.setup();
    vi.mocked(measureNetworkLatency).mockRejectedValue(new Error("测速服务暂时不可用"));
    render(<MemoryRouter><SpeedTestPage /></MemoryRouter>);

    await user.click(screen.getByRole("button", { name: "开始测量" }));

    expect(await screen.findByText("连接测试中断")).toBeInTheDocument();
    expect(screen.getByText("测速服务暂时不可用")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新测量" })).toBeEnabled();
    expect(measureDownloadSpeed).not.toHaveBeenCalled();
  });
});
