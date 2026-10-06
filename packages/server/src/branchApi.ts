/**
 * Read-only HTTP routes for comparing two branches of a session and reading one file of a
 * branch (conflict-marked content after a fold). Mounted from HenosisServer.handleHttp.
 *
 *   GET /api/projects/:project/sessions/:session/compare?a=main&b=try/idea  -> BranchCompare
 *   GET /api/projects/:project/sessions/:session/file?branch=main&path=a.txt -> SessionFile
 */
import { compareBranches, KernelError } from "@henosis/kernel";
import type { ProjectHost } from "./projectHost.js";

export interface SessionFile {
  branch: string;
  path: string;
  hash: string;
  content: string;
  /** True while the path is in the branch's open conflicts. */
  conflict: boolean;
}

const ROUTE = /^\/api\/projects\/([^/]+)\/sessions\/([^/]+)\/(compare|file)$/;

/**
 * Handle a branch route; returns false when `url` is not one. `project` resolves a project
 * host, `json` writes the response.
 */
export function handleBranchApi(
  url: URL,
  project: (projectId: string) => ProjectHost,
  json: (code: number, body: unknown) => boolean,
): boolean {
  const m = url.pathname.match(ROUTE);
  if (!m) return false;
  const [, projectId, sessionId, what] = m as [string, string, string, "compare" | "file"];
  const host = project(decodeURIComponent(projectId)).hosts.get(decodeURIComponent(sessionId));
  if (!host) throw new KernelError("not_found", `unknown session ${sessionId}`);
  const session = host.session;
  const q = url.searchParams;
  if (what === "compare") {
    const a = q.get("a") || "main";
    const b = q.get("b") || "main";
    for (const name of [a, b])
      if (!session.log.hasBranch(name))
        throw new KernelError("not_found", `unknown branch ${name}`);
    return json(200, compareBranches(session, a, b));
  }
  const branch = q.get("branch") || "main";
  const path = q.get("path") ?? "";
  if (!session.log.hasBranch(branch))
    throw new KernelError("not_found", `unknown branch ${branch}`);
  const st = session.state(branch);
  const hash = st.workspace[path];
  const content = hash === undefined ? undefined : session.store.get(hash);
  if (hash === undefined || content === undefined)
    throw new KernelError("not_found", `no file ${path} on ${branch}`);
  const body: SessionFile = {
    branch,
    path,
    hash,
    content,
    conflict: st.openConflicts.includes(path),
  };
  return json(200, body);
}
