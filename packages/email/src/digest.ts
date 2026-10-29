/**
 * The digest service: computes each lead's digest from the server's live state and sends it
 * through a `Mailer`. The ledger keeps no wall clock, so "this week" is "since the last
 * digest": a cursor per recipient and team (the seq and the tokens of every session at the
 * previous send, persisted in the store's `digests` document) is what the period's figures
 * are counted from. The first digest covers everything so far and says so in its range.
 *
 * The schedule (Monday 08:00, or every working day) belongs to whoever runs the server;
 * `sendAll` is the one call it makes. Nothing here touches the network: the mailer does.
 */
import {
  compactTokens,
  describeRule,
  isRatingsRule,
  minimumRank,
  type PlanRecord,
  planActualTokens,
  rankOf,
  ratingSummary,
  ruleFor,
  type SessionState,
} from "@henosis/kernel";
import { usageTotal } from "@henosis/protocol";
import { describeCall, type HenosisServer, type ProjectHost } from "@henosis/server";
import type { Email, Mailer, Sent } from "./mailer.js";
import {
  type Bar,
  type DigestInput,
  digest,
  type GateRow,
  type NeedCard,
  type PlanRow,
  type RenderedEmail,
} from "./templates.js";

export interface EmailDigestOptions {
  server: HenosisServer;
  mailer: Mailer;
  /** The sender: "Henosis <digest@henosis.app>". */
  from: string;
  /** Where the web app is served; the buttons then open the queue, the session, the overview. */
  appBaseUrl?: string | undefined;
  cadence?: "daily" | "weekly";
  now?: () => Date;
  log?: (line: string) => void;
}

export interface Recipient {
  userId: string;
  name: string;
  email: string;
  teamId: string;
  teamName: string;
}

interface SessionMark {
  seq: number;
  input: number;
  output: number;
}

interface Cursor {
  /** When the previous digest went out, ms since the epoch. */
  at: number;
  sessions: Record<string, SessionMark>;
}

interface DigestsDoc {
  sent: Record<string, Cursor>;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "29 Sep" in UTC. */
export function shortDate(d: Date): string {
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "Mon 6 Oct, 08:00" in UTC. */
export function stamp(d: Date): string {
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${DAYS[d.getUTCDay()]} ${shortDate(d)}, ${hh}:${mm}`;
}

/** The web app URL for a client route under the base, or null without a base. */
export function appUrl(base: string | undefined, route: string): string | null {
  const b = base
    ?.trim()
    .replace(/\/?#.*$/, "")
    .replace(/\/+$/, "");
  return b ? `${b}/${route}` : null;
}

const cap = (s: string) => (s ? s[0]?.toUpperCase() + s.slice(1) : s);

export class EmailDigest {
  constructor(private readonly opts: EmailDigestOptions) {}

  private get now(): Date {
    return (this.opts.now ?? (() => new Date()))();
  }

  /** Every lead or manager of a team with an e-mail address, once per team they lead. */
  recipients(): Recipient[] {
    const out: Recipient[] = [];
    for (const u of this.opts.server.orgs.users.values()) {
      if (!u.email) continue;
      for (const t of u.teams) {
        if (t.role !== "lead" && t.role !== "manager") continue;
        const found = this.opts.server.orgs.team(t.teamId);
        if (!found) continue;
        out.push({
          userId: u.id,
          name: u.name,
          email: u.email,
          teamId: t.teamId,
          teamName: found.team.name,
        });
      }
    }
    return out;
  }

  private readDoc(): DigestsDoc {
    try {
      const doc = this.opts.server.store.readDoc("digests") as Partial<DigestsDoc> | null;
      return { sent: doc?.sent ?? {} };
    } catch {
      return { sent: {} };
    }
  }

  private cursorOf(userId: string, teamId: string): Cursor | null {
    return this.readDoc().sent[`${userId}:${teamId}`] ?? null;
  }

  private hostsOf(teamId: string): ProjectHost[] {
    const found = this.opts.server.orgs.team(teamId);
    if (!found) return [];
    return found.team.projects.map((p) => this.opts.server.project(p.id));
  }

  private nameOf(host: ProjectHost, userId: string | null): string {
    if (!userId) return "someone";
    return host.state().members[userId]?.name ?? this.opts.server.orgs.user(userId)?.name ?? userId;
  }

  /** The digest's data for one lead and team, counted from the cursor of the last send. */
  input(userId: string, teamId: string, now: Date = this.now): DigestInput {
    const server = this.opts.server;
    const base = this.opts.appBaseUrl;
    const cadence = this.opts.cadence ?? "weekly";
    const found = server.orgs.team(teamId);
    const teamName = found?.team.name ?? teamId;
    const lead = server.orgs.user(userId)?.name ?? userId;
    const cursor = this.cursorOf(userId, teamId);
    const sinceOf = (sid: string) => cursor?.sessions[sid]?.seq ?? -1;
    const counts = new Map<string, number>();
    const needs: NeedCard[] = [];
    const plans: PlanRow[] = [];
    const gates: GateRow[] = [];
    const joined: string[] = [];
    const byProject = new Map<string, Bar>();
    const byPerson = new Map<string, Bar>();
    const period = { tokens: 0, input: 0, output: 0, plansRated: 0, gates: 0 };
    let estDone = 0;
    let actualDone = 0;
    let open = 0;
    const projectsOpen = new Set<string>();
    let budgetPick: DigestInput["tokens"]["budget"] = null;
    let top: { session: string; owner: string; tokens: number; project: string } | null = null;

    for (const host of this.hostsOf(teamId)) {
      const pst = host.state();
      const project = pst.name || host.projectId;
      const states = host.sessionStates();
      const sessions = Object.values(pst.sessions)
        .filter((s) => s.open)
        .sort((a, b) => a.registeredSeq - b.registeredSeq);
      let used = 0;
      let budget = 0;
      for (const s of sessions) {
        const live: SessionState | undefined = states[s.sessionId];
        const status = live?.status ?? s.report?.status ?? "unknown";
        counts.set(status, (counts.get(status) ?? 0) + 1);
        open += 1;
        projectsOpen.add(host.projectId);
        const owner = this.nameOf(host, s.ownerId);
        const agent = `${owner}'s agent`;
        const url = appUrl(base, `#/p/${enc(host.projectId)}/s/${enc(s.sessionId)}`);
        const since = sinceOf(s.sessionId);
        const mark = cursor?.sessions[s.sessionId];
        const usage = live?.usage ?? s.report?.usage;
        const dIn = Math.max(0, (usage?.input ?? 0) - (mark?.input ?? 0));
        const dOut = Math.max(0, (usage?.output ?? 0) - (mark?.output ?? 0));
        period.input += dIn;
        period.output += dOut;
        period.tokens += dIn + dOut;
        used += usageTotal(usage);
        budget += live?.policy.tokenBudget ?? 0;
        bump(byProject, project, dIn + dOut);
        bump(byPerson, owner, dIn + dOut, "agent");
        if (!top || dIn + dOut > top.tokens)
          top = { session: s.title, owner, tokens: dIn + dOut, project };
        if (!live) continue;
        const name = (id: string) => live.participants[id]?.actor.name ?? this.nameOf(host, id);

        for (const a of Object.values(live.approvals)) {
          const rule = ruleFor(live.policy.approvals, a.call.risk);
          const ratings = isRatingsRule(rule);
          const min = minimumRank(rule);
          const eligible = Object.entries(a.ballots).filter(
            ([id, b]) => b.vote === "approve" && rankOf(live, id) >= min,
          );
          const rated = eligible.filter(([, b]) => b.rating !== null);
          const have = (ratings ? rated : eligible).map(([id]) => name(id));
          const needed = ratings ? rule.ratings.min : typeof rule === "string" ? 1 : rule.quorum;
          const so = Object.entries(a.ballots)
            .map(([id, b]) =>
              b.vote === "deny"
                ? `${name(id)} denied`
                : b.rating !== null
                  ? `${name(id)} rated ${b.rating}`
                  : `${name(id)} approved`,
            )
            .join(", ");
          const call = describeCall(a.call);
          if (a.status === "pending") {
            const left = Math.max(0, needed - have.length);
            needs.push({
              kind: "gate",
              label: ratings ? `Release gate · ${a.call.risk}` : `Approval · ${a.call.risk}`,
              lead: `${agent} wants to`,
              thing: call.what,
              tail: ` in ${project}.`,
              rule: `Rule: ${describeRule(rule)}. ${so ? `${so}; ` : ""}${
                left === 0
                  ? "the votes are in."
                  : `waiting on ${left === 1 ? "one more vote" : `${left} more votes`}.`
              }`,
              votes: { have, needed },
              age: null,
              action: { label: ratings ? "Rate and vote" : "Vote", url, primary: true },
            });
          }
          if (ratings && (a.status === "pending" || a.requestedSeq > since)) {
            period.gates += 1;
            gates.push({
              title: cap(call.what),
              context: `${agent} · rule ${rule.ratings.min} at ${rule.ratings.average}+${so ? ` · ${so}` : ""}`,
              have,
              needed,
              status: a.status === "pending" ? "waiting" : a.status,
            });
          }
        }

        for (const p of Object.values(live.plans)) {
          const { count, average } = ratingSummary(p);
          const ratedInRange = Object.values(p.ratings).filter((r) => r.seq > since).length;
          if (ratedInRange) period.plansRated += 1;
          for (const st of p.steps)
            if (st.status === "done") {
              estDone += st.estTokens;
              actualDone += st.actualTokens;
            }
          if (p.status === "proposed") {
            const min = live.policy.planApproval.min;
            const left = Math.max(0, min - count);
            const so = Object.entries(p.ratings)
              .map(([id, r]) => `${name(id)} rated ${r.rating}`)
              .join(", ");
            needs.push({
              kind: "plan",
              label: "Plan · waiting on ratings",
              lead: `${agent} plans`,
              thing: p.goal || s.title,
              tail: ` in ${project}.`,
              rule: `Policy: ${min === 1 ? "one rating" : `${min} ratings`} at ${live.policy.planApproval.average}+. ${
                so ? `${so}; ` : "No rating yet; "
              }${left === 1 ? "one more voice and it starts." : left === 0 ? "it starts on the next turn." : `${left} more voices and it starts.`} Est. ${compactTokens(p.estTokens)} tokens.`,
              votes: { have: Object.keys(p.ratings).map(name), needed: min },
              age: null,
              action: { label: "Rate the plan", url, primary: true },
            });
          }
          if (p.supersededBy && count === 0) continue;
          if (p.proposedSeq <= since && !ratedInRange && p.status !== "proposed") continue;
          const actual = planActualTokens(p);
          const row: PlanRow = {
            title: p.goal || s.title,
            context: `${agent} · ${project}`,
            ratings: count,
            average: count ? average : null,
            est: p.estTokens,
            actual: actual || null,
            status: planStatus(p),
          };
          if (p.status === "revise")
            row.note = `asked to revise${p.decidedBy && p.decidedBy !== "policy" ? ` by ${name(p.decidedBy)}` : ""}`;
          plans.push(row);
        }

        // The join moment: who came into the circle since the last digest.
        const joins = (host.hosts.get(s.sessionId)?.session.events() ?? []).filter(
          (e) => e.kind === "participant.joined" && e.seq > since,
        );
        const people = joins
          .filter((e) => e.kind === "participant.joined" && e.payload.actor.kind === "human")
          .map((e) => (e.kind === "participant.joined" ? e.payload.actor.name : ""))
          .filter((n) => n && n !== owner);
        const agentJoined = joins.some(
          (e) => e.kind === "participant.joined" && e.payload.actor.kind === "agent",
        );
        if (people.length) {
          const crewOwners = s.crew
            ? sessions
                .filter((x) => x.crew === s.crew)
                .map((x) => this.nameOf(host, x.ownerId))
                .join(" + ")
            : null;
          joined.push(
            `${people.join(" and ")} joined ${s.title}${agentJoined ? ` with ${owner}'s agent` : ""}${
              s.crew && crewOwners ? ` · crew ${s.crew} is ${crewOwners}` : ""
            }`,
          );
        }
      }
      if (budget > 0 && (!budgetPick || used / budget > budgetPick.used / budgetPick.budget))
        budgetPick = { used, budget, label: project };
      for (const c of Object.values(pst.contentions).filter((c) => !c.resolved)) {
        const owners = c.sessionIds.map(
          (id) => `${this.nameOf(host, pst.sessions[id]?.ownerId ?? null)}'s agent`,
        );
        needs.push({
          kind: "contention",
          label: `Contention · ${c.kind.replace(/-/g, " ")}`,
          lead: `${owners.join(" and ")} both claim`,
          thing: c.resource,
          tail: ` in ${project}.`,
          rule: `${c.detail} Both owners were told; the lead resolves.`,
          votes: null,
          age: "blocked",
          action: {
            label: "Resolve",
            url: appUrl(base, `#/p/${enc(host.projectId)}`),
            primary: false,
          },
        });
      }
    }

    const projectsCount = projectsOpen.size || (found?.team.projects.length ?? 0);
    const countsText = [...counts].map(([k, v]) => `${v} ${k.replace(/_/g, " ")}`).join(", ");
    const budgetPct = budgetPick ? Math.round((budgetPick.used / budgetPick.budget) * 100) : null;
    const readingParts: string[] = [];
    if (top && top.tokens > 0 && period.tokens > 0)
      readingParts.push(
        `${top.project} took ${Math.round(((byProject.get(top.project)?.value ?? 0) / period.tokens) * 100)}% of the tokens, most of it ${top.session} (${top.owner}'s agent, ${compactTokens(top.tokens)}).`,
      );
    if (budgetPick && budgetPct !== null)
      readingParts.push(`${budgetPick.label} is at ${budgetPct}% of its budget.`);
    readingParts.push("Cache reads are not counted.");
    const range = cursor ? `${shortDate(new Date(cursor.at))} – ${shortDate(now)}` : "so far";
    const sinceLabel = cursor ? range : "since the sessions opened";
    return {
      team: teamName,
      lead,
      range: sinceLabel,
      cadence,
      sentAt: stamp(now),
      summary: { open, projects: projectsCount, counts: countsText, needs: needs.length },
      period,
      needs,
      tokens: {
        againstPlans: estDone > 0 ? Math.round(((actualDone - estDone) / estDone) * 100) : null,
        budget: budgetPick,
        byProject: [...byProject.values()].sort((a, b) => b.value - a.value),
        byPerson: [...byPerson.values()].sort((a, b) => b.value - a.value),
        reading: readingParts.join(" "),
      },
      plans,
      gates,
      joined,
      urls: {
        overview: appUrl(base, `#/m/${enc(teamId)}`),
        queue: appUrl(base, "#/approvals"),
        usage: appUrl(base, `#/m/${enc(teamId)}`),
        settings: appUrl(base, "#/settings"),
      },
    };
  }

  render(userId: string, teamId: string, now?: Date): RenderedEmail {
    return digest(this.input(userId, teamId, now));
  }

  /** Send one lead's digest and move the cursor so the next one counts from here. */
  async send(r: Recipient, now: Date = this.now): Promise<Sent> {
    const rendered = this.render(r.userId, r.teamId, now);
    const email: Email = {
      from: this.opts.from,
      to: [`${r.name} <${r.email}>`],
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      headers: { "X-Henosis-Digest": `${r.teamId}; ${this.opts.cadence ?? "weekly"}` },
    };
    const sent = await this.opts.mailer.send(email);
    this.advance(r.userId, r.teamId, now);
    return sent;
  }

  /** One digest per lead per team; a failed send is logged and does not stop the others. */
  async sendAll(now: Date = this.now): Promise<{ recipient: Recipient; sent: Sent | null }[]> {
    const out: { recipient: Recipient; sent: Sent | null }[] = [];
    for (const r of this.recipients()) {
      try {
        out.push({ recipient: r, sent: await this.send(r, now) });
      } catch (err) {
        this.opts.log?.(
          `digest to ${r.email} failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        out.push({ recipient: r, sent: null });
      }
    }
    return out;
  }

  private advance(userId: string, teamId: string, now: Date): void {
    const doc = this.readDoc();
    const sessions: Record<string, SessionMark> = {};
    for (const host of this.hostsOf(teamId))
      for (const [sid, st] of Object.entries(host.sessionStates()))
        sessions[sid] = { seq: st.seq, input: st.usage.input, output: st.usage.output };
    doc.sent[`${userId}:${teamId}`] = { at: now.getTime(), sessions };
    this.opts.server.store.writeDoc("digests", doc);
  }
}

const enc = encodeURIComponent;

function bump(map: Map<string, Bar>, label: string, value: number, unit?: string): void {
  const cur = map.get(label);
  if (cur) {
    cur.value += value;
    if (unit) {
      const n = Number(cur.sub?.split(" ")[0] ?? 1) + 1;
      cur.sub = `${n} ${unit}s`;
    }
  } else map.set(label, { label, value });
}

function planStatus(p: PlanRecord): PlanRow["status"] {
  switch (p.status) {
    case "proposed":
      return "waiting";
    case "approved":
      return "approved";
    case "done":
      return "done";
    case "revise":
      return "revised";
    default:
      return "rejected";
  }
}
