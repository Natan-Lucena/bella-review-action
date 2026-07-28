import * as github from "@actions/github";

export type PullRequestFile = {
  filename: string;
  patch?: string;
};

// Isolated behind an interface (not the raw Octokit type) so build-diff.ts
// and its tests don't depend on the real @actions/github SDK — same
// port/adapter split the backend uses for its own external dependencies.
export interface GithubFilesClient {
  listFiles(params: { owner: string; repo: string; prNumber: number }): Promise<PullRequestFile[]>;
}

export class OctokitFilesClient implements GithubFilesClient {
  constructor(private readonly token: string) {}

  async listFiles(params: {
    owner: string;
    repo: string;
    prNumber: number;
  }): Promise<PullRequestFile[]> {
    const octokit = github.getOctokit(this.token);

    // octokit.paginate follows every page automatically (GitHub paginates
    // at up to 100 files per page) and returns the flattened result.
    return octokit.paginate(octokit.rest.pulls.listFiles, {
      owner: params.owner,
      repo: params.repo,
      pull_number: params.prNumber,
      per_page: 100,
    });
  }
}
