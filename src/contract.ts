// Tipos do contrato com o backend da Bella Reviewer (POST /ingestion/action).
// Duplicados manualmente aqui, de propósito — não há pacote compartilhado
// entre este repositório e o do backend. Os nomes de campo abaixo não são
// negociáveis: precisam bater exatamente com o schema de validação (Zod) do
// lado do backend, camelCase, sem tradução.

export type DiffLine = {
  content: string;
  status: "added" | "removed" | "unchanged";
  lineNumber: number;
};

export type DiffHunk = {
  oldStartLine: number;
  newStartLine: number;
  lines: DiffLine[];
};

export type DiffFile = {
  path: string;
  hunks: DiffHunk[];
};

export type Diff = {
  files: DiffFile[];
};

export type IngestActionRequestBody = {
  prNumber: number;
  commitSha: string;
  author?: string;
  prTitle?: string;
  prDescription?: string;
  previousCommitSha?: string;
  diff: Diff;
};

export type IngestActionSuccessBody = {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  commitSha: string;
};

// Contrato com o backend da Bella Reviewer para respostas a comentários
// (POST /ingestion/action/comment-replies). Mesmo aviso de acima: nomes de
// campo não são negociáveis, precisam bater com o schema Zod do backend.
export type IngestActionCommentReplyRequestBody = {
  prNumber: number;
  commitSha: string;
  commentId: number;
  inReplyToId: number;
  humanBody: string;
  humanAuthor?: string;
  prTitle: string;
  prDescription: string | null;
};

export type IngestActionCommentReplySuccessBody =
  { kind: "ignored" } | { kind: "accepted"; commentReply: { id: string; status: string } };
