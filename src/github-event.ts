// Extracts everything needed from the pull_request event payload without
// any extra API call — title/body/head sha/author are already there.
// Takes the raw payload (not the @actions/github Context type) so this can
// be unit tested with a plain object, and so main.ts is the only place that
// needs to know about github.context.

export type PullRequestEventMetadata = {
  owner: string;
  repo: string;
  prNumber: number;
  commitSha: string;
  author?: string;
  prTitle: string;
  prDescription?: string;
  previousCommitSha?: string;
};

type RawPullRequestEventPayload = {
  action?: string;
  // Only present when action === "synchronize" — the commit at the tip of
  // the PR right before this push.
  before?: string;
  pull_request?: {
    number: number;
    head: { sha: string };
    user?: { login?: string | null };
    title: string;
    body?: string | null;
  };
  repository?: {
    name: string;
    owner: { login: string };
  };
};

// Returns null when the payload isn't a pull_request event (or is missing
// the fields this Action needs) — the caller treats that as "nothing to do
// here", not an error, since the workflow's own `on:` trigger should already
// restrict this to PR events.
export function extractPullRequestMetadata(payload: unknown): PullRequestEventMetadata | null {
  const typed = payload as RawPullRequestEventPayload;
  const pr = typed.pull_request;
  const repository = typed.repository;

  if (!pr || !repository) {
    return null;
  }

  return {
    owner: repository.owner.login,
    repo: repository.name,
    prNumber: pr.number,
    commitSha: pr.head.sha,
    author: pr.user?.login ?? undefined,
    prTitle: pr.title,
    prDescription: pr.body ?? undefined,
    // "opened"/"reopened" have no meaningful "previous commit" (it's the
    // PR's first review) — leave the field undefined so it's omitted from
    // the request body entirely, same convention as prDescription above.
    previousCommitSha: typed.action === "synchronize" ? typed.before : undefined,
  };
}
