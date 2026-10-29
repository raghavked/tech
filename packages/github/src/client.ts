/**
 * The slice of GitHub the adapter needs, behind an interface so it is testable offline: list
 * the comments on a pull request, create one, edit one. `FakeGitHubClient` keeps them in
 * memory and counts creates and edits, so a test can assert that a session is one comment,
 * edited, never appended. `RestGitHubClient` (rest.ts) is the one that reaches the network.
 */

export interface PrRef {
  owner: string;
  repo: string;
  number: number;
}

export interface PrComment {
  id: number;
  body: string;
}

export interface GitHubClient {
  listComments(pr: PrRef): Promise<PrComment[]>;
  createComment(pr: PrRef, body: string): Promise<PrComment>;
  updateComment(pr: PrRef, id: number, body: string): Promise<PrComment>;
}

/** "owner/repo#418" or "https://github.com/owner/repo/pull/418" → a PR reference. */
export function parsePrRef(ref: string | PrRef): PrRef {
  if (typeof ref !== "string") return ref;
  const short = ref.trim().match(/^([\w.-]+)\/([\w.-]+)#(\d+)$/);
  if (short) return { owner: short[1] ?? "", repo: short[2] ?? "", number: Number(short[3]) };
  const url = ref.trim().match(/github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)/);
  if (url) return { owner: url[1] ?? "", repo: url[2] ?? "", number: Number(url[3]) };
  throw new Error(`not a pull request reference: ${ref} (want owner/repo#number)`);
}

export const prKey = (pr: PrRef) => `${pr.owner}/${pr.repo}#${pr.number}`;
export const prUrl = (pr: PrRef) => `https://github.com/${pr.owner}/${pr.repo}/pull/${pr.number}`;

/** In-memory GitHub for tests and the offline demo. */
export class FakeGitHubClient implements GitHubClient {
  private readonly comments = new Map<string, PrComment[]>();
  readonly created: { pr: PrRef; id: number; body: string }[] = [];
  readonly updated: { pr: PrRef; id: number; body: string }[] = [];
  private counter = 0;

  async listComments(pr: PrRef): Promise<PrComment[]> {
    return (this.comments.get(prKey(pr)) ?? []).map((c) => ({ ...c }));
  }

  async createComment(pr: PrRef, body: string): Promise<PrComment> {
    this.counter += 1;
    const c = { id: 1000 + this.counter, body };
    const list = this.comments.get(prKey(pr)) ?? [];
    list.push(c);
    this.comments.set(prKey(pr), list);
    this.created.push({ pr, id: c.id, body });
    return { ...c };
  }

  async updateComment(pr: PrRef, id: number, body: string): Promise<PrComment> {
    const c = (this.comments.get(prKey(pr)) ?? []).find((x) => x.id === id);
    if (!c) throw new Error(`no comment ${id} on ${prKey(pr)}`);
    c.body = body;
    this.updated.push({ pr, id, body });
    return { ...c };
  }

  /** A comment somebody else left, as a timeline would hold before the adapter arrives. */
  seed(pr: PrRef, body: string): PrComment {
    this.counter += 1;
    const c = { id: 1000 + this.counter, body };
    const list = this.comments.get(prKey(pr)) ?? [];
    list.push(c);
    this.comments.set(prKey(pr), list);
    return { ...c };
  }

  commentsOf(pr: PrRef): PrComment[] {
    return (this.comments.get(prKey(pr)) ?? []).map((c) => ({ ...c }));
  }
}
