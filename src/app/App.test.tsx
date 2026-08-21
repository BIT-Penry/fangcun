import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the database bootstrap state", () => {
    render(<App />);
    expect(screen.getByText("正在打开方寸…")).toBeInTheDocument();
  });
});
