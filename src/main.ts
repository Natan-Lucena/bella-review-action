import * as core from "@actions/core";
import * as github from "@actions/github";

import { callIngestionApi } from "./api-client";
import { buildDiff } from "./diff/build-diff";
import { OctokitFilesClient } from "./diff/github-files-client";
import { extractPullRequestMetadata } from "./github-event";

async function run(): Promise<void> {
  const bellaToken = core.getInput("bella-token", { required: true });
  const apiUrl = core.getInput("api-url", { required: false });
  const githubToken = core.getInput("github-token", { required: true });

  const metadata = extractPullRequestMetadata(github.context.payload);
  if (!metadata) {
    core.info("Evento não é de pull_request (ou payload incompleto) — nada a fazer.");
    return;
  }

  const filesClient = new OctokitFilesClient(githubToken);
  const diff = await buildDiff(filesClient, {
    owner: metadata.owner,
    repo: metadata.repo,
    prNumber: metadata.prNumber,
  });

  const result = await callIngestionApi({
    apiUrl,
    bellaToken,
    prNumber: metadata.prNumber,
    commitSha: metadata.commitSha,
    author: metadata.author,
    prTitle: metadata.prTitle,
    prDescription: metadata.prDescription,
    diff,
  });

  switch (result.kind) {
    case "success":
      // Deliberately not "revisão concluída" — this only confirms the
      // request was accepted for async processing, never that a comment
      // will actually be published (see action-prds/04).
      core.info(
        `Revisão enviada para processamento (execução ${result.body.id}). ` +
          "Acompanhe o resultado no painel da Bella Reviewer.",
      );
      return;
    case "http_error":
      if (result.status === 401) {
        core.setFailed(
          "BELLA_TOKEN inválido, ausente, ou não configurado para este repositório. " +
            "Gere um novo token no painel da Bella Reviewer e atualize o secret " +
            "BELLA_TOKEN deste repositório.",
        );
        return;
      }
      core.setFailed(
        `Falha ao chamar a API da Bella Reviewer (${result.status}): ${result.message}. ` +
          "Isto provavelmente é um bug nesta Action, não uma configuração do seu " +
          "repositório — abra uma issue.",
      );
      return;
    case "network_error":
      core.setFailed(
        `Falha de rede ao chamar a API da Bella Reviewer: ${result.message}. ` +
          "Tente novamente mais tarde.",
      );
      return;
  }
}

run().catch((error) => {
  core.setFailed(error instanceof Error ? error.message : String(error));
});
