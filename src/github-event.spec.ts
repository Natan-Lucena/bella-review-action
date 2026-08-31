import { describe, expect, it } from "vitest";

import { extractCommentReplyMetadata, extractPullRequestMetadata } from "./github-event";

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    pull_request: {
      number: 42,
      head: { sha: "abc123" },
      user: { login: "octocat" },
      title: "Fix pagination bug",
      body: "Callers assumed the old offset semantics.",
    },
    repository: {
      name: "some-repo",
      owner: { login: "some-org" },
    },
    ...overrides,
  };
}

describe("extractPullRequestMetadata", () => {
  it("extracts every field from a well-formed pull_request event", () => {
    const metadata = extractPullRequestMetadata(validPayload());

    expect(metadata).toEqual({
      owner: "some-org",
      repo: "some-repo",
      prNumber: 42,
      commitSha: "abc123",
      author: "octocat",
      prTitle: "Fix pagination bug",
      prDescription: "Callers assumed the old offset semantics.",
    });
  });

  it("omits prDescription (not null) when the PR body is null", () => {
    const metadata = extractPullRequestMetadata(
      validPayload({
        pull_request: {
          number: 42,
          head: { sha: "abc123" },
          user: { login: "octocat" },
          title: "Fix pagination bug",
          body: null,
        },
      }),
    );

    expect(metadata?.prDescription).toBeUndefined();
  });

  it("omits author when the event has no user login", () => {
    const metadata = extractPullRequestMetadata(
      validPayload({
        pull_request: {
          number: 42,
          head: { sha: "abc123" },
          title: "Fix pagination bug",
          body: "Details.",
        },
      }),
    );

    expect(metadata?.author).toBeUndefined();
  });

  it("extracts previousCommitSha from `before` when action is synchronize", () => {
    const metadata = extractPullRequestMetadata(
      validPayload({ action: "synchronize", before: "f6e5d4c3" }),
    );

    expect(metadata?.previousCommitSha).toBe("f6e5d4c3");
  });

  it("leaves previousCommitSha undefined when action is opened — no meaningful 'previous commit' for a PR's first review", () => {
    const metadata = extractPullRequestMetadata(
      validPayload({ action: "opened", before: "f6e5d4c3" }),
    );

    expect(metadata?.previousCommitSha).toBeUndefined();
  });

  it("leaves previousCommitSha undefined when the payload has no action at all", () => {
    const metadata = extractPullRequestMetadata(validPayload());

    expect(metadata?.previousCommitSha).toBeUndefined();
  });

  it("returns null for an event without pull_request", () => {
    expect(
      extractPullRequestMetadata({ repository: { name: "x", owner: { login: "y" } } }),
    ).toBeNull();
  });

  it("returns null for an event without repository", () => {
    expect(extractPullRequestMetadata({ pull_request: validPayload().pull_request })).toBeNull();
  });
});

function validCommentReplyPayload(overrides: Record<string, unknown> = {}) {
  return {
    action: "created",
    comment: {
      id: 10,
      in_reply_to_id: 5,
      body: "Thanks, fixed!",
      user: { login: "octocat" },
    },
    pull_request: {
      number: 42,
      title: "Fix pagination bug",
      body: "Callers assumed the old offset semantics.",
      head: { sha: "abc123" },
    },
    repository: {
      name: "some-repo",
      owner: { login: "some-org" },
    },
    ...overrides,
  };
}

describe("extractCommentReplyMetadata", () => {
  it("extracts every field from a well-formed comment-reply event", () => {
    const metadata = extractCommentReplyMetadata(validCommentReplyPayload());

    expect(metadata).toEqual({
      owner: "some-org",
      repo: "some-repo",
      prNumber: 42,
      commitSha: "abc123",
      commentId: 10,
      inReplyToId: 5,
      humanBody: "Thanks, fixed!",
      humanAuthor: "octocat",
      prTitle: "Fix pagination bug",
      prDescription: "Callers assumed the old offset semantics.",
    });
  });

  it("keeps prDescription as null (not undefined) when the PR body is null", () => {
    const metadata = extractCommentReplyMetadata(
      validCommentReplyPayload({
        pull_request: {
          number: 42,
          title: "Fix pagination bug",
          body: null,
          head: { sha: "abc123" },
        },
      }),
    );

    expect(metadata?.prDescription).toBeNull();
  });

  it("omits humanAuthor when the comment has no user login", () => {
    const metadata = extractCommentReplyMetadata(
      validCommentReplyPayload({ comment: { id: 10, in_reply_to_id: 5, body: "Thanks!" } }),
    );

    expect(metadata?.humanAuthor).toBeUndefined();
  });

  it("returns null when action is not 'created' (e.g. edited or deleted)", () => {
    expect(extractCommentReplyMetadata(validCommentReplyPayload({ action: "edited" }))).toBeNull();
    expect(extractCommentReplyMetadata(validCommentReplyPayload({ action: "deleted" }))).toBeNull();
  });

  it("returns null when the comment has no in_reply_to_id (a fresh top-level comment)", () => {
    expect(
      extractCommentReplyMetadata(
        validCommentReplyPayload({ comment: { id: 10, body: "First comment on this PR" } }),
      ),
    ).toBeNull();
  });

  it("returns null when pull_request is missing", () => {
    const payload = validCommentReplyPayload();
    delete (payload as Record<string, unknown>).pull_request;

    expect(extractCommentReplyMetadata(payload)).toBeNull();
  });

  it("returns null when repository is missing", () => {
    const payload = validCommentReplyPayload();
    delete (payload as Record<string, unknown>).repository;

    expect(extractCommentReplyMetadata(payload)).toBeNull();
  });
});
