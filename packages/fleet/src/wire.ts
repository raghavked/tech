/** Project-level websocket messages, layered beside the session messages. */
import { DirectiveInput } from "@atelier/protocol";
import { z } from "zod";
import { ClaimMode, ProjectEventBody, Resource } from "./events.js";

export const ProjectClientMessage = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("project.subscribe"),
    projectId: z.string(),
    userId: z.string().optional(),
  }),
  z.object({ type: z.literal("project.unsubscribe") }),
  z.object({
    type: z.literal("claim"),
    sessionId: z.string(),
    resource: Resource,
    mode: ClaimMode.default("exclusive"),
    reason: z.string().default(""),
  }),
  z.object({ type: z.literal("release"), sessionId: z.string(), claimId: z.string() }),
  z.object({
    type: z.literal("project.directive"),
    input: DirectiveInput,
    targets: z.union([z.literal("all"), z.array(z.string())]).default("all"),
  }),
  z.object({ type: z.literal("project.withdraw"), directiveId: z.string() }),
  z.object({
    type: z.literal("fleet.resolve"),
    contentionId: z.string(),
    winnerSessionId: z.string().nullable(),
    note: z.string().default(""),
  }),
  z.object({ type: z.literal("fleet.brief") }),
  z.object({ type: z.literal("project.note"), text: z.string() }),
  z.object({ type: z.literal("session.create"), sessionId: z.string(), title: z.string() }),
]);
export type ProjectClientMessage = z.infer<typeof ProjectClientMessage>;

const ProjectEvent = z
  .object({
    id: z.string(),
    prev: z.string().nullable(),
    seq: z.number(),
    branch: z.string(),
    ts: z.number(),
    actor: z.string(),
  })
  .and(ProjectEventBody);

export const ProjectServerMessage = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("project.snapshot"),
    projectId: z.string(),
    events: z.array(ProjectEvent),
  }),
  z.object({ type: z.literal("project.event"), event: ProjectEvent }),
  z.object({ type: z.literal("fleet.brief"), markdown: z.string() }),
]);
export type ProjectServerMessage = z.infer<typeof ProjectServerMessage>;
