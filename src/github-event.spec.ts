import { describe, expect, it } from "vitest";

import { extractPullRequestMetadata } from "./github-event";

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

  it("returns null for an event without pull_request", () => {
    expect(
      extractPullRequestMetadata({ repository: { name: "x", owner: { login: "y" } } }),
    ).toBeNull();
  });

  it("returns null for an event without repository", () => {
    expect(extractPullRequestMetadata({ pull_request: validPayload().pull_request })).toBeNull();
  });
});
