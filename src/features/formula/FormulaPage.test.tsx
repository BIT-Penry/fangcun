import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAiServiceConfig, recognizeFormula } from "../../shared/aiService";
import { FormulaPage } from "./FormulaPage";

vi.mock("../../shared/aiService", () => ({
  getAiServiceConfig: vi.fn(),
  recognizeFormula: vi.fn(),
}));

describe("FormulaPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAiServiceConfig).mockResolvedValue({
      configured: true,
      provider: "kimi",
      displayName: "Kimi",
      baseUrl: "https://api.moonshot.cn/v1",
      model: "kimi-k3",
    });
  });

  it("loads an image and renders the recognized LaTeX", async () => {
    const user = userEvent.setup();
    vi.mocked(recognizeFormula).mockResolvedValue({ latex: "\\frac{a}{b}" });
    const { container } = render(<MemoryRouter><FormulaPage /></MemoryRouter>);

    expect(screen.getByRole("link", { name: "返回工具箱" })).toHaveAttribute("href", "/tools");

    const file = new File(["formula"], "fraction.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("选择公式图片"), file);
    expect(await screen.findByAltText("待识别的公式截图")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "识别公式" }));
    await waitFor(() => expect(recognizeFormula).toHaveBeenCalledWith(expect.stringMatching(/^data:image\/png;base64,/)));
    expect(await screen.findByLabelText("LaTeX 源码")).toHaveValue("\\frac{a}{b}");
    expect(container.querySelector(".katex")).toBeInTheDocument();
  });

  it("accepts an image pasted from the clipboard", async () => {
    render(<MemoryRouter><FormulaPage /></MemoryRouter>);
    const file = new File(["formula"], "clipboard.png", { type: "image/png" });

    fireEvent.paste(window, {
      clipboardData: {
        items: [{ type: "image/png", getAsFile: () => file }],
      },
    });

    expect(await screen.findByText("clipboard.png")).toBeInTheDocument();
    expect(screen.getByAltText("待识别的公式截图")).toBeInTheDocument();
  });

  it("explains that DeepSeek cannot recognize formula images", async () => {
    vi.mocked(getAiServiceConfig).mockResolvedValue({
      configured: true,
      provider: "deepseek",
      displayName: "DeepSeek",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
    });
    render(<MemoryRouter><FormulaPage /></MemoryRouter>);

    expect(await screen.findByText("当前模型不支持图片")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "切换到 Kimi" })).toHaveAttribute("href", "/settings");
    expect(screen.getByRole("button", { name: "识别公式" })).toBeDisabled();
  });
});
