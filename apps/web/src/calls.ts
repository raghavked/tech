/**
 * What a tool call does, in words: `ask` for an approval sentence, `doing`/`done` for a step
 * line. One implementation, in stream/blocks.ts (it reads copy.steps); this module keeps the
 * shorter import path the approvals queue uses.
 */
export { describeCall } from "./stream/blocks.js";

export interface CallWords {
  ask: string;
  doing: string;
  done: string;
  icon: string;
}
