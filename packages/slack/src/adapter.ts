/**
 * Slack adapter: channels map to team, project and management; each session is a thread in
 * its project channel; approvals are buttons; fleet contentions and memory conflicts go to
 * the management channel and to the owners' threads; thread replies steer the session.
 *
 * Slack is write-mostly here (no polling of threads) and updates coalesce per thread so a
 * busy fleet stays under the roughly one-message-per-second-per-channel limit.
 */
import type { ProjectEvent } from "@fold/fleet";
import type { MemoryEvent, MemoryStore } from "@fold/memory";
import type { DirectiveInput, SessionEvent } from "@fold/protocol";
import type { FoldServer, ProjectHost } from "@fold/server";
import { z } from "zod";
import type { Block, SlackClient } from "./client.js";

export const ChannelMap = z.object({
  /** teamId -> channel id */
  teams: z.record(z.string()).default({}),
  /** projectId -> channel id */
  projects: z.record(z.string()).default({}),
  /** channel id for leads and managers: digests, contentions, memory conflicts */
  management: z.string().optional(),
  /** slack user id -> fold user id */
  users: z.record(z.string()).default({}),
});
export type ChannelMap = z.infer<typeof ChannelMap>;

interface ThreadRef {
  channel: string;
  ts: string;
}

export interface SlackAdapterOptions {
  server: FoldServer;
  client: SlackClient;
  map: ChannelMap;
  /** Coalesce window for thread updates, ms. 0 = immediate (tests). */
  coalesceMs?: number;
  log?: (line: string) => void;
}

export class SlackAdapter {
  private readonly threads = new Map<string, ThreadRef>();
  private readonly approvalMessages = new Map<string, ThreadRef>();
  private readonly pendingLines = new Map<string, string[]>();
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly watched = new Set<string>();
  private readonly memoriesWatched = new Set<string>();

  constructor(private readonly opts: SlackAdapterOptions) {
    const { client } = opts;
    client.onAction((e) => this.onAction(e));
    client.onMessage((e) => this.onMessage(e));
    client.onSlash("/fold", (e) => this.onSlash(e));
  }

  /** Attach to a project host: existing sessions get threads; new ones are picked up as they register. */
  watchProject(projectId: string): void {
    if (this.watched.has(projectId)) return;
    this.watched.add(projectId);
    const host = this.opts.server.project(projectId);
    host.project.onEvent((e) => void this.onProjectEvent(host, e));
    for (const [sid, sh] of host.hosts)
      this.attachSession(host, sid, sh.session.state().title, sh.session.state().ownerId);
    const org = host.state().orgId;
    if (!this.memoriesWatched.has(org)) {
      this.memoriesWatched.add(org);
      const store = this.opts.server.memory(org);
      store.onEvent((e) => void this.onMemoryEvent(store, e));
    }
  }

  async start(): Promise<void> {
    await this.opts.client.start();
  }

  async stop(): Promise<void> {
    for (const t of this.timers.values()) clearTimeout(t);
    await this.opts.client.stop();
  }

  // ---- outbound ------------------------------------------------------------------------

  private nameOf(host: ProjectHost, userId: string): string {
    return host.state().members[userId]?.name ?? this.opts.server.orgs.user(userId)?.name ?? userId;
  }

  private channelFor(host: ProjectHost): string | null {
    const st = host.state();
    return (
      this.opts.map.projects[st.projectId] ??
      this.opts.map.teams[st.teamId] ??
      this.opts.map.management ??
      null
    );
  }

  private attachSession(
    host: ProjectHost,
    sessionId: string,
    title: string,
    ownerId: string | null,
  ): void {
    if (this.threads.has(sessionId)) return;
    const channel = this.channelFor(host);
    if (!channel) return;
    const owner = ownerId ? this.nameOf(host, ownerId) : "someone";
    void this.opts.client
      .post({
        channel,
        text: `:fold: *${owner}'s agent* started "${title}" in ${host.state().name}. Reply in this thread to steer it.`,
      })
      .then((posted) => {
        this.threads.set(sessionId, posted);
        const sh = host.hosts.get(sessionId);
        sh?.session.onEvent((e) => void this.onSessionEvent(host, sessionId, e));
        this.flushLater(sessionId);
      });
  }

  private onProjectEvent(host: ProjectHost, e: ProjectEvent): void {
    switch (e.kind) {
      case "session.registered":
        this.attachSession(host, e.payload.sessionId, e.payload.title, e.payload.ownerId);
        break;
      case "fleet.contention.opened": {
        const names = e.payload.sessionIds.map(
          (id) => host.state().members[host.state().sessions[id]?.ownerId ?? ""]?.name ?? id,
        );
        const text = `:warning: Fleet contention (${e.payload.kind}) on \`${e.payload.resource}\` between ${names.join(" and ")}: ${e.payload.detail}`;
        const blocks: Block[] = [
          { type: "section", text: { type: "mrkdwn", text } },
          {
            type: "actions",
            elements: e.payload.sessionIds.map((id) => ({
              type: "button",
              text: {
                type: "plain_text",
                text: `${host.state().members[host.state().sessions[id]?.ownerId ?? ""]?.name ?? id} wins`,
              },
              action_id: `resolve:${host.projectId}:${e.payload.contentionId}:${id}`,
              value: id,
            })),
          },
        ];
        if (this.opts.map.management)
          void this.opts.client.post({ channel: this.opts.map.management, text, blocks });
        for (const id of e.payload.sessionIds) this.queue(id, text);
        break;
      }
      case "fleet.contention.resolved": {
        const c = host.state().contentions[e.payload.contentionId];
        const winner = c?.winnerSessionId
          ? (host.state().members[host.state().sessions[c.winnerSessionId]?.ownerId ?? ""]?.name ??
            c.winnerSessionId)
          : "nobody";
        for (const id of c?.sessionIds ?? [])
          this.queue(
            id,
            `:white_check_mark: Contention on \`${c?.resource}\` resolved by ${host.state().members[e.actor]?.name ?? e.actor}: ${winner} wins. ${e.payload.note}`,
          );
        break;
      }
      case "project.directive.submitted": {
        const who = host.state().members[e.actor]?.name ?? e.actor;
        const channel = this.channelFor(host);
        const text = `:bookmark_tabs: *Project directive from ${who}* [${e.payload.input.mode}/${e.payload.input.scope}]: ${e.payload.input.text} (applies to ${e.payload.targets === "all" ? "all sessions" : `${e.payload.targets.length} session(s)`})`;
        if (channel) void this.opts.client.post({ channel, text });
        break;
      }
      case "claim.violation":
        this.queue(
          e.payload.sessionId,
          `:no_entry: A write to \`${e.payload.path}\` was refused: another session holds it (claim ${e.payload.holderClaimId}).`,
        );
        break;
      default:
        break;
    }
  }

  private onSessionEvent(host: ProjectHost, sessionId: string, e: SessionEvent): void {
    const sh = host.hosts.get(sessionId);
    const st = sh?.session.state(e.branch);
    const name = (id: string) =>
      st?.participants[id]?.actor.name ?? host.state().members[id]?.name ?? id;
    switch (e.kind) {
      case "agent.turn.ended":
        this.queue(
          sessionId,
          `turn ${e.payload.turn} ${e.payload.reason}: ${e.payload.summary.slice(0, 300)}`,
        );
        break;
      case "directive.submitted":
        this.queue(
          sessionId,
          `*${name(e.actor)}* [${e.payload.input.mode}/${e.payload.input.scope}]: ${e.payload.input.text}`,
        );
        break;
      case "approval.requested": {
        const ref = this.threads.get(sessionId);
        if (!ref) break;
        const call = e.payload.call;
        const rule = st ? st.policy.approvals[call.risk] : undefined;
        const text = `:raised_hand: *Approval needed* in ${name(st?.ownerId ?? "")}'s session: \`${call.name}\` [${call.risk}] ${JSON.stringify(call.args).slice(0, 200)}${rule && typeof rule === "object" ? ` (needs ${rule.quorum} ${rule.of}s)` : ""}`;
        const blocks: Block[] = [
          { type: "section", text: { type: "mrkdwn", text } },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                style: "primary",
                text: { type: "plain_text", text: "Approve" },
                action_id: `vote:${host.projectId}:${sessionId}:${e.payload.approvalId}:approve`,
                value: e.payload.approvalId,
              },
              {
                type: "button",
                style: "danger",
                text: { type: "plain_text", text: "Deny" },
                action_id: `vote:${host.projectId}:${sessionId}:${e.payload.approvalId}:deny`,
                value: e.payload.approvalId,
              },
            ],
          },
        ];
        void this.opts.client
          .post({
            channel: ref.channel,
            threadTs: ref.ts,
            text,
            blocks,
            broadcast: call.risk === "irreversible",
          })
          .then((posted) => this.approvalMessages.set(e.payload.approvalId, posted));
        break;
      }
      case "approval.voted": {
        const a = st?.approvals[e.payload.approvalId];
        const ref = this.approvalMessages.get(e.payload.approvalId);
        if (ref && a && a.status !== "pending") {
          const votes = Object.entries(a.votes)
            .map(([k, v]) => `${name(k)} ${v}d`)
            .join(", ");
          void this.opts.client.update(
            ref.channel,
            ref.ts,
            `${a.status === "granted" ? ":white_check_mark:" : ":x:"} \`${a.call.name}\` ${a.status} (${votes})`,
            [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `${a.status === "granted" ? ":white_check_mark:" : ":x:"} \`${a.call.name}\` *${a.status}* (${votes})`,
                },
              },
            ],
          );
        }
        break;
      }
      case "handoff.accepted":
        this.queue(sessionId, `:handshake: ${name(e.actor)} is now driving.`);
        break;
      case "workspace.blocked":
        break;
      default:
        break;
    }
  }

  private onMemoryEvent(store: MemoryStore, e: MemoryEvent): void {
    if (e.kind !== "memory.conflict.opened" || !this.opts.map.management) return;
    const st = store.state();
    const sides = e.payload.entryIds
      .map((id) => st.entries[id])
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
    const text = `:thinking_face: *Team memory conflict* on \`${e.payload.key}\`: ${sides.map((s) => `${s.attribution.userName ?? s.attribution.userId} says "${s.content.split("\n")[0]}"`).join(" vs ")}`;
    const blocks: Block[] = [
      { type: "section", text: { type: "mrkdwn", text } },
      {
        type: "actions",
        elements: sides.map((s) => ({
          type: "button",
          text: {
            type: "plain_text",
            text: `${s.attribution.userName ?? s.attribution.userId} is right`,
          },
          action_id: `memory:${st.orgId}:${e.payload.conflictId}:${s.id}`,
          value: s.id,
        })),
      },
    ];
    void this.opts.client.post({ channel: this.opts.map.management, text, blocks });
  }

  private queue(sessionId: string, line: string): void {
    const q = this.pendingLines.get(sessionId) ?? [];
    q.push(line);
    this.pendingLines.set(sessionId, q);
    this.flushLater(sessionId);
  }

  private flushLater(sessionId: string): void {
    const ms = this.opts.coalesceMs ?? 1500;
    if (ms === 0) {
      void this.flush(sessionId);
      return;
    }
    if (this.timers.has(sessionId)) return;
    this.timers.set(
      sessionId,
      setTimeout(() => {
        this.timers.delete(sessionId);
        void this.flush(sessionId);
      }, ms),
    );
  }

  /** Post queued lines for a session as one thread reply. Public so tests and shutdown can drain. */
  async flush(sessionId: string): Promise<void> {
    const ref = this.threads.get(sessionId);
    const lines = this.pendingLines.get(sessionId) ?? [];
    if (!ref || !lines.length) return;
    this.pendingLines.set(sessionId, []);
    await this.opts.client.post({ channel: ref.channel, threadTs: ref.ts, text: lines.join("\n") });
  }

  async flushAll(): Promise<void> {
    for (const id of this.pendingLines.keys()) await this.flush(id);
  }

  // ---- inbound -------------------------------------------------------------------------

  private userFor(slackUserId: string): string {
    return this.opts.map.users[slackUserId] ?? slackUserId;
  }

  private async onAction(e: { actionId: string; value: string; userId: string }): Promise<void> {
    const [kind, a, b, c, d] = e.actionId.split(":");
    const user = this.userFor(e.userId);
    try {
      if (kind === "vote" && a && b && c && d) {
        const host = this.opts.server.project(a);
        const sh = host.hosts.get(b);
        if (!sh) throw new Error(`unknown session ${b}`);
        const st = sh.session.state();
        if (!st.participants[user])
          sh.session.join(
            "main",
            { id: user, kind: "human", name: host.state().members[user]?.name ?? user },
            this.roleFor(host, user, st.ownerId),
          );
        sh.session.vote("main", user, c, d === "approve" ? "approve" : "deny");
        void sh.drive("main");
      } else if (kind === "resolve" && a && b && c) {
        this.opts.server.project(a).project.resolveContention(user, b, c, "resolved from Slack");
      } else if (kind === "memory" && a && b && c) {
        this.opts.server.memory(a).resolveConflict(user, b, c, "resolved from Slack");
      }
    } catch (err) {
      this.opts.log?.(`slack action failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private roleFor(
    host: ProjectHost,
    user: string,
    ownerId: string | null,
  ): "owner" | "contributor" | "observer" {
    if (user === ownerId) return "owner";
    const rank = host.project.rankOf(user);
    return rank >= 2 ? "owner" : rank >= 1 ? "contributor" : "observer";
  }

  private async onMessage(e: {
    channel: string;
    threadTs: string | null;
    userId: string;
    text: string;
  }): Promise<void> {
    if (!e.threadTs) return;
    const entry = [...this.threads.entries()].find(
      ([, ref]) => ref.channel === e.channel && ref.ts === e.threadTs,
    );
    if (!entry) return;
    const [sessionId] = entry;
    const user = this.userFor(e.userId);
    for (const host of this.opts.server.projects.values()) {
      const sh = host.hosts.get(sessionId);
      if (!sh) continue;
      try {
        const st = sh.session.state();
        if (!st.participants[user])
          sh.session.join(
            "main",
            { id: user, kind: "human", name: host.state().members[user]?.name ?? user },
            this.roleFor(host, user, st.ownerId),
          );
        const m = e.text.match(/^\/(\w+)\s*(.*)$/s);
        const text = m ? (m[2] ?? "") : e.text;
        const scopeMatch = text.match(/^\[([a-z0-9._-]+)\]\s*(.*)$/s);
        const scope = scopeMatch?.[1];
        const input: Partial<DirectiveInput> & { text: string } =
          m?.[1] === "constrain"
            ? { text, mode: "constrain" }
            : m?.[1] === "pause" || m?.[1] === "resume" || m?.[1] === "cancel"
              ? { text: text || m[1], mode: m[1] as "pause" | "resume" | "cancel" }
              : scope
                ? { text: scopeMatch?.[2] ?? "", scope }
                : { text };
        sh.session.directive("main", user, input);
        void sh.drive("main");
      } catch (err) {
        this.opts.log?.(`slack steer failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      return;
    }
  }

  private async onSlash(e: {
    text: string;
    userId: string;
    respond(t: string): Promise<void>;
  }): Promise<void> {
    const [cmd, arg] = e.text.trim().split(/\s+/);
    try {
      if (cmd === "brief" && arg) {
        await e.respond(this.opts.server.project(arg).brief());
      } else if (cmd === "sessions" && arg) {
        const st = this.opts.server.project(arg).state();
        await e.respond(
          Object.values(st.sessions)
            .filter((s) => s.open)
            .map(
              (s) =>
                `• ${st.members[s.ownerId]?.name ?? s.ownerId}: ${s.title} [${s.report?.status ?? "unknown"}]`,
            )
            .join("\n") || "no open sessions",
        );
      } else if (cmd === "memory" && arg) {
        await e.respond(
          this.opts.server.memory(arg).contextFor({ orgId: arg }, this.userFor(e.userId)) ||
            "team memory is empty",
        );
      } else {
        await e.respond("usage: /fold brief <project> | sessions <project> | memory <org>");
      }
    } catch (err) {
      await e.respond(`error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
