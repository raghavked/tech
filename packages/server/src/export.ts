/**
 * Session export: the markdown report of a session, for GET /api/sessions/:id/export.md.
 * A live session is rendered from its host (so unflushed events are included); a session
 * only on disk is folded from its log. Pure apart from reading the log.
 */
import { KernelError, renderReport, Session } from "@henosis/kernel";
import type { ProjectHost } from "./projectHost.js";
import { readLog, sessionDir } from "./storage.js";

export interface ExportSource {
  root: string;
  projects: Map<string, ProjectHost>;
}

/** The session, live if hosted, otherwise from its persisted log; null when unknown. */
export function sessionForExport(src: ExportSource, sessionId: string): Session | null {
  for (const p of src.projects.values()) {
    const h = p.hosts.get(sessionId);
    if (h) return h.session;
  }
  let dir: string;
  try {
    dir = sessionDir(src.root, sessionId);
  } catch {
    return null; // a malformed id is simply not a session
  }
  const log = readLog(dir);
  return log ? Session.fromSerialized(log) : null;
}

/** Render the export; throws a not_found KernelError when the session does not exist. */
export function exportSessionMarkdown(src: ExportSource, sessionId: string): string {
  const s = sessionForExport(src, sessionId);
  if (!s) throw new KernelError("not_found", `unknown session ${sessionId}`);
  return renderReport(s);
}

/** Path of the export endpoint; the web client links to the same string. */
export const EXPORT_PATH = /^\/api\/sessions\/([^/]+)\/export\.md$/;

/**
 * Headers for the response. A tab shows text/plain inline; `?download=1` asks for a file
 * named after the session, as text/markdown.
 */
export function exportHeaders(sessionId: string, download: boolean): Record<string, string> {
  const filename = `${sessionId}.md`;
  return {
    "content-type": download ? "text/markdown; charset=utf-8" : "text/plain; charset=utf-8",
    "content-disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
    "access-control-allow-origin": "*",
    "cache-control": "no-store",
  };
}
