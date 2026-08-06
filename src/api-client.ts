import { Diff, IngestActionRequestBody, IngestActionSuccessBody } from "./contract";

export type CallIngestionApiParams = {
  apiUrl: string;
  bellaToken: string;
  prNumber: number;
  commitSha: string;
  author?: string;
  prTitle?: string;
  prDescription?: string;
  previousCommitSha?: string;
  diff: Diff;
};

export type CallIngestionApiResult =
  | { kind: "success"; body: IngestActionSuccessBody }
  | { kind: "http_error"; status: number; message: string }
  | { kind: "network_error"; message: string };

// Backend responds fast (it only validates and enqueues, never waits on the
// LLM) — a long timeout here would only delay detecting a real network
// problem.
const REQUEST_TIMEOUT_MS = 20000;

// Returns a structured result instead of throwing — main.ts (04) decides how
// each case maps to step success/failure and what to log; this function's
// only job is making the call and classifying the outcome.
export async function callIngestionApi(
  params: CallIngestionApiParams,
): Promise<CallIngestionApiResult> {
  const body: IngestActionRequestBody = {
    prNumber: params.prNumber,
    commitSha: params.commitSha,
    author: params.author,
    prTitle: params.prTitle,
    prDescription: params.prDescription,
    previousCommitSha: params.previousCommitSha,
    diff: params.diff,
  };

  let response: Response;
  try {
    response = await fetch(`${params.apiUrl}/ingestion/action`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.bellaToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    // Never include `body` in this error — it carries the diff.
    return {
      kind: "network_error",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    return {
      kind: "http_error",
      status: response.status,
      message: errorBody?.error?.message ?? response.statusText,
    };
  }

  const successBody = (await response.json()) as IngestActionSuccessBody;
  return { kind: "success", body: successBody };
}
