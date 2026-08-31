import { beforeEach, describe, expect, it, vi } from "vitest";

const coreMocks = {
  getInput: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  setFailed: vi.fn(),
};

const contextMock: { eventName: string; payload: unknown } = {
  eventName: "pull_request",
  payload: {},
};

const apiClientMocks = {
  callIngestionApi: vi.fn(),
  callCommentReplyIngestionApi: vi.fn(),
};

const githubEventMocks = {
  extractPullRequestMetadata: vi.fn(),
  extractCommentReplyMetadata: vi.fn(),
};

const buildDiffMock = vi.fn();

vi.mock("@actions/core", () => coreMocks);
vi.mock("@actions/github", () => ({ context: contextMock }));
vi.mock("./api-client", () => apiClientMocks);
vi.mock("./github-event", () => githubEventMocks);
vi.mock("./diff/build-diff", () => ({ buildDiff: buildDiffMock }));
vi.mock("./diff/github-files-client", () => ({ OctokitFilesClient: vi.fn() }));

// main.ts self-invokes `run()` at import time (fire-and-forget, via
// `run().catch(...)`), so every test re-imports the module fresh after
// resetModules() and then waits for the mocked async calls it expects to
// have settled — the import itself resolves once the module's synchronous
// top-level body finishes, not once `run()`'s internal awaits do.
async function importMain(): Promise<void> {
  vi.resetModules();
  await import("./main");
}

describe("run (event routing)", () => {
  beforeEach(() => {
    Object.values(coreMocks).forEach((mock) => mock.mockReset());
    Object.values(apiClientMocks).forEach((mock) => mock.mockReset());
    Object.values(githubEventMocks).forEach((mock) => mock.mockReset());
    buildDiffMock.mockReset();

    coreMocks.getInput.mockImplementation((name: string) => {
      if (name === "bella-token") return "bt_secret";
      if (name === "api-url") return "https://api.bellareviewer.example";
      if (name === "github-token") return "gh_token";
      return "";
    });
  });

  it("still runs the full diff/review flow for a pull_request event (no regression)", async () => {
    contextMock.eventName = "pull_request";
    contextMock.payload = { pull_request: { number: 1 } };
    githubEventMocks.extractPullRequestMetadata.mockReturnValue({
      owner: "some-org",
      repo: "some-repo",
      prNumber: 1,
      commitSha: "sha1",
      prTitle: "Fix bug",
    });
    buildDiffMock.mockResolvedValue({ files: [] });
    apiClientMocks.callIngestionApi.mockResolvedValue({
      kind: "success",
      body: { id: "run-1", status: "queued", commitSha: "sha1" },
    });

    await importMain();

    await vi.waitFor(() => expect(apiClientMocks.callIngestionApi).toHaveBeenCalledTimes(1));
    expect(buildDiffMock).toHaveBeenCalledTimes(1);
    expect(apiClientMocks.callCommentReplyIngestionApi).not.toHaveBeenCalled();
    expect(githubEventMocks.extractCommentReplyMetadata).not.toHaveBeenCalled();
    expect(coreMocks.setFailed).not.toHaveBeenCalled();
  });

  it("routes a pull_request_review_comment event to the comment-reply flow, never the diff flow", async () => {
    contextMock.eventName = "pull_request_review_comment";
    contextMock.payload = {
      action: "created",
      comment: { id: 10, in_reply_to_id: 5, body: "thanks!" },
      pull_request: { number: 1, title: "t", body: null, head: { sha: "sha1" } },
      repository: { name: "some-repo", owner: { login: "some-org" } },
    };
    githubEventMocks.extractCommentReplyMetadata.mockReturnValue({
      owner: "some-org",
      repo: "some-repo",
      prNumber: 1,
      commitSha: "sha1",
      commentId: 10,
      inReplyToId: 5,
      humanBody: "thanks!",
      prTitle: "t",
      prDescription: null,
    });
    apiClientMocks.callCommentReplyIngestionApi.mockResolvedValue({
      kind: "success",
      body: { kind: "ignored" },
    });

    await importMain();

    await vi.waitFor(() =>
      expect(apiClientMocks.callCommentReplyIngestionApi).toHaveBeenCalledTimes(1),
    );
    expect(apiClientMocks.callIngestionApi).not.toHaveBeenCalled();
    expect(buildDiffMock).not.toHaveBeenCalled();
    expect(githubEventMocks.extractPullRequestMetadata).not.toHaveBeenCalled();
    expect(coreMocks.setFailed).not.toHaveBeenCalled();
  });

  it("ignores an edited/deleted comment, or one without in_reply_to_id, without calling the API", async () => {
    contextMock.eventName = "pull_request_review_comment";
    contextMock.payload = { action: "edited" };
    githubEventMocks.extractCommentReplyMetadata.mockReturnValue(null);

    await importMain();

    await vi.waitFor(() => expect(coreMocks.info).toHaveBeenCalled());
    expect(apiClientMocks.callCommentReplyIngestionApi).not.toHaveBeenCalled();
    expect(coreMocks.setFailed).not.toHaveBeenCalled();
  });

  it("warns (never setFailed) when the comment-reply call returns http_error", async () => {
    contextMock.eventName = "pull_request_review_comment";
    contextMock.payload = { action: "created" };
    githubEventMocks.extractCommentReplyMetadata.mockReturnValue({
      owner: "some-org",
      repo: "some-repo",
      prNumber: 1,
      commitSha: "sha1",
      commentId: 10,
      inReplyToId: 5,
      humanBody: "thanks!",
      prTitle: "t",
      prDescription: null,
    });
    apiClientMocks.callCommentReplyIngestionApi.mockResolvedValue({
      kind: "http_error",
      status: 500,
      message: "boom",
    });

    await importMain();

    await vi.waitFor(() => expect(coreMocks.warning).toHaveBeenCalledTimes(1));
    expect(coreMocks.warning).toHaveBeenCalledWith(expect.stringContaining("boom"));
    expect(coreMocks.setFailed).not.toHaveBeenCalled();
  });

  it("warns (never setFailed) when the comment-reply call returns network_error", async () => {
    contextMock.eventName = "pull_request_review_comment";
    contextMock.payload = { action: "created" };
    githubEventMocks.extractCommentReplyMetadata.mockReturnValue({
      owner: "some-org",
      repo: "some-repo",
      prNumber: 1,
      commitSha: "sha1",
      commentId: 10,
      inReplyToId: 5,
      humanBody: "thanks!",
      prTitle: "t",
      prDescription: null,
    });
    apiClientMocks.callCommentReplyIngestionApi.mockResolvedValue({
      kind: "network_error",
      message: "ECONNREFUSED",
    });

    await importMain();

    await vi.waitFor(() => expect(coreMocks.warning).toHaveBeenCalledTimes(1));
    expect(coreMocks.warning).toHaveBeenCalledWith(expect.stringContaining("ECONNREFUSED"));
    expect(coreMocks.setFailed).not.toHaveBeenCalled();
  });

  it("does nothing for an unsupported event", async () => {
    contextMock.eventName = "issue_comment";
    contextMock.payload = {};

    await importMain();

    await vi.waitFor(() => expect(coreMocks.info).toHaveBeenCalled());
    expect(coreMocks.info).toHaveBeenCalledWith(expect.stringContaining("issue_comment"));
    expect(apiClientMocks.callIngestionApi).not.toHaveBeenCalled();
    expect(apiClientMocks.callCommentReplyIngestionApi).not.toHaveBeenCalled();
  });
});
