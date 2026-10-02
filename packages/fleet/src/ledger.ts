import { ChainLog, type SerializedChain } from "@tiller/kernel";
import type { ProjectEvent, ProjectEventBody } from "./events.js";

export type SerializedLedger = SerializedChain<ProjectEvent>;

/** The project ledger: one branch, hash-chained, never forked. */
export class ProjectLedger extends ChainLog<ProjectEventBody, ProjectEvent> {
  constructor() {
    super(null);
  }
  static fromSerialized(data: SerializedLedger): ProjectLedger {
    return new ProjectLedger().load(data);
  }
}
