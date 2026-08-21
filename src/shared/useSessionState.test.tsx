import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it } from "vitest";
import { useSessionState } from "./useSessionState";

describe("useSessionState", () => {
  it("restores UI state without writing business data", async () => {
    window.sessionStorage.setItem("test:filter", JSON.stringify("研究"));
    const { result } = renderHook(() => useSessionState("test:filter", ""));
    expect(result.current[0]).toBe("研究");
    act(() => result.current[1]("工具"));
    await waitFor(() => expect(window.sessionStorage.getItem("test:filter")).toBe(JSON.stringify("工具")));
  });
});
