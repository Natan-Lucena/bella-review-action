import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { callIngestionApi } from "./api-client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("callIngestionApi", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const baseParams = {
    apiUrl: "https://api.bellareviewer.example",
    bellaToken: "bt_secret",
    prNumber: 42,
    commitSha: "abc123",
    diff: { files: [] },
  };

  it("posts to /ingestion/action with the bearer token and the built body", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ id: "run-1", status: "queued", commitSha: "abc123" }, 202),
    );

    const result = await callIngestionApi({
      ...baseParams,
      prTitle: "Fix bug",
      prDescription: "Details.",
    });

    expect(result).toEqual({
      kind: "success",
      body: { id: "run-1", status: "queued", commitSha: "abc123" },
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.bellareviewer.example/ingestion/action");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer bt_secret");
    expect(JSON.parse(init.body as string)).toEqual({
      prNumber: 42,
      commitSha: "abc123",
      prTitle: "Fix bug",
      prDescription: "Details.",
      diff: { files: [] },
    });
  });

  it("treats 200 (idempotent, already existed) as success too", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ id: "run-1", status: "processing", commitSha: "abc123" }, 200),
    );

    const result = await callIngestionApi(baseParams);

    expect(result.kind).toBe("success");
  });

  it("returns http_error with the backend's own error message on 401", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: { code: "not_authenticated", message: "Invalid token" } }, 401),
    );

    const result = await callIngestionApi(baseParams);

    expect(result).toEqual({ kind: "http_error", status: 401, message: "Invalid token" });
  });

  it("returns http_error with the status text when the error body isn't parseable", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("not json", { status: 400, statusText: "Bad Request" }),
    );

    const result = await callIngestionApi(baseParams);

    expect(result).toEqual({ kind: "http_error", status: 400, message: "Bad Request" });
  });

  it("returns network_error when fetch itself throws", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const result = await callIngestionApi(baseParams);

    expect(result).toEqual({ kind: "network_error", message: "ECONNREFUSED" });
  });

  it("never includes the diff or the token in a thrown/returned error message", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));

    const result = await callIngestionApi({
      ...baseParams,
      bellaToken: "super-secret-token",
      diff: { files: [{ path: "secret-file.ts", hunks: [] }] },
    });

    expect(JSON.stringify(result)).not.toContain("super-secret-token");
    expect(JSON.stringify(result)).not.toContain("secret-file.ts");
  });
});
