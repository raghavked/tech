/**
 * Migration between stores (`henosis migrate`). Every log and document is copied, then both
 * sides are folded and compared: a log's head hash is the id of the last event on each branch
 * (each id commits to the whole chain before it), a document's is its canonical hash. A copy
 * that does not fold to the same heads is reported and the migration refuses to finish.
 */
import { type ChainEvent, ChainLog, hashValue } from "@henosis/kernel";
import { type AnyLog, LOG_KINDS, type LogKind, type Store } from "./types.js";

export interface MigrateRow {
  kind: LogKind | "doc";
  id: string;
  branches: number;
  events: number;
  /** Head hash on each side, shortened; "-" when the side has nothing. */
  from: string;
  to: string;
  ok: boolean;
  /** Why a row is not ok. */
  reason?: string;
}

export interface MigrateReport {
  ok: boolean;
  rows: MigrateRow[];
}

/** Any serialized chain, loaded for its heads and its chain check. */
class AnyChainLog extends ChainLog<{ kind: string; payload: unknown }, ChainEvent> {
  static from(data: AnyLog): AnyChainLog {
    return new AnyChainLog().load(data);
  }
}

/** The head of every branch, folded into one hash; a broken chain yields null. */
export function headHash(log: AnyLog): { hash: string; events: number } | null {
  const chain = AnyChainLog.from(log);
  if (!chain.verify().ok) return null;
  const heads = chain.branchNames().map((b) => [b, chain.head(b)?.id ?? null]);
  const events = log.branches.reduce((n, b) => n + (log.events[b.name] ?? []).length, 0);
  return { hash: hashValue(heads), events };
}

/** Copy every log and document from one store to the other and verify each. */
export async function migrateStore(from: Store, to: Store): Promise<MigrateReport> {
  const rows: MigrateRow[] = [];
  for (const kind of LOG_KINDS) {
    for (const id of await from.listLogs(kind)) {
      const source = await from.readLog(kind, id);
      if (!source) continue;
      await to.writeLog(kind, id, source);
      const copy = await to.readLog(kind, id);
      const a = headHash(source);
      const b = copy ? headHash(copy) : null;
      const row: MigrateRow = {
        kind,
        id,
        branches: source.branches.length,
        events: a?.events ?? 0,
        from: a ? a.hash.slice(0, 12) : "broken",
        to: b ? b.hash.slice(0, 12) : copy ? "broken" : "-",
        ok: !!a && !!b && a.hash === b.hash && a.events === b.events,
      };
      if (!row.ok)
        row.reason = !a
          ? "source chain broken"
          : !copy
            ? "copy missing"
            : !b
              ? "copy chain broken"
              : "head hash differs";
      rows.push(row);
    }
  }
  for (const name of await from.listDocs()) {
    const json = await from.readDoc(name);
    await to.writeDoc(name, json);
    const back = await to.readDoc(name);
    const a = hashValue(json);
    const b = hashValue(back);
    rows.push({
      kind: "doc",
      id: name,
      branches: 0,
      events: 0,
      from: a.slice(0, 12),
      to: b.slice(0, 12),
      ok: a === b,
      ...(a === b ? {} : { reason: "document differs" }),
    });
  }
  return { ok: rows.every((r) => r.ok), rows };
}

/** The report as a plain-text table. */
export function renderMigrateTable(report: MigrateReport): string {
  const head = ["kind", "id", "branches", "events", "from", "to", "ok"];
  const body = report.rows.map((r) => [
    r.kind,
    r.id,
    r.kind === "doc" ? "" : String(r.branches),
    r.kind === "doc" ? "" : String(r.events),
    r.from,
    r.to,
    r.ok ? "ok" : `MISMATCH (${r.reason ?? "differs"})`,
  ]);
  const widths = head.map((h, i) => Math.max(h.length, ...body.map((row) => row[i]?.length ?? 0)));
  const line = (cells: string[]) =>
    cells.map((c, i) => c.padEnd(widths[i] ?? 0)).join("  ").trimEnd();
  const lines = [line(head), line(widths.map((w) => "-".repeat(w))), ...body.map(line)];
  const bad = report.rows.filter((r) => !r.ok).length;
  lines.push(
    bad
      ? `${bad} of ${report.rows.length} did not verify; the migration is not complete.`
      : `${report.rows.length} verified; every head hash matches.`,
  );
  return `${lines.join("\n")}\n`;
}
