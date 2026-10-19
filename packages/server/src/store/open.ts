/**
 * Choosing a store from the command line: `henosis serve --store file|postgres`, and the two
 * ends of `henosis migrate`. A folder is a `LiveStore` as it is; a database is opened,
 * given its schema and mirrored into memory.
 */
import { resolve } from "node:path";
import { FileStore } from "./fileStore.js";
import { MirrorStore } from "./mirror.js";
import { PostgresStore } from "./postgresStore.js";
import type { LiveStore, Store } from "./types.js";

export type StoreKind = "file" | "postgres";

export interface OpenStoreOptions {
  /** The store root for `file` (and for blobs in every edition). */
  root: string;
  /** Overrides `HENOSIS_DATABASE_URL` for `postgres`. */
  databaseUrl?: string | undefined;
  log?: ((line: string) => void) | undefined;
}

export function storeKindOf(value: string): StoreKind {
  if (value === "file" || value === "postgres") return value;
  throw new Error(`unknown store "${value}"; use file or postgres`);
}

/** The store a server runs on. */
export async function openLiveStore(kind: StoreKind, opts: OpenStoreOptions): Promise<LiveStore> {
  if (kind === "file") return new FileStore(resolve(opts.root));
  const pg = await PostgresStore.connect(opts.databaseUrl);
  await pg.ensureSchema();
  return MirrorStore.open(pg, { log: opts.log });
}

/** One end of a migration: `postgres`, or a folder. */
export async function openStoreEnd(
  spec: string,
  opts: { databaseUrl?: string | undefined },
): Promise<Store> {
  if (spec === "postgres") {
    const pg = await PostgresStore.connect(opts.databaseUrl);
    await pg.ensureSchema();
    return pg;
  }
  return new FileStore(resolve(spec));
}
