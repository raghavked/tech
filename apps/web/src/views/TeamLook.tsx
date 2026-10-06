/**
 * settings-page, "Team look" (team-theme): a lead or manager styles their team. Three presets
 * made only of the palette, custom hex fields with contrast checks against the canvas and the
 * rail, the mark's style, the motion level, an emblem, a live preview card, Save and Reset.
 * The server (PUT /api/teams/:id/theme) checks the role again and persists into orgs.json.
 */
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { api, type Me, type TeamTheme } from "../api.js";
import { copy } from "../copy.js";
import type { Identity } from "../identity.js";
import { PALETTE, rememberTeamTheme, TEAM_PRESETS, useTeamThemeValue } from "../theme.js";
import { Mark, toast } from "../ui.js";

type Draft = Required<Pick<TeamTheme, "accent" | "highlight" | "surface" | "glow">> & {
  mark: NonNullable<TeamTheme["mark"]>;
  motion: NonNullable<TeamTheme["motion"]>;
  emblem: string;
};

const DEFAULTS: Draft = {
  accent: PALETTE.fondant,
  highlight: PALETTE.apricot,
  surface: PALETTE.blues,
  glow: PALETTE.apricot,
  mark: "ring",
  motion: "full",
  emblem: "",
};

const HEX = /^#[0-9a-fA-F]{6}$/;

function draftOf(theme: TeamTheme | null): Draft {
  return {
    accent: theme?.accent ?? DEFAULTS.accent,
    highlight: theme?.highlight ?? DEFAULTS.highlight,
    surface: theme?.surface ?? DEFAULTS.surface,
    glow: theme?.glow ?? DEFAULTS.glow,
    mark: theme?.mark ?? DEFAULTS.mark,
    motion: theme?.motion ?? DEFAULTS.motion,
    emblem: theme?.emblem ?? DEFAULTS.emblem,
  };
}

/** What goes to the server: only what differs from the palette, so a reset is an empty theme. */
export function themeOf(d: Draft): TeamTheme | null {
  const out: TeamTheme = {};
  if (d.accent.toUpperCase() !== DEFAULTS.accent) out.accent = d.accent;
  if (d.highlight.toUpperCase() !== DEFAULTS.highlight) out.highlight = d.highlight;
  if (d.surface.toUpperCase() !== DEFAULTS.surface) out.surface = d.surface;
  if (d.glow.toUpperCase() !== DEFAULTS.glow) out.glow = d.glow;
  if (d.mark !== DEFAULTS.mark) out.mark = d.mark;
  if (d.motion !== DEFAULTS.motion) out.motion = d.motion;
  if (d.emblem.trim()) out.emblem = d.emblem.trim();
  return Object.keys(out).length ? out : null;
}

// ---- contrast (WCAG 2) ---------------------------------------------------------------------

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const c = [16, 8, 0].map((shift) => {
    const v = ((n >> shift) & 255) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** Contrast ratio between two #RRGGBB colours, 1 to 21. */
export function contrast(a: string, b: string): number {
  if (!HEX.test(a) || !HEX.test(b)) return 1;
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const RAIL_TEXT = "#F6F0E7";

/** The checks a lead sees under the fields: what must stay readable, and against what. */
export function checksOf(d: Draft): { what: string; ratio: number; ok: boolean }[] {
  const cream = PALETTE.cream;
  const rows = [
    {
      what: `${copy.teamLook.accent} ${copy.teamLook.onCream}`,
      ratio: contrast(d.accent, cream),
      min: 4.5,
    },
    { what: `${copy.teamLook.textOnAccent}`, ratio: contrast(d.accent, "#FFF8F0"), min: 4.5 },
    {
      what: `${copy.teamLook.surface}: text ${copy.teamLook.onSurface}`,
      ratio: contrast(d.surface, RAIL_TEXT),
      min: 4.5,
    },
    {
      what: `${copy.teamLook.highlight} ${copy.teamLook.onSurface}`,
      ratio: contrast(d.highlight, d.surface),
      min: 3,
    },
  ];
  return rows.map((r) => ({ what: r.what, ratio: r.ratio, ok: r.ratio >= r.min }));
}

// ---- the section -----------------------------------------------------------------------------

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
    [draft.accent, draft.highlight, draft.surface, draft.glow].every((h) => HEX.test(h)) &&
    (draft.emblem.trim() === "" || /^[\p{L}\p{N}]{1,2}$/u.test(draft.emblem.trim()));
  const checks = checksOf(draft);
  const activePreset = TEAM_PRESETS.find(
    (p) =>
      p.theme.accent?.toUpperCase() === draft.accent.toUpperCase() &&
      p.theme.highlight?.toUpperCase() === draft.highlight.toUpperCase() &&
      p.theme.surface?.toUpperCase() === draft.surface.toUpperCase() &&
      p.theme.glow?.toUpperCase() === draft.glow.toUpperCase(),
  );
  const save = (theme: TeamTheme | null, doneWord: string) => {
    setBusy(true);
    setError(null);
    api
      .putTeamTheme(team.id, identity.userId, theme, identity.token || undefined)
      .then((r) => {
        rememberTeamTheme(team.id, r.theme);
        setDraft(draftOf(r.theme));
        setDirty(false);
        toast(doneWord);
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e);
        setError(copy.teamLook.failed(message));
      })
      .finally(() => setBusy(false));
  };

  const hexField = (
    key: "accent" | "highlight" | "surface" | "glow",
    label: string,
    hint: string,
  ) => {
    const bad = !HEX.test(draft[key]);
    return (
      <div className="rowitem">
        <span className="ellipsis">
          <span className="t">{label}</span>
          <span className="s">{bad ? copy.teamLook.badHex : hint}</span>
        </span>
        <span className="row hexrow">
          <input
            type="color"
            aria-label={`${label} colour`}
            value={HEX.test(draft[key]) ? draft[key] : DEFAULTS[key]}
            onChange={(e) => set({ [key]: e.target.value.toUpperCase() } as Partial<Draft>)}
          />
          <input
            className={`input mono sm${bad ? " bad" : ""}`}
            aria-label={label}
            value={draft[key]}
            maxLength={7}
            onChange={(e) => set({ [key]: e.target.value.trim() } as Partial<Draft>)}
          />
        </span>
      </div>
    );
  };

  return (
    <section className="group teamlook" aria-label={copy.teamLook.title}>
      <h2>{copy.teamLook.title}</h2>
      <p className="row">
        <span className="muted grow">{copy.teamLook.intro(team.name)}</span>
        {teams.length > 1 && (
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
        )}
      </p>
      <Preview draft={draft} teamName={team.name} />
      <div className="list">
        <div className="rowitem">
          <span className="ellipsis">
            <span className="t">{copy.teamLook.preset}</span>
            <span className="s">{copy.teamLook.presetHint}</span>
          </span>
          <fieldset className="seg" aria-label={copy.teamLook.preset}>
            {TEAM_PRESETS.map((p) => (
              <button
                type="button"
                key={p.id}
                className={activePreset?.id === p.id ? "on" : ""}
                aria-pressed={activePreset?.id === p.id}
                onClick={() => set({ ...(p.theme as Partial<Draft>) })}
              >
                {p.label}
              </button>
            ))}
          </fieldset>
        </div>
        {hexField("accent", copy.teamLook.accent, copy.teamLook.accentHint)}
        {hexField("highlight", copy.teamLook.highlight, copy.teamLook.highlightHint)}
        {hexField("surface", copy.teamLook.surface, copy.teamLook.surfaceHint)}
        {hexField("glow", copy.teamLook.glow, copy.teamLook.glowHint)}
        <div className="rowitem checks">
          <span className="ellipsis">
            {checks.map((c) => (
              <span key={c.what} className={`s check${c.ok ? "" : " low"}`}>
                {copy.teamLook.contrast(c.what, `${c.ratio.toFixed(1)}:1`, c.ok)}
              </span>
            ))}
          </span>
        </div>
        <div className="rowitem">
          <span className="ellipsis">
            <span className="t">{copy.teamLook.mark}</span>
            <span className="s">{copy.teamLook.markHint}</span>
          </span>
          <fieldset className="seg" aria-label={copy.teamLook.mark}>
            {(["ring", "bead", "dot"] as const).map((m) => (
              <button
                type="button"
                key={m}
                className={draft.mark === m ? "on" : ""}
                aria-pressed={draft.mark === m}
                onClick={() => set({ mark: m })}
              >
                {m === "ring"
                  ? copy.teamLook.markRing
                  : m === "bead"
                    ? copy.teamLook.markBead
                    : copy.teamLook.markDot}
              </button>
            ))}
          </fieldset>
        </div>
        <div className="rowitem">
          <span className="ellipsis">
            <span className="t">{copy.teamLook.motion}</span>
            <span className="s">{copy.teamLook.motionHint}</span>
          </span>
          <fieldset className="seg" aria-label={copy.teamLook.motion}>
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
        <div className="rowitem">
          <span className="ellipsis">
            <span className="t">{copy.teamLook.emblem}</span>
            <span className="s">{copy.teamLook.emblemHint}</span>
          </span>
          <input
            className="input sm emblem"
            aria-label={copy.teamLook.emblem}
            value={draft.emblem}
            maxLength={2}
            onChange={(e) => set({ emblem: e.target.value.toUpperCase() })}
          />
        </div>
      </div>
      {error && <p className="small danger">{error}</p>}
      <p className="row">
        <span className="grow" />
        <button
          type="button"
          className="btn ghost sm"
          disabled={busy || (!saved && !dirty)}
          onClick={() => save(null, copy.teamLook.resetDone)}
        >
          {copy.teamLook.reset}
        </button>
        <button
          type="button"
          className="btn primary sm"
          disabled={busy || !dirty || !valid}
          onClick={() => save(themeOf(draft), copy.teamLook.saved)}
        >
          {busy ? copy.teamLook.saving : copy.teamLook.save}
        </button>
      </p>
    </section>
  );
}

/** The draft, live: a slice of rail with an agent card and the mark, and a slice of canvas. */
function Preview({ draft, teamName }: { draft: Draft; teamName: string }) {
  const ok = (h: string, fallback: string) => (HEX.test(h) ? h : fallback);
  const accent = ok(draft.accent, DEFAULTS.accent);
  const highlight = ok(draft.highlight, DEFAULTS.highlight);
  const surface = ok(draft.surface, DEFAULTS.surface);
  const glow = ok(draft.glow, DEFAULTS.glow);
  const vars = {
    "--team-accent": accent,
    "--team-highlight": highlight,
    "--team-surface": surface,
    "--team-glow": glow,
    "--accent": accent,
    "--highlight": highlight,
    "--highlight-soft": `color-mix(in srgb, ${highlight} 30%, transparent)`,
    "--glow": `color-mix(in srgb, ${glow} 50%, transparent)`,
    "--crease": highlight,
    "--rail-bg": surface,
    "--rail-active": `color-mix(in srgb, ${highlight} 20%, transparent)`,
    "--mark-disc": surface,
    "--mark-ring": highlight,
    "--mark-bead": accent,
    "--grad": `linear-gradient(135deg, ${surface} 0%, color-mix(in srgb, ${surface} 45%, ${accent}) 55%, ${accent} 100%)`,
  } as CSSProperties;
  return (
    <div
      className="look-preview"
      style={vars}
      data-motion={draft.motion === "calm" ? "calm" : undefined}
      role="img"
      aria-label={copy.teamLook.preview}
    >
      <div className="rail">
        <div className="brand">
          <Mark size={22} style={draft.mark} emblem={draft.emblem.trim() || undefined} />
          <span className="serif">{copy.product}</span>
          {draft.emblem.trim() && draft.mark !== "dot" && (
            <span className="emblem">{draft.emblem.trim()}</span>
          )}
        </div>
        <span className="agent active">
          <span className="head">
            <span className="dot running" />
            <span className="t">{copy.teamLook.previewCard}</span>
            <span className="pill badge">1</span>
          </span>
          <span className="doing">
            <i>{copy.teamLook.previewDoing}</i> {copy.teamLook.previewGoal}
          </span>
          <span className="foot">
            <span className="pill team">Team</span>
            <span className="stack" aria-hidden="true">
              <span className="avatar driver">A</span>
              <span className="avatar">B</span>
            </span>
            <span className="with">{copy.teamLook.previewWith}</span>
          </span>
        </span>
      </div>
      <div className="canvas">
        <span className="serif title">{teamName}</span>
        <span className="row">
          <button type="button" className="btn primary sm" tabIndex={-1}>
            {copy.teamLook.previewButton}
          </button>
          <span className="status running">{copy.teamLook.previewRunning}</span>
          <span className="chip on">{copy.teamLook.previewGoal}</span>
        </span>
        <span className="empty row small">
          <span className="muted grow">{copy.project.memoryEmptyHint}</span>
        </span>
      </div>
    </div>
  );
}
