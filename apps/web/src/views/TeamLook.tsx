/**
 * Settings › Team look (team-look-editor, team-emblems): a lead dresses the team in four
 * colours, what sits at the centre of the mark, a motion level and an emblem, and the look
 * never leaves the screen: the editor on the left, a slice of the shell painted with the draft
 * on the right. The checks table is the contrast control: every ratio computed by `contrast()`
 * on both canvases, a minimum tick on each bar, a fix line with a one-tap Use. A low check
 * warns and still saves (Decision 10). The server (PUT /api/teams/:id/theme) checks the role
 * again and persists into orgs.json.
 */
import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { api, type Me, type TeamTheme } from "../api.js";
import { copy } from "../copy.js";
import type { Identity } from "../identity.js";
import {
  barWidth,
  type ChangeKey,
  type Check,
  changesOf,
  checksOf,
  DEFAULTS,
  type Draft,
  draftOf,
  fixFor,
  HEX,
  handOf,
  isPreset,
  type LookKey,
  lowOf,
  ratioText,
  themeOf,
} from "../look.js";
import { rememberTeamTheme, TEAM_PRESETS, useTeamThemeValue } from "../theme.js";
import { ICONS, Icon, toast } from "../ui.js";

export { checksOf, contrast, themeOf } from "../look.js";

const COLOUR_KEYS: LookKey[] = ["accent", "highlight", "surface", "glow"];

const CHECK_WORDS: Record<Check["id"], { what: string; sub: string }> = {
  "hand-text": { what: copy.teamLook.checkHandText, sub: copy.teamLook.checkHandTextSub },
  "text-on-hand": { what: copy.teamLook.checkTextOnHand, sub: copy.teamLook.checkTextOnHandSub },
  "rail-text": { what: copy.teamLook.checkRailText, sub: copy.teamLook.checkRailTextSub },
  "highlight-on-surface": {
    what: copy.teamLook.checkHighlight,
    sub: copy.teamLook.checkHighlightSub,
  },
  arcs: { what: copy.teamLook.checkArcs, sub: copy.teamLook.checkArcsSub },
};

const KEY_WORDS: Record<ChangeKey, string> = {
  accent: copy.teamLook.accent,
  highlight: copy.teamLook.highlight,
  surface: copy.teamLook.surface,
  glow: copy.teamLook.glow,
  mark: copy.teamLook.mark,
  motion: copy.teamLook.motion,
  emblem: copy.teamLook.emblem,
};

export function TeamLook({ identity, me }: { identity: Identity; me: Me | null }) {
  const teams = useMemo(() => {
    const ids = me?.styles ?? [];
    return ids.map((id) => ({
      id,
      name: me?.projects.find((p) => p.teamId === id)?.teamName ?? id,
    }));
  }, [me]);
  const [picked, setPicked] = useState<string | null>(null);
  const team = teams.find((t) => t.id === picked) ?? teams[0] ?? null;
  const saved = useTeamThemeValue(team?.id ?? null);
  const [draft, setDraft] = useState<Draft>(() => draftOf(saved));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canvas, setCanvas] = useState<"cream" | "dark">("cream");
  const savedKey = JSON.stringify(saved);
  // A fresh team or a theme that arrived from the server replaces an untouched draft.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `savedKey` is the identity of `saved`
  useEffect(() => {
    if (!dirty) setDraft(draftOf(saved));
  }, [savedKey, team?.id]);

  if (!me) return null;
  if (teams.length === 0 || !team)
    return (
      <section className="group">
        <h2>{copy.teamLook.title}</h2>
        <p className="muted">{copy.teamLook.notLead}</p>
      </section>
    );

  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  };
  const valid =
    COLOUR_KEYS.every((k) => HEX.test(draft[k])) &&
    (draft.emblem.trim() === "" || /^[\p{L}\p{N}]{1,2}$/u.test(draft.emblem.trim()));
  const safe: Draft = {
    ...draft,
    ...Object.fromEntries(COLOUR_KEYS.map((k) => [k, HEX.test(draft[k]) ? draft[k] : DEFAULTS[k]])),
  };
  const checks = checksOf(safe);
  const low = lowOf(checks);
  const fix = fixFor(safe, checks);
  const changes = changesOf(draft, saved);
  const changed = new Set<ChangeKey>(changes);
  const activePreset = TEAM_PRESETS.find((p) => isPreset(draft, p.theme));
  // The preset the custom look is nearest to: the one it shares most colours with.
  const nearest = TEAM_PRESETS.map((p) => ({
    p,
    shared: COLOUR_KEYS.filter((k) => p.theme[k]?.toUpperCase() === draft[k].toUpperCase()).length,
  })).sort((a, b) => b.shared - a.shared)[0];
  const ownKeys = nearest
    ? COLOUR_KEYS.filter((k) => nearest.p.theme[k]?.toUpperCase() !== draft[k].toUpperCase())
    : [];
  const save = (theme: TeamTheme | null, doneWord: string) => {
    setBusy(true);
    setError(null);
    api
      .putTeamTheme(team.id, identity.userId, theme, identity.token || undefined)
      .then((r) => {
        rememberTeamTheme(team.id, r.theme);
        setDraft(draftOf(r.theme));
        setDirty(false);
        toast(`${doneWord} · ${copy.teamLook.savedWhen}`);
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e);
        setError(copy.teamLook.failed(message));
      })
      .finally(() => setBusy(false));
  };
  const lowRows = checks.filter((c) => !c.cream.ok || !c.dark.ok);
  const lowCanvases =
    low.some((l) => l.canvas === "cream") && low.some((l) => l.canvas === "dark")
      ? "both canvases"
      : low[0]?.canvas === "dark"
        ? copy.teamLook.dark.toLowerCase()
        : copy.teamLook.cream.toLowerCase();
  const hand = handOf(safe, canvas === "dark");
  const lookVars = {
    "--p-accent": safe.accent,
    "--p-highlight": safe.highlight,
    "--p-surface": safe.surface,
    "--p-glow": safe.glow,
    "--p-hand": hand.hand,
    "--p-hand-fg": hand.handFg,
  } as CSSProperties;

  const hexRow = (key: LookKey, label: string, hint: string) => {
    const bad = !HEX.test(draft[key]);
    return (
      <div className={`rowitem${changed.has(key) ? " changed" : ""}`} key={key}>
        <span className="lbl">
          <span className="t">
            {label}
            {changed.has(key) && <span className="tag">{copy.teamLook.changed}</span>}
          </span>
          <span className="s">{bad ? copy.teamLook.badHex : hint}</span>
        </span>
        <span className="hexrow">
          <input
            type="color"
            className="sw"
            aria-label={`${label} colour`}
            value={HEX.test(draft[key]) ? draft[key] : DEFAULTS[key]}
            onChange={(e) => set({ [key]: e.target.value.toUpperCase() } as Partial<Draft>)}
          />
          <input
            className={`field hex${bad ? " bad" : ""}`}
            aria-label={label}
            value={draft[key]}
            maxLength={7}
            spellCheck={false}
            onChange={(e) => set({ [key]: e.target.value.trim() } as Partial<Draft>)}
          />
        </span>
      </div>
    );
  };

  const cellOf = (c: Check["cream"]) => (
    <span className={`v${c.ok ? " ok" : " low"}`}>
      <span className="n">
        <b>{ratioText(c.ratio)}</b>: 1
        <span className="m">{c.ok ? copy.teamLook.fine : copy.teamLook.low}</span>
      </span>
      <span className="bar" aria-hidden="true">
        <i style={{ width: `${barWidth(c.ratio) * 100}%` }} />
        <u style={{ left: `${barWidth(c.min) * 100}%` }} />
      </span>
    </span>
  );

  return (
    <section className="teamlook" aria-label={copy.teamLook.title}>
      <div className="page-head">
        <div>
          <span className="crumb">{copy.teamLook.crumb} ›</span>
          <h2>{copy.teamLook.title}</h2>
          <p className="lede">
            How <i>{team.name}</i> {copy.teamLook.intro(team.name).replace(`How ${team.name} `, "")}
          </p>
        </div>
        <div className="end">
          <span className="small faint">{copy.teamLook.team}</span>
          {teams.length > 1 ? (
            <select
              className="select sm"
              aria-label={copy.teamLook.team}
              value={team.id}
              onChange={(e) => {
                setPicked(e.target.value);
                setDirty(false);
              }}
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="pill lg">{team.name}</span>
          )}
        </div>
      </div>

      <div className="grid">
        <div className="colA">
          <section className="card group colours" aria-labelledby="h-colours">
            <div className="gh">
              <h3 id="h-colours">{copy.teamLook.colours}</h3>
              <span className="sub">{copy.teamLook.coloursSub}</span>
              <span className="end">{copy.teamLook.checkedBoth}</span>
            </div>
            <div className="presets" role="radiogroup" aria-label={copy.teamLook.preset}>
              {TEAM_PRESETS.map((p) => {
                const on = activePreset?.id === p.id;
                return (
                  // biome-ignore lint/a11y/useSemanticElements: the tile is a radio by contract (aria-checked on the chosen preset), with the look drawn inside it
                  <button
                    type="button"
                    role="radio"
                    aria-checked={on}
                    key={p.id}
                    className={`preset${on ? " on" : ""}`}
                    style={
                      {
                        "--a": p.theme.accent,
                        "--h": p.theme.highlight,
                        "--s": p.theme.surface,
                        "--g": p.theme.glow,
                      } as CSSProperties
                    }
                    onClick={() => set({ ...(p.theme as Partial<Draft>) })}
                  >
                    <span className="mini" aria-hidden="true">
                      <span className="r">
                        <b />
                        <b />
                        <span className="pt" />
                      </span>
                      <span className="c">
                        <b />
                        <b />
                        <span className="btn-mini" />
                      </span>
                    </span>
                    <span className="pn">
                      <span className="serif">{p.label}</span>
                      <span className="d">{p.detail}</span>
                    </span>
                    {on && <Icon d={ICONS.check} size={14} className="tick" />}
                  </button>
                );
              })}
            </div>
            <p className="fromline">
              {activePreset ? (
                copy.teamLook.isPreset(activePreset.label)
              ) : (
                <>
                  <span className="pill">{copy.teamLook.custom}</span>
                  {nearest && ownKeys.length > 0
                    ? copy.teamLook.fromPreset(
                        nearest.p.label,
                        ownKeys.map((k) => KEY_WORDS[k].toLowerCase()).join(" and "),
                      )
                    : copy.teamLook.aPresetStartsOver}
                </>
              )}
            </p>
            <div className="list">
              {hexRow("accent", copy.teamLook.accent, copy.teamLook.accentHint)}
              {hexRow("highlight", copy.teamLook.highlight, copy.teamLook.highlightHint)}
              {hexRow("surface", copy.teamLook.surface, copy.teamLook.surfaceHint)}
              {hexRow("glow", copy.teamLook.glow, copy.teamLook.glowHint)}
            </div>
            <div className="checks">
              <div className="ch">
                <h4>{copy.teamLook.contrast}</h4>
                <span className="s">{copy.teamLook.contrastSub}</span>
                <span className="k">
                  <i className="ok">{copy.teamLook.fine}</i>
                  <i className="low">{copy.teamLook.low}</i>
                </span>
              </div>
              <table aria-label={copy.teamLook.contrast}>
                <thead>
                  <tr className="checkhead">
                    <th />
                    <th>{copy.teamLook.colCream}</th>
                    <th>{copy.teamLook.colDark}</th>
                  </tr>
                </thead>
                <tbody>
                  {checks.map((c) => (
                    <tr className="check" key={c.id}>
                      <th className="w" scope="row">
                        {CHECK_WORDS[c.id].what}
                        <small>
                          {CHECK_WORDS[c.id].sub} · {copy.teamLook.needs(c.min)}
                        </small>
                      </th>
                      <td>{cellOf(c.cream)}</td>
                      <td>{cellOf(c.dark)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {fix && (
                <div className="fix">
                  <span className="sw" style={{ background: fix.to }} aria-hidden="true" />
                  <span>
                    {copy.teamLook.fixLine(KEY_WORDS[fix.key], fix.canvas)}
                    <span className="mono">{fix.to}</span>.
                  </span>
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => set({ [fix.key]: fix.to } as Partial<Draft>)}
                  >
                    {copy.teamLook.fixUse(fix.to)}
                  </button>
                </div>
              )}
            </div>
          </section>

          <section className="card group markcard" aria-labelledby="h-mark">
            <div className="gh">
              <h3 id="h-mark">{copy.teamLook.markCard}</h3>
              <span className="sub">{copy.teamLook.markCardSub}</span>
            </div>
            <div className="list">
              <div className={`rowitem${changed.has("mark") ? " changed" : ""}`}>
                <span className="lbl">
                  <span className="t">
                    {copy.teamLook.mark}
                    {changed.has("mark") && <span className="tag">{copy.teamLook.changed}</span>}
                  </span>
                  <span className="s">{copy.teamLook.markHint}</span>
                </span>
                <fieldset className="seg big" aria-label={copy.teamLook.mark} style={lookVars}>
                  {(["ring", "bead", "dot"] as const).map((m) => (
                    <button
                      type="button"
                      key={m}
                      className={draft.mark === m ? "on" : ""}
                      aria-pressed={draft.mark === m}
                      onClick={() => set({ mark: m })}
                    >
                      <LookMark mark={m} emblem={draft.emblem.trim()} size={22} />
                      {m === "ring"
                        ? copy.teamLook.markRing
                        : m === "bead"
                          ? copy.teamLook.markBead
                          : copy.teamLook.markDot}
                    </button>
                  ))}
                </fieldset>
              </div>
              <div className={`rowitem emblemrow${changed.has("emblem") ? " changed" : ""}`}>
                <span className="lbl">
                  <span className="t">
                    {copy.teamLook.emblem}
                    {changed.has("emblem") && <span className="tag">{copy.teamLook.changed}</span>}
                  </span>
                  <span className="s">{copy.teamLook.emblemHint}</span>
                </span>
                <span className="hexrow" style={lookVars}>
                  <LookMark mark="bead" emblem={draft.emblem.trim()} size={48} />
                  <input
                    className="field emb"
                    aria-label={copy.teamLook.emblem}
                    value={draft.emblem}
                    maxLength={2}
                    onChange={(e) => set({ emblem: e.target.value })}
                  />
                </span>
              </div>
              <div className={`rowitem${changed.has("motion") ? " changed" : ""}`}>
                <span className="lbl">
                  <span className="t">
                    {copy.teamLook.motion}
                    {changed.has("motion") && <span className="tag">{copy.teamLook.changed}</span>}
                  </span>
                  <span className="s">{copy.teamLook.motionHint}</span>
                </span>
                <fieldset className="seg plain" aria-label={copy.teamLook.motion}>
                  {(["full", "calm"] as const).map((m) => (
                    <button
                      type="button"
                      key={m}
                      className={draft.motion === m ? "on" : ""}
                      aria-pressed={draft.motion === m}
                      onClick={() => set({ motion: m })}
                    >
                      {m === "full" ? copy.teamLook.motionFull : copy.teamLook.motionCalm}
                    </button>
                  ))}
                </fieldset>
              </div>
            </div>
            <p className="motionhint">
              <i>
                <span className="dotp" />
                <b>{copy.teamLook.motionFull}</b> {copy.teamLook.motionFullDetail}
              </i>
              <i>
                <b>{copy.teamLook.motionCalm}</b> {copy.teamLook.motionCalmDetail}
              </i>
            </p>
          </section>
        </div>

        <div className="colB">
          <section className="card preview" aria-label={copy.teamLook.preview}>
            <div className="ph">
              <h3>{copy.teamLook.preview}</h3>
              <span className="sub">
                {copy.teamLook.previewSub(copy.teamLook.previewCardOwner.replace("'s agent", ""))}
              </span>
              <fieldset className="seg canvasseg" aria-label={copy.teamLook.canvas}>
                <button
                  type="button"
                  className={canvas === "cream" ? "on" : ""}
                  aria-pressed={canvas === "cream"}
                  onClick={() => setCanvas("cream")}
                >
                  {copy.teamLook.cream}
                </button>
                <button
                  type="button"
                  className={canvas === "dark" ? "on" : ""}
                  aria-pressed={canvas === "dark"}
                  onClick={() => setCanvas("dark")}
                >
                  {copy.teamLook.dark}
                </button>
              </fieldset>
            </div>
            <Preview draft={safe} vars={lookVars} canvas={canvas} />
            <div className="shows">
              <h4>{copy.teamLook.where}</h4>
              <div className="parts">
                <i>
                  <span className="c" style={{ background: safe.accent }} />
                  {copy.teamLook.whereAccent}
                </i>
                <i>
                  <span className="c" style={{ background: safe.highlight }} />
                  {copy.teamLook.whereHighlight}
                </i>
                <i>
                  <span className="c" style={{ background: safe.surface }} />
                  {copy.teamLook.whereSurface}
                </i>
                <i>
                  <span className="c" style={{ background: safe.glow }} />
                  {copy.teamLook.whereGlow}
                </i>
              </div>
            </div>
          </section>
          <section className="card seen" aria-label={copy.teamLook.whoSees}>
            <span style={lookVars}>
              <LookMark mark={draft.mark} emblem={draft.emblem.trim()} size={48} />
            </span>
            <span>
              <b>{copy.teamLook.everyoneIn(team.name)}</b>
              {copy.teamLook.whoSeesLine}
            </span>
          </section>
        </div>
      </div>

      {error && <p className="small danger">{error}</p>}
      <div className="savebar" role="status" style={lookVars}>
        <LookMark mark={draft.mark} emblem={draft.emblem.trim()} size={30} />
        <span className="txt">
          {changes.length === 0 ? (
            copy.teamLook.nothingChanged
          ) : (
            <>
              <b>{copy.teamLook.changesCount(changes.length)}</b>
              {copy.teamLook.changesTo}
              <i>{team.name}</i>
              {copy.teamLook.changesLook}
              {changes.map((k) => KEY_WORDS[k].toLowerCase()).join(", ")}.
            </>
          )}{" "}
          {lowRows.length > 0 ? (
            <>
              <span className="low">{copy.teamLook.lowCount(lowRows.length)}</span>
              {copy.teamLook.lowOn(lowCanvases)}
              {copy.teamLook.lowHard(KEY_WORDS[lowRows[0]?.fixes ?? "accent"])}
            </>
          ) : (
            copy.teamLook.allFine
          )}
        </span>
        <button
          type="button"
          className="btn ghost sm"
          disabled={busy || (!saved && !dirty)}
          onClick={() => save(null, copy.teamLook.resetDone)}
        >
          {copy.teamLook.resetToPalette}
        </button>
        <button
          type="button"
          className="btn primary sm phand"
          disabled={busy || !dirty || !valid}
          onClick={() => save(themeOf(draft), copy.teamLook.saved)}
        >
          {busy ? copy.teamLook.saving : copy.teamLook.saveTo(team.name)}
        </button>
      </div>
    </section>
  );
}

/** The mark painted with the draft: the disc, a person's arc, an agent's arc, and the centre the team chose. */
function LookMark({ mark, emblem, size }: { mark: Draft["mark"]; emblem: string; size: number }) {
  // The crest only at 48 px and up; at 32 and below the centre dot returns (team-emblems).
  const withEmblem = mark === "bead" && emblem.length > 0 && size >= 36;
  return (
    <svg viewBox="0 0 96 96" width={size} height={size} aria-hidden="true" className="lookmark">
      <circle cx="48" cy="48" r="46" fill="var(--p-surface)" />
      {mark !== "dot" && (
        <path
          d="M48 20 A28 28 0 0 1 48 76"
          stroke="var(--p-accent)"
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
        />
      )}
      {mark !== "dot" && (
        <path
          d="M48 76 A28 28 0 0 1 48 20"
          stroke="var(--p-highlight)"
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
        />
      )}
      {withEmblem ? (
        <text
          x="48"
          y="59"
          textAnchor="middle"
          fill="var(--p-highlight)"
          style={{ font: "400 32px var(--serif)", letterSpacing: "-0.02em" }}
        >
          {emblem}
        </text>
      ) : (
        <circle cx="48" cy="48" r={mark === "dot" ? 12 : 7} fill="var(--p-highlight)" />
      )}
    </svg>
  );
}

/** A slice of the shell painted only through `--p-*`: the rail with the brand and New session, two cards; the canvas with a title, the Team pill, a team message, Approve / Revise, a focused field. */
function Preview({
  draft,
  vars,
  canvas,
}: {
  draft: Draft;
  vars: CSSProperties;
  canvas: "cream" | "dark";
}) {
  const emblem = draft.emblem.trim();
  return (
    <div
      className="look"
      style={vars}
      data-canvas={canvas}
      data-motion={draft.motion === "calm" ? "calm" : undefined}
      role="img"
      aria-label={copy.teamLook.previewAria}
    >
      <div className="prail">
        <div className="brand">
          <LookMark mark={draft.mark} emblem={emblem} size={30} />
          <span>{copy.product}</span>
          {emblem && <span className="emb">{emblem}</span>}
        </div>
        <button className="new" type="button" tabIndex={-1}>
          <span aria-hidden="true">+</span> {copy.teamLook.newSession}
        </button>
        <div className="section">
          {copy.teamLook.previewAgents} <span className="n">2</span>
        </div>
        <div className="pagent">
          <span className="head">
            <span className="dot" />
            <span>{copy.teamLook.previewCardOwner}</span>
            <span className="pill">{copy.teamLook.previewTeam}</span>
          </span>
          <span className="doing">
            <i>{copy.teamLook.previewDoing}</i>
            {copy.teamLook.previewDoingRest}
          </span>
          <span className="foot">
            <span className="stack">
              <span className="avatar driver">B</span>
              <span className="avatar">C</span>
            </span>
            {copy.teamLook.previewWith}
          </span>
        </div>
        <div className="pagent pagent2">
          <span className="head">
            <span className="dot" />
            <span>{copy.teamLook.previewCard2}</span>
            <span className="pill">{copy.teamLook.previewSolo}</span>
          </span>
          <span className="doing">
            {copy.teamLook.previewWaits}
            <i>{copy.teamLook.previewWaitsOn}</i>
          </span>
        </div>
      </div>
      <div className="pcanvas">
        <div className="ttl">
          <span className="serif">{copy.teamLook.previewCard}</span>
          <span className="pill tp">{copy.teamLook.previewTeam}</span>
          <span className="status running st">{copy.teamLook.previewRunning}</span>
        </div>
        <div className="pmsg">
          <span className="meta">
            <span className="who">{copy.teamLook.previewWho}</span>
            <span className="to">{copy.teamLook.previewTo}</span>
            {copy.teamLook.previewWhen}
          </span>
          <span className="text">
            {copy.teamLook.previewMsg}
            <span className="link">{copy.teamLook.previewLink}</span>
            {copy.teamLook.previewMsgEnd}
          </span>
        </div>
        <div className="pbar">
          <button className="btn sm pbtn" type="button" tabIndex={-1}>
            {copy.teamLook.previewButton}
          </button>
          <button className="btn sm" type="button" tabIndex={-1}>
            {copy.teamLook.previewRevise}
          </button>
          <span className="stack">
            <span className="avatar driver">B</span>
            <span className="avatar">C</span>
            <span className="avatar">A</span>
          </span>
        </div>
        <div className="pfocus">
          <span>{copy.teamLook.previewField}</span>
          <span className="caret" />
        </div>
      </div>
    </div>
  );
}
