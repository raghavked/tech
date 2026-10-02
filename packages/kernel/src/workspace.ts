/**
 * Content-addressed workspace: blobs by hash, trees as path -> hash manifests, and a
 * three-way merge (diff3 at line granularity) for merging branches.
 */
import { hashValue, sha256Hex } from "./hash.js";

export type Tree = Record<string, string>;

export interface BlobStore {
  put(content: string): string;
  get(hash: string): string | undefined;
  has(hash: string): boolean;
}

export class MemoryBlobStore implements BlobStore {
  protected readonly blobs = new Map<string, string>();
  put(content: string): string {
    const h = blobHash(content);
    this.blobs.set(h, content);
    return h;
  }
  get(hash: string): string | undefined {
    return this.blobs.get(hash);
  }
  has(hash: string): boolean {
    return this.blobs.has(hash);
  }
  entries(): IterableIterator<[string, string]> {
    return this.blobs.entries();
  }
}

export function blobHash(content: string): string {
  return sha256Hex(`blob:${content}`);
}

export function treeHash(tree: Tree): string {
  return hashValue(tree);
}

export function applyChanges(tree: Tree, changes: Record<string, string | null>): Tree {
  const next: Tree = { ...tree };
  for (const [path, hash] of Object.entries(changes)) {
    if (hash === null) delete next[path];
    else next[path] = hash;
  }
  return next;
}

export interface FileMerge {
  content: string | null;
  conflict: boolean;
}

export interface TreeMerge {
  tree: Record<string, string | null>;
  conflicts: string[];
  /** New blobs produced by the merge (hash -> content), including conflict-marked files. */
  blobs: Record<string, string>;
}

/** Three-way merge of trees. Deletions are represented as null in the result. */
export function mergeTrees(base: Tree, ours: Tree, theirs: Tree, store: BlobStore): TreeMerge {
  const paths = new Set([...Object.keys(base), ...Object.keys(ours), ...Object.keys(theirs)]);
  const tree: Record<string, string | null> = {};
  const conflicts: string[] = [];
  const blobs: Record<string, string> = {};
  for (const path of [...paths].sort()) {
    const b = base[path];
    const o = ours[path];
    const t = theirs[path];
    if (o === t) {
      if (o !== undefined) tree[path] = o;
      else if (b !== undefined) tree[path] = null;
      continue;
    }
    if (o === b) {
      tree[path] = t ?? null;
      continue;
    }
    if (t === b) {
      tree[path] = o ?? null;
      continue;
    }
    // Both sides changed differently.
    const read = (h: string | undefined) => (h === undefined ? null : (store.get(h) ?? null));
    const merged = mergeFile(read(b), read(o), read(t));
    if (merged.content === null) {
      tree[path] = null;
    } else {
      const h = blobHash(merged.content);
      blobs[h] = merged.content;
      tree[path] = h;
    }
    if (merged.conflict) conflicts.push(path);
  }
  return { tree, conflicts, blobs };
}

/** diff3 on lines. Returns conflict-marked content when both sides changed the same region. */
export function mergeFile(
  base: string | null,
  ours: string | null,
  theirs: string | null,
): FileMerge {
  if (ours === null && theirs === null) return { content: null, conflict: false };
  if (ours === null || theirs === null) {
    // One side deleted, the other modified: conflict, keep the modified side.
    return { content: ours ?? theirs, conflict: true };
  }
  const b = (base ?? "").split("\n");
  const o = ours.split("\n");
  const t = theirs.split("\n");
  const oChunks = diff(b, o);
  const tChunks = diff(b, t);
  const out: string[] = [];
  let conflict = false;
  let bi = 0;
  let oi = 0;
  let ti = 0;
  // Walk the base; at each base line decide which side changed it.
  const oHunks = toHunks(oChunks);
  const tHunks = toHunks(tChunks);
  let hi = 0;
  let hj = 0;
  while (bi <= b.length) {
    const oh = oHunks[hi];
    const th = tHunks[hj];
    const oStarts = oh !== undefined && oh.baseStart === bi;
    const tStarts = th !== undefined && th.baseStart === bi;
    if (oStarts && tStarts && oh && th) {
      // Overlapping change region: extend to cover both hunks.
      let end = Math.max(oh.baseEnd, th.baseEnd);
      let hiEnd = hi + 1;
      let hjEnd = hj + 1;
      let grew = true;
      while (grew) {
        grew = false;
        while (hiEnd < oHunks.length && (oHunks[hiEnd] as Hunk).baseStart < end) {
          end = Math.max(end, (oHunks[hiEnd] as Hunk).baseEnd);
          hiEnd++;
          grew = true;
        }
        while (hjEnd < tHunks.length && (tHunks[hjEnd] as Hunk).baseStart < end) {
          end = Math.max(end, (tHunks[hjEnd] as Hunk).baseEnd);
          hjEnd++;
          grew = true;
        }
      }
      const oText = sideText(o, oi, oHunks.slice(hi, hiEnd), bi, end);
      const tText = sideText(t, ti, tHunks.slice(hj, hjEnd), bi, end);
      if (oText.join("\n") === tText.join("\n")) {
        out.push(...oText);
      } else {
        conflict = true;
        out.push("<<<<<<< ours", ...oText, "=======", ...tText, ">>>>>>> theirs");
      }
      oi += oText.length;
      ti += tText.length;
      bi = end;
      hi = hiEnd;
      hj = hjEnd;
      continue;
    }
    if (oStarts && oh) {
      out.push(...o.slice(oi, oi + oh.sideLen));
      oi += oh.sideLen;
      ti += oh.baseEnd - oh.baseStart;
      bi = oh.baseEnd;
      hi++;
      continue;
    }
    if (tStarts && th) {
      out.push(...t.slice(ti, ti + th.sideLen));
      ti += th.sideLen;
      oi += th.baseEnd - th.baseStart;
      bi = th.baseEnd;
      hj++;
      continue;
    }
    if (bi === b.length) break;
    out.push(b[bi] as string);
    bi++;
    oi++;
    ti++;
  }
  return { content: out.join("\n"), conflict };
}

/** Lines added and removed going from `a` to `b` (null is "no file"); what a +/- count shows. */
export function lineDelta(a: string | null, b: string | null): { plus: number; minus: number } {
  const al = a === null ? [] : a.split("\n");
  const bl = b === null ? [] : b.split("\n");
  let plus = 0;
  let minus = 0;
  for (const c of diff(al, bl)) {
    if (c.kind === "change") {
      plus += c.ins;
      minus += c.del;
    }
  }
  return { plus, minus };
}

interface Hunk {
  baseStart: number;
  baseEnd: number;
  sideLen: number;
}

type Chunk = { kind: "same"; n: number } | { kind: "change"; del: number; ins: number };

/** Myers-free LCS diff (DP); fine for the file sizes a session touches. */
function diff(a: string[], b: string[]): Chunk[] {
  const n = a.length;
  const m = b.length;
  const dp: Uint32Array[] = [];
  for (let i = 0; i <= n; i++) dp.push(new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      const row = dp[i] as Uint32Array;
      const next = dp[i + 1] as Uint32Array;
      row[j] =
        a[i] === b[j]
          ? (next[j + 1] as number) + 1
          : Math.max(next[j] as number, row[j + 1] as number);
    }
  }
  const chunks: Chunk[] = [];
  let i = 0;
  let j = 0;
  const push = (c: Chunk) => {
    const last = chunks[chunks.length - 1];
    if (last && last.kind === "same" && c.kind === "same") last.n += c.n;
    else if (last && last.kind === "change" && c.kind === "change") {
      last.del += c.del;
      last.ins += c.ins;
    } else chunks.push(c);
  };
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      push({ kind: "same", n: 1 });
      i++;
      j++;
    } else if (
      j < m &&
      (i >= n ||
        ((dp[i] as Uint32Array)[j + 1] as number) >= ((dp[i + 1] as Uint32Array)[j] as number))
    ) {
      push({ kind: "change", del: 0, ins: 1 });
      j++;
    } else {
      push({ kind: "change", del: 1, ins: 0 });
      i++;
    }
  }
  return chunks;
}

function toHunks(chunks: Chunk[]): Hunk[] {
  const hunks: Hunk[] = [];
  let base = 0;
  for (const c of chunks) {
    if (c.kind === "same") base += c.n;
    else {
      hunks.push({ baseStart: base, baseEnd: base + c.del, sideLen: c.ins });
      base += c.del;
    }
  }
  return hunks;
}

/** Lines on one side corresponding to base region [start, end) given that side's hunks within it. */
function sideText(side: string[], sideStart: number, hunks: Hunk[], start: number, end: number) {
  let len = end - start;
  for (const h of hunks) len += h.sideLen - (h.baseEnd - h.baseStart);
  return side.slice(sideStart, sideStart + len);
}
