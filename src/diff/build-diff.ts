import { Diff, DiffFile } from "../contract";
import { GithubFilesClient } from "./github-files-client";
import { parseUnifiedDiffPatch } from "./parse-unified-diff";

export type BuildDiffParams = {
  owner: string;
  repo: string;
  prNumber: number;
};

// Binary files and diffs GitHub considers too large come back without a
// `patch` field — there's nothing to parse, so they're left out of the
// structured diff entirely (same rule the backend's own ScmAdapterPort
// applies on the webhook path).
export async function buildDiff(
  filesClient: GithubFilesClient,
  params: BuildDiffParams,
): Promise<Diff> {
  const files = await filesClient.listFiles(params);

  const diffFiles: DiffFile[] = files
    .filter((file) => typeof file.patch === "string")
    .map((file) => ({
      path: file.filename,
      hunks: parseUnifiedDiffPatch(file.patch as string),
    }));

  return { files: diffFiles };
}
