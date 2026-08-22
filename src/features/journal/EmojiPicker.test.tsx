import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EmojiPicker } from "./EmojiPicker";

describe("EmojiPicker", () => {
  it("does not duplicate recently used emoji in the full grid", async () => {
    const user = userEvent.setup();
    render(<EmojiPicker onSelect={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "选择表情 😊" }));

    expect(screen.getAllByRole("button", { name: "选择表情 😊" })).toHaveLength(1);
    expect(screen.getByText("最近使用")).toBeInTheDocument();
  });
});
