/**
 * Notifications for the web, mobile and desktop shells: a per-user inbox fed by session and
 * project events (approval needed, handoff offered, fleet contention, session done, a mention
 * in a group chat), with push subscriptions recorded for a delivery adapter. Phase 0 delivers
 * by pull (the shells poll the inbox) and by an injectable sender; web push with VAPID is a
 * one-file adapter.
 *
 * One notification is one sentence said at three distances (toast, OS banner, inbox row), so
 * every item carries the same grammar: `who · verb · what` (the title), a `body` that says
 * where and then what it means for you, a `tag` so a repeat replaces instead of stacking, a
 * `route` (the client's hash path) beside the `link` (the henosis:// deep link every shell
 * understands), and an `age` in seconds at the time it was listed.
 */
import type { ProjectEvent } from "@henosis/fleet";
import { isRatingsRule, ruleFor } from "@henosis/kernel";
import type { SessionEvent, SessionPolicy, ToolCall } from "@henosis/protocol";
import { FileStore, type LiveStore } from "./store/index.js";

export type NotificationKind =
  | "approval"
  | "handoff"
  | "contention"
  | "done"
  | "blocked"
  | "plan"
  | "mention"
  | "joined"
  | "search";

export interface Notification {
  id: string;
  userId: string;
  kind: NotificationKind;
  /** The named thing the sentence starts with: "Bo's agent", "Cy", "Invoice PDF". */
  who: string;
  /** "wants to", "offers you", "mentioned you in", "joins", "finished". */
  verb: string;
  /** The rest of the sentence; `code` is the part of it set in mono (a command, a path). */
  what: string;
  code?: string;
  /** `who verb what`, for shells that print one line (the tray, an OS banner). */
  title: string;
  /** Where, then what it means for you: "Invoice PDF · You can approve, Ana". */
  body: string;
  /** Deep link understood by every shell: henosis://p/<project>/s/<session>, or henosis://c/<org>/<group> for a mention. */
  link: string;
  /** The web client's hash route for the same place: "#/p/<project>/s/<session>". */
  route: string;
  /** A repeat with the same tag replaces the earlier item instead of stacking beside it. */
  tag: string;
  /** What the shell acts on inline: the approvalId, handoffId, contentionId, planId or messageId behind this item. */
  ref?: string;
  /** An approval under a release gate: the shell asks for a 1..5 rating with the approve. */
  ratings?: boolean;
  /**
   * The needs-you figure for this person when the item was sent (approvals they can still
   * vote on plus handoffs offered to them): the app badge and the lock screen show it, so the
   * tab, the manager's sentence and the push agree. Absent when the server has no glance.
   */
  needsYou?: number;
  at: number;
  /** Seconds since `at`, filled in when the inbox is listed. */
  age?: number;
  read: boolean;
}

/** What a caller gives `notify`: the grammar; everything derivable has a default. */
export type NotificationInput = Pick<Notification, "kind" | "who" | "verb" | "what" | "link"> &
  Partial<Pick<Notification, "code" | "body" | "route" | "tag" | "ref" | "ratings" | "title">>;

export interface PushSubscription {
  userId: string;
  platform: "web" | "ios" | "android" | "desktop";
  /** Web push subscription JSON or a native device token. */
  token: string;
  endpoint?: string;
}

export type Sender = (sub: PushSubscription, n: Notification) => Promise<void>;

/** The one line: who · verb · what, with the mono part inside the sentence. */
export function sentenceOf(n: Pick<Notification, "who" | "verb" | "what">): string {
  return [n.who, n.verb, n.what].filter((s) => s.trim()).join(" ");
}

/** The web client's hash route for a henosis:// link. */
export function routeOfLink(link: string): string {
  const c = link.match(/^henosis:\/\/c\/([^/?#]+)\/([^/?#]+)/);
  if (c) return `#/c/${c[1]}/${c[2]}`;
  const m = link.match(/^henosis:\/\/p\/([^/?#]+)(?:\/s\/([^/?#]+))?/);
  if (m) return m[2] ? `#/p/${m[1]}/s/${m[2]}` : `#/p/${m[1]}`;
  if (link.startsWith("henosis://inbox")) return "#/inbox";
  return "#/";
}

/** A tool call in the product's words: the verb phrase and the part of it set in mono. */
export function describeCall(call: ToolCall): { what: string; code: string } {
  const a = call.args as Record<string, unknown>;
  const str = (k: string) => (typeof a[k] === "string" ? (a[k] as string) : "");
  const list = (k: string) => (Array.isArray(a[k]) ? (a[k] as unknown[]).map(String) : []);
  switch (call.name) {
    case "workspace.read":
      return { what: `read ${str("path")}`, code: str("path") };
    case "workspace.write":
      return { what: `write ${str("path")}`, code: str("path") };
    case "workspace.delete":
      return { what: `delete ${str("path")}`, code: str("path") };
    case "workspace.list":
      return { what: "list the workspace", code: "" };
    case "shell.run": {
      const cmd = [str("command"), ...list("args")].join(" ").trim();
      return { what: `run ${cmd}`, code: cmd };
    }
    case "deploy":
      return { what: `deploy to ${str("env")}`, code: str("env") };
    case "memory.remember":
      return { what: `remember ${str("key")}`, code: str("key") };
    case "memory.recall":
      return { what: "recall team memory", code: "" };
    case "fleet.claim":
      return { what: "claim a resource", code: "" };
    case "fleet.release":
      return { what: "release a claim", code: "" };
    default:
      return { what: `call ${call.name}`, code: call.name };
  }
}

export interface SessionMeta {
  title?: string;
  ownerId?: string | null;
  projectName?: string;
}

export class Notifier {
  private readonly inbox = new Map<string, Notification[]>();
  private readonly subs: PushSubscription[] = [];
  private readonly store: LiveStore;
  private counter = 0;
  /** The needs-you figure for a person, set by the server from its glance; rides in every payload. */
  badge: ((userId: string) => number) | null = null;

  /** Push subscriptions live in the `push` document of the store (push.json under a root). */
  constructor(
    rootOrStore: string | LiveStore,
    private readonly sender: Sender | null = null,
    private readonly log: (line: string) => void = () => {},
  ) {
    this.store = typeof rootOrStore === "string" ? new FileStore(rootOrStore) : rootOrStore;
    try {
      const data = this.store.readDoc("push") as { subs?: PushSubscription[] } | null;
      if (data?.subs) this.subs.push(...data.subs);
    } catch {
      /* start empty */
    }
  }

  subscribe(sub: PushSubscription): void {
    const i = this.subs.findIndex(
      (s) => s.userId === sub.userId && s.platform === sub.platform && s.token === sub.token,
    );
    if (i >= 0) this.subs[i] = sub;
    else this.subs.push(sub);
    this.store.writeDoc("push", { subs: this.subs });
  }

  subscriptions(userId: string): PushSubscription[] {
    return this.subs.filter((s) => s.userId === userId);
  }

  /** The inbox, each item with its age in seconds at this moment. */
  list(userId: string, unreadOnly = false, now = Date.now()): Notification[] {
    return (this.inbox.get(userId) ?? [])
      .filter((n) => !unreadOnly || !n.read)
      .map((n) => ({ ...n, age: Math.max(0, Math.round((now - n.at) / 1000)) }));
  }

  markRead(userId: string, ids: string[]): void {
    for (const n of this.inbox.get(userId) ?? []) if (ids.includes(n.id)) n.read = true;
  }

  /**
   * A decision anywhere settles the item everywhere: the approval was granted or denied, the
   * baton taken or declined, the plan decided. The rows go read in every inbox, so the toast,
   * the banner and the badge agree with the session.
   */
  settle(tags: string[]): void {
    if (tags.length === 0) return;
    for (const box of this.inbox.values())
      for (const n of box) if (tags.includes(n.tag)) n.read = true;
  }

  /**
   * File one notification. A repeat (same user, same tag) replaces the earlier item in place,
   * keeping its id so a shell that shows it updates rather than stacks; it becomes unread again.
   */
  notify(userId: string, input: NotificationInput): Notification {
    const box = this.inbox.get(userId) ?? [];
    const tag = input.tag ?? `${input.kind}:${input.ref ?? input.link}`;
    const earlier = box.find((n) => n.tag === tag);
    if (!earlier) this.counter += 1;
    const full: Notification = {
      id: earlier?.id ?? `n${Date.now()}_${this.counter}`,
      userId,
      kind: input.kind,
      who: input.who,
      verb: input.verb,
      what: input.what,
      ...(input.code ? { code: input.code } : {}),
      title: input.title ?? sentenceOf(input),
      body: input.body ?? "",
      link: input.link,
      route: input.route ?? routeOfLink(input.link),
      tag,
      ...(input.ref ? { ref: input.ref } : {}),
      ...(input.ratings ? { ratings: true } : {}),
      at: Date.now(),
      read: false,
    };
    if (this.badge) {
      try {
        full.needsYou = this.badge(userId);
      } catch (err) {
        this.log(`badge for ${userId} failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (earlier) box[box.indexOf(earlier)] = full;
    else box.push(full);
    if (box.length > 200) box.splice(0, box.length - 200);
    this.inbox.set(userId, box);
    if (this.sender) {
      for (const sub of this.subscriptions(userId)) {
        this.sender(sub, full).catch((err) =>
          this.log(
            `push to ${sub.platform} failed: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
      }
    }
    return full;
  }

  /** Route a session event to the humans who should act on it. */
  onSessionEvent(
    projectId: string,
    sessionId: string,
    e: SessionEvent,
    participants: { id: string; name: string; role: string; isDriver: boolean; kind: string }[],
    policy?: SessionPolicy,
    meta: SessionMeta = {},
  ): void {
    const link = `henosis://p/${projectId}/s/${sessionId}`;
    const humans = participants.filter((p) => p.kind === "human");
    const nameOf = (id: string) => humans.find((p) => p.id === id)?.name ?? id;
    const actorName = nameOf(e.actor);
    const where = meta.title || sessionId;
    // The agent is named after its owner ("Ana's agent"); a session without one keeps the actor's name.
    const owner = meta.ownerId ? humans.find((p) => p.id === meta.ownerId) : undefined;
    const agentActor = participants.find((p) => p.kind === "agent");
    const agentName = owner ? `${owner.name}'s agent` : (agentActor?.name ?? "The agent");
    const deciders = humans.filter((p) => p.role === "owner" || p.isDriver);
    switch (e.kind) {
      case "approval.requested": {
        const eligible = humans.filter((p) => p.role !== "observer");
        const rule = policy ? ruleFor(policy.approvals, e.payload.call.risk) : null;
        const ratings = rule ? isRatingsRule(rule) : false;
        const call = describeCall(e.payload.call);
        for (const p of eligible)
          this.notify(p.id, {
            kind: "approval",
            who: agentName,
            verb: "wants to",
            what: `${call.what}.`,
            ...(call.code ? { code: call.code } : {}),
            body: ratings
              ? `${where} · a release gate: rate it, then approve`
              : `${where} · You can approve, ${p.name}`,
            link,
            tag: `approval:${e.payload.approvalId}`,
            ref: e.payload.approvalId,
            ...(ratings ? { ratings: true } : {}),
          });
        break;
      }
      case "plan.proposed": {
        const n = e.payload.steps.length;
        for (const p of humans.filter((p) => p.role !== "observer"))
          this.notify(p.id, {
            kind: "plan",
            who: agentName,
            verb: "proposes",
            what: `a plan of ${n} step${n === 1 ? "" : "s"}.`,
            body: `${where} · about ${e.payload.estTokens.toLocaleString("en-US")} tokens · rate it 1 to 5`,
            link,
            tag: `plan:${e.payload.planId}`,
            ref: e.payload.planId,
          });
        break;
      }
      case "handoff.requested":
        this.notify(e.payload.to, {
          kind: "handoff",
          who: actorName,
          verb: "offers you",
          what: "the baton.",
          body: `${where} · you drive once you accept`,
          link,
          tag: `handoff:${e.payload.handoffId}`,
          ref: e.payload.handoffId,
        });
        break;
      case "participant.joined":
        if (e.payload.actor.kind === "human")
          for (const p of humans.filter((p) => p.id !== e.payload.actor.id))
            this.notify(p.id, {
              kind: "joined",
              who: e.payload.actor.name,
              verb: "joins",
              what: "the circle.",
              body: `${where} · as ${e.payload.role}`,
              link,
              tag: `joined:${sessionId}:${e.payload.actor.id}`,
            });
        break;
      case "fleet.contention.mirrored":
        if (!e.payload.resolved)
          for (const p of deciders)
            this.notify(p.id, {
              kind: "contention",
              who: where,
              verb: "collides on",
              what: `${e.payload.resource}.`,
              code: e.payload.resource,
              body: `${e.payload.kind} with another session · one of you picks`,
              link,
              tag: `contention:${e.payload.contentionId}`,
              ref: e.payload.contentionId,
            });
        break;
      case "workspace.blocked":
        for (const p of deciders)
          this.notify(p.id, {
            kind: "blocked",
            who: where,
            verb: "is blocked on",
            what: `${e.payload.path}.`,
            code: e.payload.path,
            body: `held by ${e.payload.holderSessionId} · retry once it is free`,
            link,
            tag: `blocked:${sessionId}:${e.payload.path}`,
          });
        break;
      case "agent.turn.ended":
        if (e.payload.summary.startsWith("DONE"))
          for (const p of deciders)
            this.notify(p.id, {
              kind: "done",
              who: agentName,
              verb: "finished",
              what: `${e.payload.summary.slice(5, 160).trim() || "what it was asked"}.`,
              body: `${where} · nothing waits on you`,
              link,
              tag: `done:${sessionId}:${e.payload.turn}`,
            });
        break;
      default:
        break;
    }
  }

  onProjectEvent(projectId: string, e: ProjectEvent, leads: string[], projectName?: string): void {
    if (e.kind !== "fleet.contention.opened") return;
    for (const lead of leads)
      this.notify(lead, {
        kind: "contention",
        who: projectName ?? projectId,
        verb: "has two sessions on",
        what: `${e.payload.resource}.`,
        code: e.payload.resource,
        body: `${e.payload.kind} · ${e.payload.detail.slice(0, 140)}`,
        link: `henosis://p/${projectId}`,
        tag: `contention:${e.payload.contentionId}`,
        ref: e.payload.contentionId,
      });
  }
}
