import { describe, expect, it } from "vitest";
import { buildBookmarkFolderOptions } from "./folders";

describe("bookmark folder paths", () => {
  it("builds readable paths for nested folders", () => {
    expect(buildBookmarkFolderOptions([
      { id: "research", name: "研究", parentId: null },
      { id: "papers", name: "论文", parentId: "research" },
      { id: "uav", name: "UAV", parentId: "papers" },
    ])).toEqual([
      { id: "research", path: "研究", depth: 0 },
      { id: "papers", path: "研究 / 论文", depth: 1 },
      { id: "uav", path: "研究 / 论文 / UAV", depth: 2 },
    ]);
  });
});
