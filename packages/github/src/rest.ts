/**
 * GitHub's REST API over `fetch`: the three calls the adapter makes. Never exercised in tests
 * (they use the fake); a token with `pull_requests: write` on the repository is enough.
 */
import type { GitHubClient, PrComment, PrRef } from "./client.js";

export interface RestGitHubOptions {
  token: string;
  /** "https://api.github.com" (default), or a GitHub Enterprise host's API root. */
  apiBaseUrl?: string;
  fetch?: typeof fetch;
}

export class RestGitHubClient implements GitHubClient {
  private readonly base: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly opts: RestGitHubOptions) {
    this.base = (opts.apiBaseUrl ?? "https://api.github.com").replace(/\/+$/, "");
    this.fetchImpl = opts.fetch ?? fetch;
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.fetchImpl(`${this.base}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.opts.token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "henosis",
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) throw new Error(`github ${method} ${path}: ${res.status} ${await res.text()}`);
    return (await res.json()) as T;
  }

  async listComments(pr: PrRef): Promise<PrComment[]> {
    const out: PrComment[] = [];
    for (let page = 1; page <= 10; page++) {
      const list = await this.call<{ id: number; body?: string }[]>(
        "GET",
        `/repos/${pr.owner}/${pr.repo}/issues/${pr.number}/comments?per_page=100&page=${page}`,
      );
      for (const c of list) out.push({ id: c.id, body: c.body ?? "" });
      if (list.length < 100) break;
    }
    return out;
  }

  async createComment(pr: PrRef, body: string): Promise<PrComment> {
    const c = await this.call<{ id: number; body?: string }>(
      "POST",
      `/repos/${pr.owner}/${pr.repo}/issues/${pr.number}/comments`,
      { body },
    );
    return { id: c.id, body: c.body ?? body };
  }

  async updateComment(pr: PrRef, id: number, body: string): Promise<PrComment> {
    const c = await this.call<{ id: number; body?: string }>(
      "PATCH",
      `/repos/${pr.owner}/${pr.repo}/issues/comments/${id}`,
      { body },
    );
    return { id: c.id, body: c.body ?? body };
  }
}
