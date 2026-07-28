import { describe, expect, it } from "vitest";

import { parseUnifiedDiffPatch } from "./parse-unified-diff";

describe("parseUnifiedDiffPatch", () => {
  it("tracks old/new line numbers across added, removed and unchanged lines in one hunk", () => {
    const patch = [
      "@@ -1,3 +1,4 @@",
      " line1",
      "-line2",
      "+line2 modified",
      " line3",
      "+line4",
    ].join("\n");

    const hunks = parseUnifiedDiffPatch(patch);

    expect(hunks).toEqual([
      {
        oldStartLine: 1,
        newStartLine: 1,
        lines: [
          { content: "line1", status: "unchanged", lineNumber: 1 },
          { content: "line2", status: "removed", lineNumber: 2 },
          { content: "line2 modified", status: "added", lineNumber: 2 },
          { content: "line3", status: "unchanged", lineNumber: 3 },
          { content: "line4", status: "added", lineNumber: 4 },
        ],
      },
    ]);
  });

  it("handles multiple hunks in the same patch, each with its own line counters", () => {
    const patch = ["@@ -1,2 +1,2 @@", "-a", "+b", "@@ -10,2 +10,3 @@", " c", "+d"].join("\n");

    const hunks = parseUnifiedDiffPatch(patch);

    expect(hunks).toEqual([
      {
        oldStartLine: 1,
        newStartLine: 1,
        lines: [
          { content: "a", status: "removed", lineNumber: 1 },
          { content: "b", status: "added", lineNumber: 1 },
        ],
      },
      {
        oldStartLine: 10,
        newStartLine: 10,
        lines: [
          { content: "c", status: "unchanged", lineNumber: 10 },
          { content: "d", status: "added", lineNumber: 11 },
        ],
      },
    ]);
  });

  it("ignores the 'no newline at end of file' marker without shifting line numbers", () => {
    const patch = ["@@ -1,1 +1,1 @@", "-old", "+new", "\\ No newline at end of file"].join("\n");

    const hunks = parseUnifiedDiffPatch(patch);

    expect(hunks[0].lines).toEqual([
      { content: "old", status: "removed", lineNumber: 1 },
      { content: "new", status: "added", lineNumber: 1 },
    ]);
  });

  it("a file with only removed lines never advances the new-file counter", () => {
    const patch = ["@@ -5,3 +5,0 @@", "-a", "-b", "-c"].join("\n");

    const hunks = parseUnifiedDiffPatch(patch);

    expect(hunks[0].lines).toEqual([
      { content: "a", status: "removed", lineNumber: 5 },
      { content: "b", status: "removed", lineNumber: 5 },
      { content: "c", status: "removed", lineNumber: 5 },
    ]);
  });

  it("a file with only added lines advances the new-file counter for each one", () => {
    const patch = ["@@ -1,0 +1,3 @@", "+a", "+b", "+c"].join("\n");

    const hunks = parseUnifiedDiffPatch(patch);

    expect(hunks[0].lines).toEqual([
      { content: "a", status: "added", lineNumber: 1 },
      { content: "b", status: "added", lineNumber: 2 },
      { content: "c", status: "added", lineNumber: 3 },
    ]);
  });

  it("returns no hunks for an empty patch", () => {
    expect(parseUnifiedDiffPatch("")).toEqual([]);
  });

  it("ignores content before any hunk header instead of throwing", () => {
    const patch = ["some stray line", "@@ -1,1 +1,1 @@", " kept"].join("\n");

    const hunks = parseUnifiedDiffPatch(patch);

    expect(hunks).toHaveLength(1);
    expect(hunks[0].lines).toEqual([{ content: "kept", status: "unchanged", lineNumber: 1 }]);
  });
});
