/** Hook point: the conversation blocks of a session, folded incrementally across renders. */
import type { SessionState } from "@henosis/kernel";
import type { SessionEvent } from "@henosis/protocol";
import { useMemo, useRef } from "react";
import { type Block, BlockFolder } from "./blocks.js";

/**
 * Returns the same block array across renders, extended in place as events arrive, and a
 * `version` that bumps whenever it changed. A new log (reconnect, branch switch) starts over.
 */
export function useBlocks(
  events: readonly SessionEvent[],
  s: SessionState,
  meId: string,
): { blocks: Block[]; version: number } {
  const folder = useRef<BlockFolder | null>(null);
  if (!folder.current) folder.current = new BlockFolder();
  const f = folder.current;
  const blocks = useMemo(() => f.sync(events, s, meId), [f, events, s, meId]);
  return { blocks, version: f.version };
}
