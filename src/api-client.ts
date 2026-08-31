import { CommentReplyEventMetadata } from "./github-event";
import {
  Diff,
  IngestActionCommentReplyRequestBody,
  IngestActionCommentReplySuccessBody,
  IngestActionRequestBody,
  IngestActionSuccessBody,
} from "./contract";

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

// Shared shape for both ingestion endpoints, generic over the success body
// since /ingestion/action and /ingestion/action/comment-replies return
// different things on success.
export type IngestionApiResult<TSuccessBody> =
  | { kind: "success"; body: TSuccessBody }
  | { kind: "http_error"; status: number; message: string }
  | { kind: "network_error"; message: string };

export type CallIngestionApiResult = IngestionApiResult<IngestActionSuccessBody>;

export type CallCommentReplyIngestionApiParams = {
  apiUrl: string;
  bellaToken: string;
} & CommentReplyEventMetadata;

export type CallCommentReplyIngestionApiResult =
  IngestionApiResult<IngestActionCommentReplySuccessBody>;

// Backend responds fast (it only validates and enqueues, never waits on the
// LLM) — a long timeout here would only delay detecting a real network
// problem.
const REQUEST_TIMEOUT_MS = 20000;

// Shared internal helper: the fetch/timeout/error-classification logic that
// both ingestion endpoints need. Never logs `body` or `bellaToken`, on
// success or error — a request body may carry a full diff or a human's
// comment text, and error messages here are careful to never surface either.
async function requestIngestion<TSuccessBody>(
  url: string,
  bellaToken: string,
  body: unknown,
): Promise<IngestionApiResult<TSuccessBody>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bellaToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    // Never include `body` in this error — it may carry the diff or the
    // human's comment text.
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

  const successBody = (await response.json()) as TSuccessBody;
  return { kind: "success", body: successBody };
}

// Returns a structured result instead of throwing — main.ts decides how
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

  return requestIngestion<IngestActionSuccessBody>(
    `${params.apiUrl}/ingestion/action`,
    params.bellaToken,
    body,
  );
}

// Same shape of result as callIngestionApi above, but for the independent
// comment-reply flow — no diff involved, just a few fields forwarded from
// the pull_request_review_comment event.
export async function callCommentReplyIngestionApi(
  params: CallCommentReplyIngestionApiParams,
): Promise<CallCommentReplyIngestionApiResult> {
  const body: IngestActionCommentReplyRequestBody = {
    prNumber: params.prNumber,
    commitSha: params.commitSha,
    commentId: params.commentId,
    inReplyToId: params.inReplyToId,
    humanBody: params.humanBody,
    humanAuthor: params.humanAuthor,
    prTitle: params.prTitle,
    prDescription: params.prDescription,
  };

  return requestIngestion<IngestActionCommentReplySuccessBody>(
    `${params.apiUrl}/ingestion/action/comment-replies`,
    params.bellaToken,
    body,
  );
}
