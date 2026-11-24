/**
 * Workspaces over HTTP: a company's own org on the server, its people, its invitations, and
 * the model key it brings (keys.ts, models.ts).
 *
 *   GET    /api/workspaces                       the caller's workspaces with their role, the
 *                                                teams and projects, and what each runs on
 *   POST   /api/workspaces            { name }   make one; the caller is its admin
 *   PUT    /api/workspaces/:org       { name }   rename (admin)
 *   GET    /api/workspaces/:org/members          members; for an admin, the invitations too
 *   PUT    /api/workspaces/:org/members/:user { role }   admin or member (admin)
 *   DELETE /api/workspaces/:org/members/:user    remove a member (admin), or leave (oneself)
 *   POST   /api/workspaces/:org/invites { role?, email? }   an invitation link; the token is
 *                                                answered once (admin)
 *   DELETE /api/workspaces/:org/invites/:id      withdraw it (admin)
 *   POST   /api/workspaces/:org/teams    { name }            add a team (admin)
 *   POST   /api/workspaces/:org/projects { name, teamId? }   add a project (admin)
 *   GET    /api/workspaces/:org/model            what the workspace runs on; never the key
 *   PUT    /api/workspaces/:org/model { key?, model? }   connect or replace the key, or pick
 *                                                the default model (admin)
 *   DELETE /api/workspaces/:org/model            disconnect the key (admin)
 *   POST   /api/workspaces/:org/model/check      ask the provider again whether the key works
 *   GET    /api/workspaces/:org/models           the models the key can use (admin)
 *   GET    /api/invites/:token                   what the link leads to
 *   POST   /api/invites/:token/accept            join
 *
 * Every route needs a person. On a server of workspaces a route under a workspace answers
 * only its members (404 for anyone else, so a workspace's existence is not disclosed); on a
 * one-org server the reads are open as the rest of that server is and the writes need an
 * admin of the org in users.json. Dev-mode writes need the shared token, as everywhere.
 */
import type { IncomingMessage } from "node:http";
import { DEFAULT_CLAUDE_MODEL, type KeyCheck } from "@henosis/runner";
import type { Auth, Principal } from "./auth.js";
import { cleanKey, type KeyStatus, type KeyVault } from "./keys.js";
import type { ModelFactory, ModelSource } from "./models.js";
import { type OrgRegistry, WorkspaceError, type WorkspaceRole } from "./orgs.js";

export const WORKSPACES_PATH =
  /^\/api\/workspaces(?:\/([^/]+)(?:\/(members|invites|teams|projects|model|models)(?:\/([^/]+))?)?)?$/;
export const INVITE_PATH = /^\/api\/invites\/([^/]+)(?:\/(accept))?$/;

export interface WorkspaceApiContext {
  orgs: OrgRegistry;
  auth: Auth;
  vault: KeyVault;
  models: ModelFactory;
  /** Ask the provider whether a key works (and can use a model); skipped when offline. */
  checkKey: (key: string, model?: string) => Promise<KeyCheck>;
  /** The models a key can use, as the provider lists them. */
  listModels: (key: string) => Promise<{ id: string; name: string }[]>;
  /** Whether provider calls are blocked (HENOSIS_OFFLINE): a key is then kept unchecked. */
  offline: () => boolean;
  /** A display name for a person users.json does not know. */
  nameOf: (userId: string) => string | null;
  /** Called after a workspace was made, so the server can open its chat and memory. */
  onCreated?: ((orgId: string) => void) | undefined;
  log?: ((line: string) => void) | undefined;
}

type Json = (code: number, body: unknown) => boolean;

/** What a workspace runs on, as Settings and the session read it. */
export interface WorkspaceModelView extends KeyStatus {
  /** `workspace`: its own key. `server`: the server owner's model. `demo`: the scripted stand-in. */
  source: ModelSource;
  /** The model id the workspace's agents run on right now. */
  running: string;
  /** The provider's default, which an empty `model` means. */
  defaultModel: string;
  /** Whether the caller may connect, replace or remove the key. */
  canManage: boolean;
  /** Whether this server can keep keys at all. */
  storage: boolean;
  addedByName: string | null;
}

function bearerOf(req: IncomingMessage, url: URL): string | null {
  const h = req.headers.authorization;
  if (typeof h === "string" && h.toLowerCase().startsWith("bearer ")) return h.slice(7).trim();
  return url.searchParams.get("token");
}

function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > 64 * 1024) reject(new WorkspaceError("invalid", "the request is too large"));
      else chunks.push(c);
    });
    req.on("end", () => {
      try {
        const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
          return reject(new WorkspaceError("invalid", "a JSON object is required"));
        resolve(parsed as Record<string, unknown>);
      } catch {
        reject(new WorkspaceError("invalid", "bad json"));
      }
    });
    req.on("error", reject);
  });
}

const STATUS = { invalid: 400, forbidden: 403, not_found: 404, conflict: 409 } as const;

function fail(json: Json, err: unknown): boolean {
  if (err instanceof WorkspaceError) return json(STATUS[err.code], { error: err.message });
  return json(500, { error: err instanceof Error ? err.message : String(err) });
}

export function workspaceModelView(
  ctx: Pick<WorkspaceApiContext, "orgs" | "vault" | "models" | "nameOf">,
  orgId: string,
  userId: string | null,
): WorkspaceModelView {
  const status = ctx.vault.describe(orgId);
  const by = status.addedBy;
  return {
    ...status,
    source: ctx.models.source(orgId),
    running: ctx.models.sessionModelName(orgId),
    defaultModel: DEFAULT_CLAUDE_MODEL,
    canManage: ctx.orgs.isOrgAdmin(userId, orgId),
    storage: ctx.vault.configured,
    addedByName: by ? (ctx.orgs.user(by)?.name ?? ctx.nameOf(by) ?? null) : null,
  };
}

function workspaceView(ctx: WorkspaceApiContext, orgId: string, userId: string | null) {
  const org = ctx.orgs.orgs.orgs.find((o) => o.id === orgId);
  if (!org) throw new WorkspaceError("not_found", `unknown workspace ${orgId}`);
  return {
    id: org.id,
    name: org.name,
    role: ctx.orgs.orgRole(userId, orgId),
    teams: org.teams.map((t) => ({
      id: t.id,
      name: t.name,
      projects: t.projects.map((p) => ({ id: p.id, name: p.name })),
    })),
    members: ctx.orgs.members(orgId).length,
    model: workspaceModelView(ctx, orgId, userId),
  };
}

/** Handle the workspace and invitation routes; false when the URL is neither. */
export function handleWorkspaceApi(
  req: IncomingMessage,
  url: URL,
  who: Principal | null,
  ctx: WorkspaceApiContext,
  json: Json,
): boolean {
  const inv = url.pathname.match(INVITE_PATH);
  const m = inv ? null : url.pathname.match(WORKSPACES_PATH);
  if (!inv && !m) return false;
  const method = req.method ?? "GET";
  const userId = who?.userId ?? url.searchParams.get("user");
  if (!userId) return json(401, { error: "unauthorized: sign in first" });
  const write = method !== "GET";
  if (write && !ctx.auth.acceptsSharedToken(bearerOf(req, url)))
    return json(401, { error: "unauthorized" });
  const seed = {
    userId,
    // A verified token names the person; a dev-mode client says its own display name.
    name: who?.name ?? url.searchParams.get("name")?.trim().slice(0, 80) ?? ctx.nameOf(userId),
    email: who?.email ?? null,
  };
  const run = (work: () => Promise<boolean> | boolean): boolean => {
    try {
      const out = work();
      if (out instanceof Promise) void out.catch((err: unknown) => fail(json, err));
      return true;
    } catch (err) {
      return fail(json, err);
    }
  };

  if (inv) {
    const token = decodeURIComponent(inv[1] as string);
    return run(() => {
      if (inv[2] === "accept") {
        if (method !== "POST") return json(405, { error: "POST" });
        const workspace = ctx.orgs.acceptInvite(token, seed);
        ctx.onCreated?.(workspace.id);
        return json(200, { workspace: workspaceView(ctx, workspace.id, userId) });
      }
      const found = ctx.orgs.inviteByToken(token);
      if (!found) return json(404, { error: "this invitation does not exist" });
      return json(200, {
        workspace: found.workspace,
        role: found.invite.role,
        state: found.invite.state,
        email: found.invite.email,
        expiresAt: found.invite.expiresAt,
        invitedBy: ctx.orgs.user(found.invite.createdBy)?.name ?? null,
        member: ctx.orgs.isMember(userId, found.workspace.id),
      });
    });
  }

  const [, rawOrg, part, rawItem] = m as RegExpMatchArray;
  if (!rawOrg) {
    return run(async () => {
      if (method === "POST") {
        if (!ctx.orgs.strict)
          throw new WorkspaceError(
            "forbidden",
            "this server holds one organisation; its teams and projects are set by whoever runs it",
          );
        const body = await readJson(req);
        const org = ctx.orgs.createWorkspace(seed, typeof body.name === "string" ? body.name : "");
        ctx.onCreated?.(org.id);
        ctx.log?.(`workspaces: ${userId} made ${org.id}`);
        return json(201, { workspace: workspaceView(ctx, org.id, userId) });
      }
      const mine = ctx.orgs.orgs.orgs.filter((o) => ctx.orgs.isMember(userId, o.id));
      // A one-org server shows its orgs to a person it has not placed, as the rest of it does.
      const shown = mine.length > 0 || ctx.orgs.strict ? mine : ctx.orgs.orgsFor(userId);
      return json(200, {
        tenancy: ctx.orgs.tenancy,
        canCreate: ctx.orgs.strict,
        workspaces: shown.map((o) => workspaceView(ctx, o.id, userId)),
      });
    });
  }

  const orgId = decodeURIComponent(rawOrg);
  const item = rawItem ? decodeURIComponent(rawItem) : null;
  // Outside the workspace it does not exist, as far as the answer says.
  if (!ctx.orgs.orgs.orgs.some((o) => o.id === orgId) || !ctx.orgs.canSee(userId, orgId))
    return json(404, { error: `unknown workspace ${orgId}` });
  const admin = ctx.orgs.isOrgAdmin(userId, orgId);
  const needAdmin = (what: string) => {
    if (!admin) throw new WorkspaceError("forbidden", `only an admin of the workspace can ${what}`);
  };

  return run(async () => {
    if (!part) {
      if (method === "PUT") {
        needAdmin("rename it");
        const body = await readJson(req);
        ctx.orgs.renameWorkspace(orgId, typeof body.name === "string" ? body.name : "");
      } else if (method !== "GET") return json(405, { error: "GET or PUT" });
      return json(200, { workspace: workspaceView(ctx, orgId, userId) });
    }

    if (part === "members") {
      const answer = () =>
        json(200, {
          members: ctx.orgs.members(orgId),
          invites: admin ? ctx.orgs.invitesOf(orgId) : [],
          canManage: admin,
        });
      if (!item) return method === "GET" ? answer() : json(405, { error: "GET" });
      if (method === "PUT") {
        needAdmin("change a role");
        const body = await readJson(req);
        if (body.role !== "admin" && body.role !== "member")
          throw new WorkspaceError("invalid", "role: admin or member");
        ctx.orgs.setOrgRole(orgId, item, body.role as WorkspaceRole);
        return answer();
      }
      if (method === "DELETE") {
        if (item !== userId) needAdmin("remove a member");
        ctx.orgs.removeMember(orgId, item);
        if (item === userId) return json(200, { left: true });
        return answer();
      }
      return json(405, { error: "PUT or DELETE" });
    }

    if (part === "invites") {
      needAdmin("invite people");
      if (method === "POST" && !item) {
        const body = await readJson(req);
        const role = body.role === "admin" ? "admin" : "member";
        const email = typeof body.email === "string" && body.email.trim() ? body.email : undefined;
        const made = ctx.orgs.createInvite(orgId, userId, { role, email });
        return json(201, { invite: made.invite, token: made.token });
      }
      if (method === "DELETE" && item) {
        if (!ctx.orgs.revokeInvite(orgId, item))
          throw new WorkspaceError("not_found", "no such invitation");
        return json(200, { invites: ctx.orgs.invitesOf(orgId) });
      }
      if (method === "GET" && !item) return json(200, { invites: ctx.orgs.invitesOf(orgId) });
      return json(405, { error: "POST, or DELETE with an id" });
    }

    if (part === "teams" || part === "projects") {
      if (method !== "POST" || item) return json(405, { error: "POST" });
      needAdmin(part === "teams" ? "add a team" : "add a project");
      const body = await readJson(req);
      const name = typeof body.name === "string" ? body.name : "";
      if (part === "teams") ctx.orgs.createTeam(orgId, name);
      else
        ctx.orgs.createProject(orgId, name, typeof body.teamId === "string" ? body.teamId : null);
      return json(201, { workspace: workspaceView(ctx, orgId, userId) });
    }

    if (part === "models") {
      if (method !== "GET") return json(405, { error: "GET" });
      needAdmin("list the models its key can use");
      const key = ctx.vault.key(orgId);
      if (!key || ctx.offline()) return json(200, { models: [] });
      try {
        return json(200, { models: await ctx.listModels(key) });
      } catch {
        return json(200, { models: [], error: "The provider could not be reached." });
      }
    }

    // part === "model"
    const view = () => json(200, { model: workspaceModelView(ctx, orgId, userId) });
    if (item === "check") {
      if (method !== "POST") return json(405, { error: "POST" });
      needAdmin("check its key");
      const key = ctx.vault.key(orgId);
      if (!key) throw new WorkspaceError("not_found", "the workspace has no key connected");
      if (ctx.offline()) return view();
      const checked = await ctx.checkKey(key, ctx.vault.describe(orgId).model || undefined);
      if (checked.ok) ctx.vault.mark(orgId, "ok");
      else if (checked.reason === "refused") ctx.vault.mark(orgId, "refused");
      return json(200, {
        model: workspaceModelView(ctx, orgId, userId),
        ...(checked.ok ? {} : { error: checked.message, reason: checked.reason }),
      });
    }
    if (item) return json(404, { error: "not found" });
    if (method === "GET") return view();
    if (method === "DELETE") {
      needAdmin("disconnect its key");
      ctx.vault.remove(orgId);
      ctx.log?.(`keys: ${userId} disconnected the key of ${orgId}`);
      return view();
    }
    if (method !== "PUT") return json(405, { error: "GET, PUT or DELETE" });
    needAdmin("connect a key");
    if (!ctx.vault.configured)
      return json(503, {
        error: "This server cannot keep keys yet: whoever runs it sets HENOSIS_KEYS_SECRET first.",
      });
    const body = await readJson(req);
    const model = typeof body.model === "string" ? body.model.trim().slice(0, 120) : undefined;
    if (model !== undefined && model !== "" && !/^[A-Za-z0-9][A-Za-z0-9._:@-]*$/.test(model))
      throw new WorkspaceError("invalid", "model: a model id, or empty for the default");
    if (body.key === undefined) {
      if (model === undefined) throw new WorkspaceError("invalid", "key or model is required");
      const key = ctx.vault.key(orgId);
      if (!key) throw new WorkspaceError("not_found", "connect a key before picking its model");
      if (model && !ctx.offline()) {
        const checked = await ctx.checkKey(key, model);
        if (!checked.ok)
          return json(checked.reason === "unreachable" ? 502 : 400, checkedBody(checked));
      }
      ctx.vault.setModel(orgId, model);
      return view();
    }
    const key = cleanKey(body.key);
    if (!key)
      throw new WorkspaceError(
        "invalid",
        "That does not look like a key: paste it whole, on one line.",
      );
    if (!ctx.offline()) {
      const checked = await ctx.checkKey(key, model || undefined);
      if (!checked.ok)
        return json(checked.reason === "unreachable" ? 502 : 400, checkedBody(checked));
    }
    ctx.vault.set(orgId, key, { userId, ...(model !== undefined ? { model } : {}) });
    ctx.log?.(`keys: ${userId} connected a key for ${orgId}`);
    return view();
  });
}

function checkedBody(checked: Exclude<KeyCheck, { ok: true }>) {
  return { error: checked.message, reason: checked.reason };
}
