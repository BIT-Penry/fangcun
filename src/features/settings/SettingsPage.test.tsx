import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "../../app/theme/ThemeProvider";
import { SettingsPage } from "./SettingsPage";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

function ProgrammaticThemeControls() {
  const { setPreference } = useTheme();
  return (
    <>
      <button onClick={() => void setPreference("dark")}>选择深色</button>
      <button onClick={() => void setPreference("light")}>选择浅色</button>
    </>
  );
}

describe("SettingsPage", () => {
  it("disables theme choices while persisting a selection", async () => {
    const user = userEvent.setup();
    const write = deferred<void>();
    const save = vi.fn().mockReturnValue(write.promise);
    render(<ThemeProvider initialPreference="system" onPreferenceChange={save}><SettingsPage /></ThemeProvider>);
    await user.click(screen.getByRole("radio", { name: "深色" }));
    expect(save).toHaveBeenCalledWith("dark");
    expect(screen.getByRole("status")).toHaveTextContent("保存中…");
    for (const radio of screen.getAllByRole("radio")) expect(radio).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: "浅色" }));
    expect(save).toHaveBeenCalledOnce();
    write.resolve();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("已保存"));
  });

  it("ignores programmatic preference changes while a save is in flight", async () => {
    const user = userEvent.setup();
    const write = deferred<void>();
    const save = vi.fn().mockReturnValue(write.promise);
    render(
      <ThemeProvider initialPreference="system" onPreferenceChange={save}>
        <ProgrammaticThemeControls />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole("button", { name: "选择深色" }));
    await user.click(screen.getByRole("button", { name: "选择浅色" }));
    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith("dark");
    write.resolve();
  });

  it("restores the previous selection after a failed save", async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockRejectedValue(new Error("write failed"));
    render(<ThemeProvider initialPreference="system" onPreferenceChange={save}><SettingsPage /></ThemeProvider>);
    await user.click(screen.getByRole("radio", { name: "深色" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("保存失败，请重试"));
    await waitFor(() => expect(screen.getByRole("radio", { name: "跟随系统" })).toBeChecked());
  });
});
