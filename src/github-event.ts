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

// Extracts everything needed from a pull_request_review_comment event
// payload without any extra API call. This payload also contains a full
// pull_request object (same shape as the pull_request event's) — callers
// must branch on github.context.eventName *before* reaching for this
// function, never on "does the payload have a pull_request field", or a
// comment-reply event gets silently misidentified as a full-PR-review event.
export type CommentReplyEventMetadata = {
  owner: string;
  repo: string;
  prNumber: number;
  commitSha: string;
  commentId: number;
  inReplyToId: number;
  humanBody: string;
  humanAuthor?: string;
  prTitle: string;
  prDescription: string | null;
};

type RawCommentEventPayload = {
  action?: string;
  comment?: {
    id: number;
    in_reply_to_id?: number;
    body: string;
    user?: { login?: string | null };
  };
  pull_request?: { number: number; title: string; body: string | null; head: { sha: string } };
  repository?: { name: string; owner: { login: string } };
};

// null when: action isn't "created" (an edit/delete of a comment is not a
// new reply), or the comment has no in_reply_to_id (a fresh top-level
// comment, not a reply within an existing thread) — same filter the backend
// also applies; here it's just to avoid the whole API call for something
// already known to be irrelevant.
export function extractCommentReplyMetadata(payload: unknown): CommentReplyEventMetadata | null {
  const typed = payload as RawCommentEventPayload;
  const comment = typed.comment;
  const pr = typed.pull_request;
  const repository = typed.repository;

  if (typed.action !== "created" || !comment?.in_reply_to_id || !pr || !repository) {
    return null;
  }

  return {
    owner: repository.owner.login,
    repo: repository.name,
    prNumber: pr.number,
    commitSha: pr.head.sha,
    commentId: comment.id,
    inReplyToId: comment.in_reply_to_id,
    humanBody: comment.body,
    humanAuthor: comment.user?.login ?? undefined,
    prTitle: pr.title,
    prDescription: pr.body,
  };
}
