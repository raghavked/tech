/**
 * Member models over HTTP (docs/19_council.md): the agent a person brings to a council and
 * the org's shared team agents.
 *
 *   GET  /api/agents?user=U         the person's own agent with its defaults, whether they
 *                                   manage (so their persona defaults to the chair's), the
 *                                   shared agents, the orgs whose shared agents they may edit,
 *                                   which providers run here and the tools a profile may name
 *   PUT  /api/agents?user=U         { agent: AgentProfileInput }: Settings → My agent
 *   GET  /api/agents/:org           { orgId, agents, canEdit }: the shared agents
 *   PUT  /api/agents/:org?user=U    { agents: SharedAgentInput[] }: Settings → Team agents,
 *                                   by a lead or manager of a team in the org or an org admin
 *
 * Writes need the shared token in dev mode (as the team look does) and a person: a known one
 * for the shared agents; for "my agent" anyone identity names, so phase-0 stores work too.
 */
import type { IncomingMessage } from "node:http";
import {
  AgentProfileInput,
  CHAIR_PERSONA,
  isManager,
  SharedAgentInput,
  type User,
} from "@henosis/fleet";
import type { ToolRegistry } from "@henosis/runner";
import type { Auth } from "./auth.js";
import { type ModelFactory, modelNameOf } from "./models.js";
import type { OrgRegistry } from "./orgs.js";

export const AGENTS_PATH = /^\/api\/agents(?:\/([^/]+))?$/;

export interface AgentsApiContext {
  orgs: OrgRegistry;
  auth: Auth;
  tools: ToolRegistry;
  models: ModelFactory;
  /** A display name for a person users.json does not know (learned from sessions and chats). */
  nameOf: (userId: string) => string | null;
}

type Json = (code: number, body: unknown) => boolean;

const SharedAgentsInput = SharedAgentInput.array();

/** A profile as the API answers it: the stored fields plus the model id it runs on. */
export function agentRow<T extends { provider: "scripted" | "claude"; model: string }>(p: T) {
  return { ...p, modelName: modelNameOf(p) };
}

function issues(what: string, err: { issues: { path: PropertyKey[]; message: string }[] }): string {
  return err.issues
    .map((i) => `${[what, ...i.path.map(String)].join(".")}: ${i.message}`)
    .join("; ");
}

function bearerOf(req: IncomingMessage, url: URL): string | null {
  const h = req.headers.authorization;
  if (typeof h === "string" && h.toLowerCase().startsWith("bearer ")) return h.slice(7).trim();
  return url.searchParams.get("token");
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/** Handle the agents routes; false when the URL is not one of them. */
export function handleAgentsApi(
  req: IncomingMessage,
  url: URL,
  ctx: AgentsApiContext,
  json: Json,
): boolean {
  const m = url.pathname.match(AGENTS_PATH);
  if (!m) return false;
  const userId = url.searchParams.get("user");
  const orgId = m[1] ? decodeURIComponent(m[1]) : null;
  const write = req.method === "PUT";
  if (write && !ctx.auth.acceptsSharedToken(bearerOf(req, url)))
    return json(401, { error: "unauthorized" });
  if (write && !userId) return json(403, { error: "sign in as a person to change an agent" });

  if (orgId === null) {
    const user: User | null = ctx.orgs.user(userId);
    const mine = () => {
      if (!userId) return null;
      const p = ctx.orgs.personalAgent(userId, ctx.nameOf(userId) ?? user?.name ?? null);
      return agentRow(p);
    };
    const describe = () => ({
      mine: mine(),
      manager: user ? isManager(user) : false,
      chairPersona: CHAIR_PERSONA,
      shared: ctx.orgs.sharedAgents().map(agentRow),
      leads: ctx.orgs.agentLeadsFor(userId),
      providers: { scripted: true, claude: ctx.models.claudeAvailable() },
      tools: ctx.tools.specs().map((t) => ({ name: t.name, risk: t.risk })),
    });
    if (!write) return json(200, describe());
    void readBody(req).then((body) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(body || "{}");
      } catch {
        return json(400, { error: "bad json" });
      }
      const raw = (parsed as { agent?: unknown } | null)?.agent;
      if (raw === undefined || raw === null || typeof raw !== "object")
        return json(400, { error: "agent: an object is required" });
      const input = AgentProfileInput.safeParse(raw);
      if (!input.success) return json(400, { error: issues("agent", input.error) });
      try {
        ctx.orgs.setPersonalAgent(userId as string, input.data, ctx.nameOf(userId as string));
      } catch (err) {
        return json(400, { error: err instanceof Error ? err.message : String(err) });
      }
      return json(200, describe());
    });
    return true;
  }

  if (!ctx.orgs.orgs.orgs.some((o) => o.id === orgId))
    return json(404, { error: `unknown organisation ${orgId}` });
  const canEdit = ctx.orgs.canManageAgents(userId, orgId);
  const describe = () => ({ orgId, agents: ctx.orgs.sharedAgents().map(agentRow), canEdit });
  if (!write) return json(200, describe());
  if (!canEdit)
    return json(403, {
      error: "only a lead or manager in the organisation can change its team agents",
    });
  void readBody(req).then((body) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(body || "{}");
    } catch {
      return json(400, { error: "bad json" });
    }
    const raw = (parsed as { agents?: unknown } | null)?.agents;
    if (!Array.isArray(raw)) return json(400, { error: "agents: a list is required" });
    const input = SharedAgentsInput.safeParse(raw);
    if (!input.success) return json(400, { error: issues("agents", input.error) });
    try {
      ctx.orgs.setSharedAgents(input.data);
    } catch (err) {
      return json(400, { error: err instanceof Error ? err.message : String(err) });
    }
    return json(200, describe());
  });
  return true;
}
