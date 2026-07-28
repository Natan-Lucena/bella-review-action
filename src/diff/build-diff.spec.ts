import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { buildDiff } from "./build-diff";
import { GithubFilesClient } from "./github-files-client";

describe("buildDiff", () => {
  it("parses each file's patch into structured hunks/lines", async () => {
    const filesClient = mock<GithubFilesClient>();
    filesClient.listFiles.mockResolvedValue([
      { filename: "src/a.ts", patch: "@@ -1,1 +1,1 @@\n-old\n+new" },
    ]);

    const diff = await buildDiff(filesClient, { owner: "org", repo: "repo", prNumber: 42 });

    expect(diff.files).toEqual([
      {
        path: "src/a.ts",
        hunks: [
          {
            oldStartLine: 1,
            newStartLine: 1,
            lines: [
              { content: "old", status: "removed", lineNumber: 1 },
              { content: "new", status: "added", lineNumber: 1 },
            ],
          },
        ],
      },
    ]);
  });

  it("excludes files without a patch (binary or too large)", async () => {
    const filesClient = mock<GithubFilesClient>();
    filesClient.listFiles.mockResolvedValue([
      { filename: "src/a.ts", patch: "@@ -1,1 +1,1 @@\n-old\n+new" },
      { filename: "assets/logo.png" }, // no patch field
    ]);

    const diff = await buildDiff(filesClient, { owner: "org", repo: "repo", prNumber: 42 });

    expect(diff.files).toHaveLength(1);
    expect(diff.files[0]?.path).toBe("src/a.ts");
  });

  it("returns an empty file list when the PR has no diffable files", async () => {
    const filesClient = mock<GithubFilesClient>();
    filesClient.listFiles.mockResolvedValue([{ filename: "assets/logo.png" }]);

    const diff = await buildDiff(filesClient, { owner: "org", repo: "repo", prNumber: 42 });

    expect(diff).toEqual({ files: [] });
  });

  it("passes owner/repo/prNumber through to the files client", async () => {
    const filesClient = mock<GithubFilesClient>();
    filesClient.listFiles.mockResolvedValue([]);

    await buildDiff(filesClient, { owner: "org", repo: "repo", prNumber: 42 });

    expect(filesClient.listFiles).toHaveBeenCalledWith({
      owner: "org",
      repo: "repo",
      prNumber: 42,
    });
  });
});
