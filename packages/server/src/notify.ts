/**
 * Notifications for the mobile and desktop shells: a per-user inbox fed by session and
 * project events (approval needed, handoff offered, fleet contention, session done), with
 * push subscriptions recorded for a delivery adapter. Phase 0 delivers by pull (the shells
 * poll the inbox) and by an injectable sender; web push with VAPID is a one-file adapter.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ProjectEvent } from "@tiller/fleet";
import type { SessionEvent } from "@tiller/protocol";
import { atomicWrite } from "./storage.js";

export interface Notification {
  id: string;
  userId: string;
  kind: "approval" | "handoff" | "contention" | "done" | "blocked";
  title: string;
  body: string;
  /** Deep link understood by every shell: tiller://p/<project>/s/<session> */
  link: string;
  at: number;
  read: boolean;
}

export interface PushSubscription {
  userId: string;
  platform: "web" | "ios" | "android" | "desktop";
  /** Web push subscription JSON or a native device token. */
  token: string;
  endpoint?: string;
}

export type Sender = (sub: PushSubscription, n: Notification) => Promise<void>;

export class Notifier {
  private readonly inbox = new Map<string, Notification[]>();
  private readonly subs: PushSubscription[] = [];
  private readonly path: string;
  private counter = 0;

  constructor(
    root: string,
    private readonly sender: Sender | null = null,
    private readonly log: (line: string) => void = () => {},
  ) {
    this.path = join(root, "push.json");
    if (existsSync(this.path)) {
      try {
        const data = JSON.parse(readFileSync(this.path, "utf8")) as { subs: PushSubscription[] };
        this.subs.push(...data.subs);
      } catch {
        /* start empty */
      }
    }
  }

  subscribe(sub: PushSubscription): void {
    const i = this.subs.findIndex(
      (s) => s.userId === sub.userId && s.platform === sub.platform && s.token === sub.token,
    );
    if (i >= 0) this.subs[i] = sub;
    else this.subs.push(sub);
    atomicWrite(this.path, JSON.stringify({ subs: this.subs }));
  }

  subscriptions(userId: string): PushSubscription[] {
    return this.subs.filter((s) => s.userId === userId);
  }

  list(userId: string, unreadOnly = false): Notification[] {
    return (this.inbox.get(userId) ?? []).filter((n) => !unreadOnly || !n.read);
  }

  markRead(userId: string, ids: string[]): void {
    for (const n of this.inbox.get(userId) ?? []) if (ids.includes(n.id)) n.read = true;
  }

  notify(userId: string, n: Omit<Notification, "id" | "userId" | "at" | "read">): Notification {
    this.counter += 1;
    const full: Notification = {
      id: `n${Date.now()}_${this.counter}`,
      userId,
      at: Date.now(),
      read: false,
      ...n,
    };
    const box = this.inbox.get(userId) ?? [];
    box.push(full);
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
  ): void {
    const link = `tiller://p/${projectId}/s/${sessionId}`;
    const humans = participants.filter((p) => p.kind === "human");
    const actorName = humans.find((p) => p.id === e.actor)?.name ?? e.actor;
    switch (e.kind) {
      case "approval.requested": {
        const eligible = humans.filter((p) => p.role !== "observer");
        for (const p of eligible)
          this.notify(p.id, {
            kind: "approval",
            title: "Approval needed",
            body: `${e.payload.call.name} [${e.payload.call.risk}] in ${sessionId}`,
            link,
          });
        break;
      }
      case "handoff.requested":
        this.notify(e.payload.to, {
          kind: "handoff",
          title: "You are offered the driver seat",
          body: `${actorName} wants to hand off ${sessionId}`,
          link,
        });
        break;
      case "fleet.contention.mirrored":
        if (!e.payload.resolved)
          for (const p of humans.filter((p) => p.role === "owner" || p.isDriver))
            this.notify(p.id, {
              kind: "contention",
              title: "Fleet contention",
              body: `${e.payload.kind} on ${e.payload.resource}`,
              link,
            });
        break;
      case "workspace.blocked":
        for (const p of humans.filter((p) => p.role === "owner" || p.isDriver))
          this.notify(p.id, {
            kind: "blocked",
            title: "Write refused",
            body: `${e.payload.path} is held by ${e.payload.holderSessionId}`,
            link,
          });
        break;
      case "agent.turn.ended":
        if (e.payload.summary.startsWith("DONE"))
          for (const p of humans.filter((p) => p.role === "owner" || p.isDriver))
            this.notify(p.id, {
              kind: "done",
              title: "Agent finished",
              body: e.payload.summary.slice(5, 160),
              link,
            });
        break;
      default:
        break;
    }
  }

  onProjectEvent(projectId: string, e: ProjectEvent, leads: string[]): void {
    if (e.kind !== "fleet.contention.opened") return;
    for (const lead of leads)
      this.notify(lead, {
        kind: "contention",
        title: "Fleet contention",
        body: `${e.payload.kind} on ${e.payload.resource}: ${e.payload.detail.slice(0, 140)}`,
        link: `tiller://p/${projectId}`,
      });
  }
}
