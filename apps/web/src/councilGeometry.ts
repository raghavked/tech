/**
 * The council's table as geometry (views/CouncilTable.tsx draws it). One unit is one CSS pixel:
 * the drawing is laid out for the width it is given, so type keeps its size and only the ring
 * gives way. Angles are degrees clockwise from twelve; the chair is seat 0, at twelve.
 *
 * Two forms. Wide: a seat's label is its name, its owner and its stance, outside the ring.
 * Compact (a phone, or more than seven seats): the name only, on one or two lines; the owner
 * and the stance live in the seat's name for assistive tech, in its hover title and in the
 * stream.
 */

/** Below this width the labels fold to names. */
export const TABLE_WIDE_MIN = 680;
/** Past this many seats the labels fold to names at any width (the judges' seven-seat cap). */
export const TABLE_SEAT_CAP = 7;
/** The air between two seats' segments, in degrees on each side. */
const AIR = 3;

export interface TablePoint {
  x: number;
  y: number;
}

export interface SeatGeometry {
  /** Degrees clockwise from twelve. */
  a: number;
  /** The tile's centre, on the ring. */
  x: number;
  y: number;
  /** The unit vector pointing away from the centre. */
  ux: number;
  uy: number;
  tile: number;
  /** The seat's segment of the table, and the same arc for its halo. */
  seg: string;
  /** The chair's tick inside the ring; null for every other seat. */
  tick: [TablePoint, TablePoint] | null;
  /** The owner's circle, a step clockwise on the ring; `out` points away from the centre. */
  person: TablePoint & { out: TablePoint };
  /** Where a person without a model sits: the gap after this seat. */
  gap: TablePoint & { out: TablePoint };
  label: {
    x: number;
    y: number;
    anchor: "start" | "middle" | "end";
    /** Above a top seat, below a bottom one, beside the others. */
    side: "above" | "below" | "beside";
    /** How many characters of the name fit on one line here, and of the smaller owner line. */
    nameChars: number;
    ownerChars: number;
  };
  /** How far the seat steps back when its model holds a dissent. */
  step: TablePoint;
}

export interface TableGeometry {
  width: number;
  height: number;
  cx: number;
  cy: number;
  compact: boolean;
  /** The ring's radius and the plan's. */
  r: number;
  rc: number;
  /** A person's circle, its rating ring and where the rating's count sits from its centre. */
  pr: number;
  ringR: number;
  badgeR: number;
  badgeAt: number;
  /** The plan's rim, and the owners' marks inside it. */
  rimR: number;
  markR: number;
  markAt: number;
  seats: SeatGeometry[];
}

const rad = (a: number) => ((a - 90) * Math.PI) / 180;
const f = (n: number) => (Math.round(n * 100) / 100).toString();

/** A point at angle `a` and radius `r` around (cx, cy). */
export function polar(cx: number, cy: number, a: number, r: number): TablePoint {
  return { x: cx + r * Math.cos(rad(a)), y: cy + r * Math.sin(rad(a)) };
}

/** A clockwise arc from `a0` to `a1` at radius `r`. */
export function arcPath(cx: number, cy: number, a0: number, a1: number, r: number): string {
  const p0 = polar(cx, cy, a0, r);
  const p1 = polar(cx, cy, a1, r);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M${f(p0.x)} ${f(p0.y)} A${f(r)} ${f(r)} 0 ${large} 1 ${f(p1.x)} ${f(p1.y)}`;
}

/**
 * A word: the angle runs evenly from `a0` to `a1`; the radius holds near the table for `hold`
 * of the way, then eases inward on a smoothstep, so the arc leaves along the table and arrives
 * along the plan's edge.
 */
export function wordPath(
  cx: number,
  cy: number,
  a0: number,
  a1: number,
  r0: number,
  r1: number,
  hold: number,
): string {
  const pts: string[] = [];
  for (let i = 0; i <= 32; i++) {
    const t = i / 32;
    const u = Math.max(0, (t - hold) / (1 - hold));
    const s = u * u * (3 - 2 * u);
    const p = polar(cx, cy, a0 + (a1 - a0) * t, r0 + (r1 - r0) * s);
    pts.push(`${f(p.x)} ${f(p.y)}`);
  }
  return `M${pts.join(" L")}`;
}

/** The agent's tile around the origin: three round corners and the tight bottom-left one. */
export function tilePath(size: number): string {
  const h = size / 2;
  const r = size * 0.3;
  const b = size * 0.09;
  return `M${f(-h + r)} ${f(-h)} H${f(h - r)} A${f(r)} ${f(r)} 0 0 1 ${f(h)} ${f(-h + r)} V${f(h - r)} A${f(r)} ${f(r)} 0 0 1 ${f(h - r)} ${f(h)} H${f(-h + b)} A${f(b)} ${f(b)} 0 0 1 ${f(-h)} ${f(h - b)} V${f(-h + r)} A${f(r)} ${f(r)} 0 0 1 ${f(-h + r)} ${f(-h)} Z`;
}

/** The half-angle a word may spread to inside its seat's sector. */
export function wordSpread(seats: number): number {
  return Math.max(6, Math.min(24, 180 / Math.max(1, seats) - 5));
}

/**
 * A name on the lines the form allows: one line when wide, up to two when compact, broken at a
 * space and cut with an ellipsis when a line would still be too long.
 */
export function nameLines(name: string, chars: number, lines: 1 | 2): string[] {
  const cut = (s: string) => (s.length > chars ? `${s.slice(0, Math.max(1, chars - 1))}…` : s);
  if (lines === 1 || name.length <= chars) return [cut(name)];
  const words = name.split(" ");
  let first = "";
  let i = 0;
  while (i < words.length && (first ? `${first} ${words[i]}` : (words[i] ?? "")).length <= chars) {
    first = first ? `${first} ${words[i]}` : (words[i] ?? "");
    i++;
  }
  if (!first) return [cut(name)];
  const rest = words.slice(i).join(" ");
  return rest ? [first, cut(rest)] : [first];
}

/** Lay the table out for `width` pixels and `count` seats. */
export function tableGeometry(width: number, count: number): TableGeometry {
  const n = Math.max(1, count);
  const compact = width < TABLE_WIDE_MIN || n > TABLE_SEAT_CAP;
  const crowded = n > 10;
  const tile = crowded ? 24 : compact ? 30 : 40;
  const chairTile = crowded ? 28 : compact ? 34 : 46;
  const pr = crowded ? 8 : compact ? 10 : 14;
  const ringR = pr + (compact ? 4.5 : 5.5);
  const badgeR = compact ? 7.5 : 9.5;
  const badgeAt = pr + (compact ? 7 : 8);
  const stepBack = compact ? 6 : 14;
  const labelGap = compact ? 7 : 12;
  // what a label beside the ring is promised: nine characters of a name on a phone, sixteen wide
  const labelRoom = compact ? 54 : 128;
  const nameWidth = compact ? 6 : 8;
  const side = width / 2 - tile / 2 - labelGap - 2 - labelRoom - stepBack;
  const r = Math.round(Math.max(64, Math.min(compact ? 150 : 176, side)));
  const rc = Math.round(r * (compact ? 0.54 : 0.5));
  // the label block's height: two lines of a name when compact; a kicker, the name, the owner
  // and the stance when wide
  const lineBlock = compact ? 32 : 72;
  const top = chairTile / 2 + labelGap + lineBlock + stepBack + 2;
  const half = 180 / n;
  const cx = width / 2;
  const cy = r + top;

  let bottom = 0;
  const seats: SeatGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i * 360) / n;
    const size = i === 0 ? chairTile : tile;
    const p = polar(cx, cy, a, r);
    const ux = Math.cos(rad(a));
    const uy = Math.sin(rad(a));
    const da = ((size / 2 + pr + (compact ? 4 : 5)) / r) * (180 / Math.PI);
    const pp = polar(cx, cy, a + da, r);
    const gp = polar(cx, cy, a + half, r);
    const where = uy < -0.5 ? "above" : uy > 0.5 ? "below" : "beside";
    const anchor = Math.abs(ux) < 0.3 ? "middle" : ux < 0 ? "end" : "start";
    const reach = size / 2 + labelGap;
    // a label hangs from its seat: straight up or down at the poles, outward along the row elsewhere
    const lp =
      where === "beside"
        ? { x: p.x + ux * reach + Math.sign(ux) * 2, y: p.y }
        : {
            x: anchor === "middle" ? p.x : p.x + ux * reach * 0.6,
            y: p.y + (where === "above" ? -reach : reach),
          };
    const toEdge =
      anchor === "middle"
        ? 2 * Math.min(lp.x, width - lp.x) - 8
        : (anchor === "start" ? width - lp.x : lp.x) - stepBack - 2;
    const room = Math.max(labelRoom, Math.min(compact ? 120 : 180, toEdge));
    const labelBottom =
      where === "below" ? lp.y + lineBlock : where === "beside" ? lp.y + lineBlock / 2 : p.y;
    bottom = Math.max(
      bottom,
      labelBottom + uy * stepBack,
      p.y + size / 2 + uy * stepBack,
      pp.y + ringR + badgeR + uy * stepBack,
      gp.y + ringR + badgeR,
    );
    seats.push({
      a,
      x: p.x,
      y: p.y,
      ux,
      uy,
      tile: size,
      seg: arcPath(cx, cy, a - half + AIR, a + half - AIR, r),
      tick:
        i === 0 ? [polar(cx, cy, a, r - size / 2 - 5), polar(cx, cy, a, r - size / 2 - 12)] : null,
      person: { ...pp, out: { x: Math.cos(rad(a + da)), y: Math.sin(rad(a + da)) } },
      gap: { ...gp, out: { x: Math.cos(rad(a + half)), y: Math.sin(rad(a + half)) } },
      label: {
        x: lp.x,
        y: lp.y,
        anchor,
        side: where,
        nameChars: Math.floor(room / nameWidth),
        ownerChars: Math.floor(room / 6.4),
      },
      step: { x: ux * stepBack, y: uy * stepBack },
    });
  }
  return {
    width,
    height: Math.ceil(bottom + 8),
    cx,
    cy,
    compact,
    r,
    rc,
    pr,
    ringR,
    badgeR,
    badgeAt,
    rimR: rc + 5,
    markR: rc < 76 ? 7 : 9,
    markAt: rc - (rc < 76 ? 9.5 : 13),
    seats,
  };
}
