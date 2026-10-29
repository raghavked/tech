/**
 * The e-mails (email-digest, surfaces panel 8.25 keep): the Monday digest is the manager
 * overview folded into one message in the order a lead reads it, and the invite is the join
 * moment on paper. Both follow the rules every surface outside the window shares: the team
 * sentence first (`copy.team.summary`, with the week's figures appended), the five-part
 * anatomy (emblem · product name · sentence · context line · actions, the link last), the
 * needs-you card with a stripe by kind, votes as rows, `est 44k → 61k, +38%`.
 *
 * A real e-mail needs inline styles, table layout and font fallbacks (Georgia for the serif,
 * the system sans, Menlo for mono), so the HTML here is tables with the tokens' light values
 * written in; a client that inverts does so on its own. The text part carries the whole
 * message, so a plain reader loses nothing but the stripes.
 *
 * Pure: every function takes plain data and returns `{ subject, preheader, text, html }`.
 */
import { compactTokens, describeEstimate, starsWithNumber } from "@henosis/kernel";

export interface RenderedEmail {
  subject: string;
  /** The inbox row's second line: the four counts. */
  preheader: string;
  text: string;
  html: string;
}

export type NeedKind = "plan" | "gate" | "contention";

/** The needs-you card: stripe by kind, a kind label, the thing in italic, the rule, the votes, one button. */
export interface NeedCard {
  kind: NeedKind;
  /** "Plan · waiting on ratings", "Release gate · irreversible", "Contention · claim denied". */
  label: string;
  /** "Bo's agent plans", "Cy's agent wants to", "Dee's agent and Cy's agent both claim". */
  lead: string;
  /** The thing, set in italic: "Proration on plan change". */
  thing: string;
  /** " in Billing page." (with its own punctuation). */
  tail: string;
  /** The rule in one sentence: "Policy: two ratings at 3+. Dee rated 4; one more voice and it starts." */
  rule: string;
  /** Who has voted (initials or names) against how many are needed; null for a contention. */
  votes: { have: string[]; needed: number } | null;
  /** "blocked 3 days", shown in red in place of the votes on a contention. */
  age: string | null;
  action: { label: string; url: string | null; primary: boolean };
}

export interface Bar {
  label: string;
  /** "2 agents", in small type after the label. */
  sub?: string;
  value: number;
  /** A dashed tick on the track at this value, for a soft budget. */
  budget?: number;
}

export interface PlanRow {
  title: string;
  /** "Bo's agent · Billing page" */
  context: string;
  ratings: number;
  average: number | null;
  est: number;
  actual: number | null;
  status: "done" | "approved" | "revised" | "waiting" | "rejected";
  /** Replaces the estimate reading when set: "asked to revise by Ana, new plan rated 4.5". */
  note?: string;
}

export interface GateRow {
  title: string;
  /** "Bo's agent · rule 2 at 4+ · Dee 4, Cy 5 · granted Thu 11:20, waited 2h 10m" */
  context: string;
  have: string[];
  needed: number;
  status: "granted" | "waiting" | "denied";
}

export interface DigestInput {
  team: string;
  lead: string;
  /** "29 Sep – 5 Oct", or "since Monday's digest". */
  range: string;
  cadence: "daily" | "weekly";
  /** "Mon 6 Oct, 08:00" */
  sentAt: string;
  summary: { open: number; projects: number; counts: string; needs: number };
  /** The period's figures, appended to the sentence. */
  period: { tokens: number; input: number; output: number; plansRated: number; gates: number };
  needs: NeedCard[];
  tokens: {
    /** Percent against the plans' estimates (negative = under); null without finished steps. */
    againstPlans: number | null;
    budget: { used: number; budget: number; label: string } | null;
    byProject: Bar[];
    byPerson: Bar[];
    reading: string;
  };
  plans: PlanRow[];
  gates: GateRow[];
  /** The join moment: "Cy joined Monday with her agent · crew Invoice rollout is Ana + Cy". */
  joined: string[];
  urls: {
    overview: string | null;
    queue: string | null;
    usage: string | null;
    settings: string | null;
  };
}

// ---- words -----------------------------------------------------------------------------

export const PRODUCT = "Henosis";
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The sentence the team page and every off-platform surface open with (copy.team.summary). */
export function teamSummary(open: number, projects: number, counts: string, needs: number) {
  return `${plural(open, "open session")} across ${plural(projects, "project")}${counts ? `: ${counts}` : ""}. ${
    needs === 0
      ? "Nothing needs you right now."
      : `${plural(needs, "thing")} need${needs === 1 ? "s" : ""} you.`
  }`;
}

/** "3 things need you" / "nothing needs you": the subject's verdict. */
export function needsClause(n: number): string {
  return n === 0 ? "nothing needs you" : `${plural(n, "thing")} need${n === 1 ? "s" : ""} you`;
}

/** "This week the team spent 212k tokens, rated 7 plans and held 2 release gates." */
export function periodSentence(cadence: DigestInput["cadence"], p: DigestInput["period"]) {
  const lead = cadence === "daily" ? "Today" : "This week";
  return `${lead} the team spent ${compactTokens(p.tokens)} tokens, rated ${plural(p.plansRated, "plan")} and held ${plural(p.gates, "release gate")}.`;
}

export function digestSubject(i: Pick<DigestInput, "team" | "cadence" | "summary">): string {
  return `${i.team} ${i.cadence === "daily" ? "today" : "this week"}: ${needsClause(i.summary.needs)}`;
}

export function digestPreheader(i: Pick<DigestInput, "summary" | "period">): string {
  return [
    plural(i.summary.open, "open session"),
    `${compactTokens(i.period.tokens)} tokens`,
    `${plural(i.period.plansRated, "plan")} rated`,
    plural(i.period.gates, "release gate"),
  ].join(" · ");
}

/** "2 gates · 1 granted · 1 waiting" (the judge's fix for "2 held · 1 granted"). */
export function gatesCount(gates: GateRow[]): string {
  const by = (s: GateRow["status"]) => gates.filter((g) => g.status === s).length;
  const parts = [plural(gates.length, "gate")];
  if (by("granted")) parts.push(`${by("granted")} granted`);
  if (by("waiting")) parts.push(`${by("waiting")} waiting`);
  if (by("denied")) parts.push(`${by("denied")} denied`);
  return parts.join(" · ");
}

export function plansCount(plans: PlanRow[]): string {
  const by = (s: PlanRow["status"]) => plans.filter((p) => p.status === s).length;
  const rated = plans.filter((p) => p.ratings > 0).length;
  const parts = [`${rated} rated`];
  const approved = by("approved") + by("done");
  if (approved) parts.push(`${approved} approved`);
  if (by("revised")) parts.push(`${by("revised")} revised`);
  if (by("rejected")) parts.push(`${by("rejected")} rejected`);
  if (by("waiting")) parts.push(`${by("waiting")} waiting`);
  return parts.join(" · ");
}

/** "D · C · 1 of 2" as words for the text part; the HTML draws discs. */
function votesWords(v: { have: string[]; needed: number }): string {
  return `${v.have.length} of ${v.needed}${v.have.length ? ` (${v.have.join(", ")})` : ""}`;
}

// ---- the colours an e-mail client gets (tokens.css, light) ----------------------------------

const C = {
  canvas: "#FBF7F1",
  surface: "#FFFFFF",
  surface2: "#F4EEE5",
  surface3: "#ECE3D6",
  ink: "#1F2634",
  ink2: "#5B6273",
  ink3: "#8E94A3",
  line: "#E3DCD2",
  rail: "#2A3244",
  railFg: "#F3EDE4",
  railMuted: "#AEB4C2",
  accent: "#56352D",
  accentFg: "#FFF8F1",
  apricot: "#E2C4A6",
  apricotDeep: "#CFA782",
  apricotSoft: "#F6EADC",
  ok: "#3F6A3B",
  okSoft: "#E6EEE3",
  warn: "#7F5320",
  warnSoft: "#F3E8D8",
  danger: "#8A3A30",
  dangerSoft: "#F3E0DD",
};
const SANS = "'Instrument Sans', -apple-system, 'Segoe UI', system-ui, sans-serif";
const SERIF = "'Instrument Serif', 'Iowan Old Style', Georgia, serif";
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
const h = escapeHtml;
const mono = (s: string) =>
  `<span style="font-family:${MONO};font-size:13px;font-variant-numeric:tabular-nums">${h(s)}</span>`;
const serifI = (s: string) => `<i style="font-family:${SERIF};font-style:italic">${h(s)}</i>`;

/** The mark at e-mail size: the disc variant (navy disc, apricot centre), drawn with cells. */
function emblem(size = 24): string {
  const dot = Math.round(size / 4);
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate"><tr><td align="center" valign="middle" width="${size}" height="${size}" style="width:${size}px;height:${size}px;border-radius:${size}px;background:${C.rail};line-height:0"><span style="display:inline-block;width:${dot}px;height:${dot}px;border-radius:${dot}px;background:${C.apricot}">&nbsp;</span></td></tr></table>`;
}

function button(label: string, url: string | null, primary: boolean): string {
  const style = primary
    ? `background:${C.accent};color:${C.accentFg};`
    : `background:${C.surface2};color:${C.ink};border:1px solid ${C.line};`;
  const inner = `<span style="display:inline-block;padding:8px 14px;border-radius:999px;font:600 13px ${SANS};${style}text-decoration:none">${h(label)}</span>`;
  return url ? `<a href="${h(url)}" style="text-decoration:none">${inner}</a>` : inner;
}

function link(label: string, url: string | null): string {
  return url
    ? `<a href="${h(url)}" style="color:${C.accent};text-decoration:none">${h(label)}</a>`
    : `<span style="color:${C.ink2}">${h(label)}</span>`;
}

function stripeOf(kind: NeedKind): string {
  if (kind === "plan") return `background:${C.apricot};`;
  if (kind === "contention") return `background:${C.danger};`;
  return `background:${C.accent};background-image:linear-gradient(180deg,${C.rail},${C.accent});`;
}

/** Vote discs: initials on apricot, a dashed empty disc for each missing voice, "1 of 2". */
function voteDots(v: { have: string[]; needed: number }): string {
  const disc = (s: string) =>
    `<td style="padding:0 2px 0 0"><span style="display:inline-block;width:22px;height:22px;border-radius:22px;background:${C.apricot};color:${C.accent};font:600 10px/22px ${SANS};text-align:center">${h(s)}</span></td>`;
  const empty = `<td style="padding:0 2px 0 0"><span style="display:inline-block;width:20px;height:20px;border-radius:22px;border:1px dashed ${C.ink3}">&nbsp;</span></td>`;
  const missing = Math.max(0, v.needed - v.have.length);
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr>${v.have
    .map((s) => disc(s.slice(0, 1).toUpperCase()))
    .join(
      "",
    )}${empty.repeat(missing)}<td style="padding-left:6px;font:12px ${MONO};color:${C.ink2}">${v.have.length} of ${v.needed}</td></tr></table>`;
}

function tag(text: string, tone: "ok" | "warn" | "danger" | "soft"): string {
  const bg =
    tone === "ok"
      ? C.okSoft
      : tone === "warn"
        ? C.warnSoft
        : tone === "danger"
          ? C.dangerSoft
          : C.surface3;
  const fg =
    tone === "ok" ? C.ok : tone === "warn" ? C.warn : tone === "danger" ? C.danger : C.ink2;
  return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:${bg};color:${fg};font:600 11px ${SANS}">${h(text)}</span>`;
}

function barRow(b: Bar, max: number): string {
  const pct = max > 0 ? Math.round((b.value / max) * 100) : 0;
  const tick =
    b.budget !== undefined && max > 0
      ? `<td width="${Math.max(0, Math.min(100, Math.round((b.budget / max) * 100)))}%" style="border-right:2px dashed ${C.accent};height:8px;line-height:0;font-size:0">&nbsp;</td><td>&nbsp;</td>`
      : "";
  return `<tr><td style="padding:4px 10px 4px 0;font:13px ${SANS};color:${C.ink};white-space:nowrap">${h(b.label)}${b.sub ? ` <span style="color:${C.ink3};font-size:12px">${h(b.sub)}</span>` : ""}</td><td width="100%" style="padding:4px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="${pct}%" style="background:${C.apricot};height:8px;border-radius:4px;line-height:0;font-size:0">&nbsp;</td><td style="font-size:0;line-height:0">&nbsp;</td></tr>${tick ? `<tr><td colspan="2" style="padding:0;line-height:0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${tick}</tr></table></td></tr>` : ""}</table></td><td style="padding:4px 0 4px 10px;text-align:right">${mono(compactTokens(b.value))}</td></tr>`;
}

function section(title: string, count: string, action: string, body: string): string {
  return `<tr><td style="padding:22px 34px 6px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="font:400 20px ${SERIF};color:${C.ink}">${h(title)} <span style="font:12px ${MONO};color:${C.ink3}">${h(count)}</span></td><td align="right" style="font:13px ${SANS}">${action}</td></tr></table></td></tr><tr><td style="padding:0 34px">${body}</td></tr>`;
}

// ---- the digest ---------------------------------------------------------------------------

function needCardHtml(n: NeedCard): string {
  const right = n.age && !n.votes ? tag(n.age, "danger") : n.votes ? voteDots(n.votes) : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;border:1px solid ${C.line};border-radius:12px;border-collapse:separate;background:${C.surface}"><tr><td width="5" style="width:5px;border-radius:12px 0 0 12px;${stripeOf(n.kind)}">&nbsp;</td><td style="padding:14px 16px"><div style="font:600 11px ${SANS};letter-spacing:.06em;text-transform:uppercase;color:${C.ink2}">${h(n.label)}</div><div style="padding:4px 0 2px;font:400 18px ${SERIF};color:${C.ink}">${h(n.lead)} ${serifI(n.thing)}${h(n.tail)}</div><div style="font:13px/1.5 ${SANS};color:${C.ink2}">${h(n.rule)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px"><tr><td>${right}</td><td align="right">${button(n.action.label, n.action.url, n.action.primary)}</td></tr></table></td></tr></table>`;
}

function planRowHtml(p: PlanRow): string {
  const reading = p.note ? h(p.note) : estimateHtml(p.est, p.actual);
  const tone =
    p.status === "done" || p.status === "approved"
      ? "ok"
      : p.status === "revised"
        ? "warn"
        : p.status === "rejected"
          ? "danger"
          : "soft";
  return `<tr><td style="padding:10px 0;border-top:1px solid ${C.line}"><div style="font:400 16px ${SERIF};color:${C.ink}">${h(p.title)}</div><div style="font:12.5px ${SANS};color:${C.ink2}">${h(p.context)} · ${plural(p.ratings, "rating")} · ${reading}</div></td><td style="padding:10px 8px;border-top:1px solid ${C.line};white-space:nowrap">${p.average !== null ? mono(starsWithNumber(p.average)) : ""}</td><td align="right" style="padding:10px 0;border-top:1px solid ${C.line}">${tag(p.status, tone)}</td></tr>`;
}

function estimateHtml(est: number, actual: number | null): string {
  const r = describeEstimate(est, actual);
  const colour = r.tone === "over" ? C.warn : r.tone === "under" ? C.ok : C.ink2;
  return `<span style="font-family:${MONO};font-size:12.5px;color:${colour}">${h(r.text)}</span>`;
}

function gateRowHtml(g: GateRow): string {
  const tone = g.status === "granted" ? "ok" : g.status === "waiting" ? "warn" : "danger";
  return `<tr><td style="padding:10px 0;border-top:1px solid ${C.line}"><div style="font:400 16px ${SERIF};color:${C.ink}">${h(g.title)}</div><div style="font:12.5px ${SANS};color:${C.ink2}">${h(g.context)}</div></td><td style="padding:10px 8px;border-top:1px solid ${C.line}">${voteDots({ have: g.have, needed: g.needed })}</td><td align="right" style="padding:10px 0;border-top:1px solid ${C.line}">${tag(g.status, tone)}</td></tr>`;
}

function tile(label: string, value: string, detail: string): string {
  return `<td width="33%" style="padding:0 6px 0 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.line};border-radius:12px;border-collapse:separate"><tr><td style="padding:12px 14px"><div style="font:600 11px ${SANS};letter-spacing:.06em;text-transform:uppercase;color:${C.ink2}">${h(label)}</div><div style="padding:2px 0;font:500 22px ${MONO};color:${C.ink}">${h(value)}</div><div style="font:12px ${SANS};color:${C.ink2}">${h(detail)}</div></td></tr></table></td>`;
}

/** The digest, light from the tokens' values; the text part is the same message in lines. */
export function digest(i: DigestInput): RenderedEmail {
  const subject = digestSubject(i);
  const preheader = digestPreheader(i);
  const summary = teamSummary(
    i.summary.open,
    i.summary.projects,
    i.summary.counts,
    i.summary.needs,
  );
  const period = periodSentence(i.cadence, i.period);
  const cadence = i.cadence === "daily" ? "every working day at 08:00" : "every Monday at 08:00";

  // ---- text ----
  const t: string[] = [];
  t.push(`${PRODUCT} · ${i.team} · ${i.range}`);
  t.push("");
  t.push(`${summary} ${period}`);
  if (i.joined.length) {
    t.push("");
    for (const j of i.joined) t.push(`Joined: ${j}`);
  }
  t.push("");
  t.push(
    `NEEDS YOU · ${i.needs.length}${i.urls.queue ? ` · Open the queue: ${i.urls.queue}` : ""}`,
  );
  if (!i.needs.length) t.push("Nothing needs you right now.");
  for (const n of i.needs) {
    t.push("");
    t.push(`[${n.label}] ${n.lead} "${n.thing}"${n.tail}`);
    t.push(`  ${n.rule}`);
    const state = n.votes ? votesWords(n.votes) : (n.age ?? "");
    t.push(
      `  ${state ? `${state} · ` : ""}${n.action.label}${n.action.url ? `: ${n.action.url}` : ""}`,
    );
  }
  t.push("");
  t.push(
    `TOKENS · ${compactTokens(i.period.tokens)} ${i.cadence === "daily" ? "today" : "this week"}${i.urls.usage ? ` · Usage: ${i.urls.usage}` : ""}`,
  );
  t.push(
    `Spent ${compactTokens(i.period.tokens)} (${compactTokens(i.period.input)} in · ${compactTokens(i.period.output)} out)` +
      (i.tokens.againstPlans !== null
        ? ` · Against plans ${i.tokens.againstPlans > 0 ? "+" : ""}${i.tokens.againstPlans}%`
        : "") +
      (i.tokens.budget
        ? ` · Budget ${compactTokens(i.tokens.budget.used)} / ${compactTokens(i.tokens.budget.budget)} (${i.tokens.budget.label})`
        : ""),
  );
  if (i.tokens.byProject.length)
    t.push(
      `By project: ${i.tokens.byProject.map((b) => `${b.label} ${compactTokens(b.value)}`).join(", ")}`,
    );
  if (i.tokens.byPerson.length)
    t.push(
      `By person: ${i.tokens.byPerson.map((b) => `${b.label} ${compactTokens(b.value)}`).join(", ")}`,
    );
  if (i.tokens.reading) t.push(i.tokens.reading);
  t.push("");
  t.push(`PLANS · ${plansCount(i.plans)}`);
  if (!i.plans.length) t.push("No plans in this range.");
  for (const p of i.plans)
    t.push(
      `- ${p.title} · ${p.context} · ${plural(p.ratings, "rating")}${p.average !== null ? ` · ${starsWithNumber(p.average)}` : ""} · ${p.note ?? describeEstimate(p.est, p.actual).text} · ${p.status}`,
    );
  t.push("");
  t.push(`RELEASE GATES · ${gatesCount(i.gates)}`);
  if (!i.gates.length) t.push("No release gates in this range.");
  for (const g of i.gates)
    t.push(
      `- ${g.title} · ${g.context} · ${votesWords({ have: g.have, needed: g.needed })} · ${g.status}`,
    );
  t.push("");
  t.push(
    `You get this ${cadence} because you lead ${i.team}. The numbers are the team overview as of ${i.sentAt}; open it for live counts.`,
  );
  t.push(
    [
      i.urls.overview ? `Open the overview: ${i.urls.overview}` : "",
      i.urls.settings ? `Notification settings: ${i.urls.settings}` : "",
      `${PRODUCT}, sent for the ${i.team} team`,
    ]
      .filter(Boolean)
      .join(" · "),
  );

  // ---- html ----
  const needsBody = i.needs.length
    ? i.needs.map(needCardHtml).join("")
    : `<div style="font:14px ${SANS};color:${C.ink2};padding:6px 0 10px">Nothing needs you right now.</div>`;
  const maxProject = Math.max(0, ...i.tokens.byProject.map((b) => b.value));
  const maxPerson = Math.max(0, ...i.tokens.byPerson.map((b) => b.value));
  const bars = (title: string, list: Bar[], max: number) =>
    list.length
      ? `<td width="50%" valign="top" style="padding:0 10px 0 0"><div style="font:600 12px ${SANS};color:${C.ink2};padding:10px 0 4px">${h(title)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${list.map((b) => barRow(b, max)).join("")}</table></td>`
      : "";
  const against =
    i.tokens.againstPlans === null
      ? tile("Against plans", "—", "no finished steps yet")
      : tile(
          "Against plans",
          `${i.tokens.againstPlans > 0 ? "+" : "−"}${Math.abs(i.tokens.againstPlans)}%`,
          i.tokens.againstPlans > 0 ? "over estimates overall" : "under estimates overall",
        );
  const budget = i.tokens.budget
    ? tile(
        "Budget",
        `${compactTokens(i.tokens.budget.used)} / ${compactTokens(i.tokens.budget.budget)}`,
        `${i.tokens.budget.label}, soft budget`,
      )
    : tile("Budget", "—", "no budget set");
  const tokensBody = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${tile(
    "Spent",
    compactTokens(i.period.tokens),
    `${compactTokens(i.period.input)} in · ${compactTokens(i.period.output)} out`,
  )}${against}${budget}</tr></table><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${bars("By project", i.tokens.byProject, maxProject)}${bars("By person", i.tokens.byPerson, maxPerson)}</tr></table>${
    i.tokens.reading
      ? `<p style="margin:10px 0 0;font:13.5px/1.55 ${SANS};color:${C.ink2}">${h(i.tokens.reading)}</p>`
      : ""
  }`;
  const plansBody = i.plans.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${i.plans.map(planRowHtml).join("")}</table>`
    : `<div style="font:14px ${SANS};color:${C.ink2};padding:6px 0 10px">No plans in this range.</div>`;
  const gatesBody = i.gates.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${i.gates.map(gateRowHtml).join("")}</table>`
    : `<div style="font:14px ${SANS};color:${C.ink2};padding:6px 0 10px">No release gates in this range.</div>`;
  const joined = i.joined.length
    ? `<tr><td style="padding:0 34px 8px"><div style="padding:10px 14px;border-radius:12px;background:${C.apricotSoft};font:14px/1.5 ${SANS};color:${C.ink}"><b>Joined.</b> ${i.joined.map(h).join("<br>")}</div></td></tr>`
    : "";
  const seg = (label: string, on: boolean) =>
    `<span style="display:inline-block;padding:4px 12px;border-radius:999px;font:600 12px ${SANS};${on ? `background:${C.surface};color:${C.ink};border:1px solid ${C.line}` : `color:${C.ink2}`}">${h(label)}</span>`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${h(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.canvas};color:${C.ink};font-family:${SANS}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${h(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.canvas}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${C.surface};border:1px solid ${C.line};border-radius:16px;border-collapse:separate;overflow:hidden">
<tr><td style="padding:22px 34px 0"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="padding-right:10px">${emblem(24)}</td><td style="font:400 17px ${SERIF};color:${C.ink}">${PRODUCT}</td><td style="padding:0 8px;color:${C.ink3}">·</td><td style="font:400 17px ${SERIF};color:${C.ink}">${h(i.team)}</td><td style="padding-left:14px;font:12px ${MONO};color:${C.ink3}">${h(i.range)}</td></tr></table></td></tr>
<tr><td style="padding:16px 34px 18px;font:400 25px/1.3 ${SERIF};color:${C.ink}">${sentenceHtml(i.summary)} ${h(period)}</td></tr>
${joined}
${section("Needs you", String(i.needs.length), link("Open the queue →", i.urls.queue), needsBody)}
${section("Tokens", `${compactTokens(i.period.tokens)} ${i.cadence === "daily" ? "today" : "this week"}`, link("Usage →", i.urls.usage), tokensBody)}
${section("Plans", plansCount(i.plans), link("All plans →", i.urls.overview), plansBody)}
${section("Release gates", gatesCount(i.gates), "", gatesBody)}
<tr><td style="padding:24px 34px 26px;border-top:1px solid ${C.line};font:13px/1.6 ${SANS};color:${C.ink2}">
<div>You get this ${cadence} because you lead ${serifI(i.team)}. The numbers are the team overview as of ${h(i.sentAt)}; open it for live counts.</div>
<div style="margin:12px 0;padding:3px;border-radius:999px;background:${C.surface2};display:inline-block">${seg("Daily", i.cadence === "daily")}${seg("Weekly", i.cadence === "weekly")}${seg("Off", false)}</div>
<div>${link("Open the overview", i.urls.overview)} · ${link("Notification settings", i.urls.settings)} · ${PRODUCT}, sent for the ${h(i.team)} team</div>
</td></tr>
</table>
</td></tr></table>
</body>
</html>
`;
  return { subject, preheader, text: `${t.join("\n")}\n`, html };
}

/** The sentence with mono numbers and the needs-you clause in the hand colour. */
function sentenceHtml(s: DigestInput["summary"]): string {
  const n = (v: number) => `<span style="font-family:${MONO};font-size:21px">${v}</span>`;
  const needs =
    s.needs === 0
      ? "Nothing needs you right now."
      : `<b style="color:${C.accent}">${plural(s.needs, "thing")} need${s.needs === 1 ? "s" : ""} you.</b>`;
  return `${n(s.open)} open session${s.open === 1 ? "" : "s"} across ${n(s.projects)} project${s.projects === 1 ? "" : "s"}${s.counts ? `: ${h(s.counts)}` : ""}. ${needs}`;
}

// ---- the invite ---------------------------------------------------------------------------

export interface InviteInput {
  invitee: string;
  inviter: string;
  inviterEmail: string | null;
  team: string;
  /** "Payments is where Ana, Bo and Dee work with their agents on Billing page and Checkout." */
  teamLine: string;
  /** "member", "lead" */
  role: string;
  /** What the role can do and who has the baton right now, in one or two sentences. */
  roleLine: string;
  url: string;
  /** "Link is good for 7 days · one use" */
  expires: string;
  people: { names: string[]; line: string };
  agents: { count: number; line: string };
  /** "Your agent will plan before it works, and anything irreversible waits for two people at 4+." */
  manners: string;
  /** The agent's path: the command, or null when agents join from the app only. */
  join: { command: string; note: string } | null;
}

export function inviteSubject(i: Pick<InviteInput, "inviter" | "team">): string {
  return `${i.inviter} invites you to ${i.team} on ${PRODUCT}`;
}

/** The join moment on paper: a person and an agent get into the circle the same way. */
export function invite(i: InviteInput): RenderedEmail {
  const subject = inviteSubject(i);
  const preheader = `${i.invitee}, ${i.inviter} invites you to the circle. ${i.teamLine}`;
  const t: string[] = [];
  t.push(`${i.invitee}, ${i.inviter} invites you to the circle.`);
  t.push(i.teamLine);
  t.push("");
  t.push(`You open as a ${i.role}: ${i.roleLine}`);
  t.push("");
  t.push(`Join the circle: ${i.url}`);
  t.push(i.expires);
  t.push("");
  t.push(`People: ${i.people.line}`);
  t.push(`Agents: ${i.agents.line}`);
  t.push("");
  t.push(`Same manners, same gate. ${i.manners}`);
  if (i.join) {
    t.push("");
    t.push("Bringing an agent? It joins the same way.");
    t.push(i.join.note);
    t.push(`  ${i.join.command}`);
  }
  t.push("");
  t.push(
    `${i.inviter}${i.inviterEmail ? ` (${i.inviterEmail})` : ""} sent this from ${PRODUCT}. If you were not expecting it, ignore it; nothing happens until you open the link.`,
  );
  const avatars = (names: string[], agent: boolean) =>
    names
      .map(
        (n) =>
          `<span style="display:inline-block;width:24px;height:24px;border-radius:${agent ? "6px" : "24px"};background:${agent ? C.rail : C.apricot};color:${agent ? C.railFg : C.accent};font:600 10px/24px ${SANS};text-align:center;margin-right:2px">${h(n.slice(0, 1).toUpperCase())}</span>`,
      )
      .join("");
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${h(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.canvas};color:${C.ink};font-family:${SANS}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${h(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.canvas}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${C.surface};border:1px solid ${C.line};border-radius:16px;border-collapse:separate;overflow:hidden">
<tr><td style="padding:16px 16px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:14px;border-collapse:separate;background:${C.rail};background-image:linear-gradient(135deg,${C.rail},${C.accent});color:${C.railFg}"><tr><td style="padding:26px 28px">${emblem(40)}<h1 style="margin:14px 0 6px;font:400 32px/1.15 ${SERIF};color:${C.railFg}">${h(i.invitee)}, ${serifI(i.inviter)} invites you to the circle.</h1><p style="margin:0;font:15px/1.5 ${SANS};color:${C.railMuted}">${h(i.teamLine)}</p></td></tr></table></td></tr>
<tr><td style="padding:22px 30px 0;font:15px/1.6 ${SANS}">You open as a ${serifI(i.role)}: ${h(i.roleLine)}</td></tr>
<tr><td style="padding:18px 30px 0"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td>${button("Join the circle", i.url, true)}</td><td style="padding-left:12px;font:12.5px ${SANS};color:${C.ink2}">${h(i.expires)}</td></tr></table></td></tr>
<tr><td style="padding:22px 30px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="50%" valign="top" style="padding:12px 14px;border:1px solid ${C.line};border-radius:12px"><div style="font:600 11px ${SANS};letter-spacing:.06em;text-transform:uppercase;color:${C.ink2}">People</div><div style="padding:8px 0 4px">${avatars(i.people.names, false)}</div><div style="font:13px ${SANS};color:${C.ink2}">${h(i.people.line)}</div></td>
<td width="12" style="width:12px">&nbsp;</td>
<td width="50%" valign="top" style="padding:12px 14px;border:1px solid ${C.line};border-radius:12px"><div style="font:600 11px ${SANS};letter-spacing:.06em;text-transform:uppercase;color:${C.ink2}">Agents</div><div style="padding:8px 0 4px">${avatars(
    Array.from({ length: Math.min(i.agents.count, 6) }, () => "a"),
    true,
  )}</div><div style="font:13px ${SANS};color:${C.ink2}">${h(i.agents.line)}</div></td>
</tr></table></td></tr>
<tr><td style="padding:18px 30px 0"><div style="padding:12px 14px;border-radius:12px;background:${C.apricotSoft};font:14px/1.5 ${SANS}"><b>Same manners, same gate.</b> ${h(i.manners)}</div></td></tr>
${
  i.join
    ? `<tr><td style="padding:18px 30px 0"><div style="border:1px solid ${C.line};border-radius:12px;padding:14px 16px"><div style="font:400 17px ${SERIF}">Bringing an agent? It joins the same way.</div><div style="font:13px/1.5 ${SANS};color:${C.ink2};padding:4px 0 8px">${h(i.join.note)}</div><div style="background:${C.rail};color:${C.railFg};border-radius:10px;padding:11px 14px;font:12.5px/1.6 ${MONO};white-space:nowrap;overflow-x:auto">${h(i.join.command)}</div></div></td></tr>`
    : ""
}
<tr><td style="padding:22px 30px 26px;font:12.5px/1.6 ${SANS};color:${C.ink2}">${h(i.inviter)}${i.inviterEmail ? ` (${h(i.inviterEmail)})` : ""} sent this from ${PRODUCT}. If you were not expecting it, ignore it; nothing happens until you open the link.</td></tr>
</table>
</td></tr></table>
</body>
</html>
`;
  return { subject, preheader, text: `${t.join("\n")}\n`, html };
}
