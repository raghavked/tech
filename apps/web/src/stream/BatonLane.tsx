/**
 * The baton (design/henosis/explorations/sig-baton-handoff): who drives, drawn as the driver's
 * ring on a hairline lane across the top of the composer, and the handoff drawn as that ring
 * passing between people. The agent sits at the head of the lane on a stitched thread to
 * whoever drives it; the people sit one turn of the ring apart. An offer lifts the ring off the
 * driver, opens it, and rolls it to wait beside the person offered; taking it closes the ring
 * around them; declining raises a stop and it rolls home.
 *
 * The lane folds to nothing while one person is alone in the session and unfolds when a second
 * is present (or a handoff waits). Every step is derived from the kernel's state (`driver`,
 * `handoffs`), never from a click: the seats send `handoff.request`, the two buttons send
 * `handoff.accept` and `handoff.decline`, and the ring moves when the event comes back. Calm
 * and reduced motion keep every end state and skip the travel (styles/baton-handoff.css).
 */
import type { SessionState } from "@henosis/kernel";
import type { Actor, PresenceEntry } from "@henosis/protocol";
import {
  type CSSProperties,
  memo,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { PHONE_QUERY } from "../breakpoints.js";
import type { HenosisClient } from "../client.js";
import { copy } from "../copy.js";
import { useMotion } from "../theme.js";
import { Avatar, useMediaQuery } from "../ui.js";

/** The ring's radius: at a 120 px pitch one seat is one turn (2π · 19.1 = 120). */
const RADIUS = 19.1;
const DEG_PER_PX = 180 / (Math.PI * RADIUS);
/** How much of the ring stays drawn while it is open and in the air. */
const OPEN = 0.62;

/** The lane's geometry in px; the stylesheet reads these as custom properties. */
interface Geometry {
  seat: number;
  pitch: number;
  /** How far short of the receiver the offered ring waits. */
  gap: number;
  pad: number;
  /** From the lane's padding to the first person's centre: the agent's tile and its thread. */
  first: number;
  /** The clear space between an avatar and the end of the thread. */
  stitch: number;
  height: number;
}
const DESK: Geometry = {
  seat: 32,
  pitch: 120,
  gap: 36,
  pad: 16,
  first: 112,
  stitch: 6,
  height: 68,
};
/** On a phone four seats share the composer's width: a seat is two thirds of a turn. */
const PHONE: Geometry = { seat: 30, pitch: 80, gap: 32, pad: 12, first: 64, stitch: 4, height: 66 };

type Step =
  | "rest"
  | "lift"
  | "roll"
  | "offered"
  | "take"
  | "taken"
  | "stop"
  | "bump"
  | "return"
  | "land"
  | "declined";

/**
 * What follows each step and after how long. The clocks are the four springs and two keyed
 * clocks of styles/baton-handoff.css; `hold` is reading time for a sentence, kept under Calm.
 */
const NEXT: Partial<Record<Step, { to: Step; ms: number; hold?: boolean }>> = {
  lift: { to: "roll", ms: 220 },
  roll: { to: "offered", ms: 730 },
  take: { to: "taken", ms: 340 },
  taken: { to: "rest", ms: 2400, hold: true },
  stop: { to: "bump", ms: 200 },
  bump: { to: "return", ms: 160 },
  return: { to: "land", ms: 790 },
  land: { to: "declined", ms: 340 },
  declined: { to: "rest", ms: 2600, hold: true },
};
const WAITING: readonly Step[] = ["lift", "roll", "offered"];
const SETTLED: readonly Step[] = ["rest", "taken", "declined"];
const BESIDE: readonly Step[] = ["roll", "offered", "stop", "bump"];
const UP: readonly Step[] = ["lift", "roll", "offered", "stop", "bump", "return"];
const STOPPED: readonly Step[] = ["stop", "bump", "return", "land", "declined"];
const SPRING: Partial<Record<Step, "travel" | "return" | "close">> = {
  rest: "travel",
  roll: "travel",
  return: "return",
  take: "close",
  land: "close",
};

interface Pass {
  /** The handoff the lane is showing, or null at rest. */
  id: string | null;
  step: Step;
  /** When the offer reached this client, for the wait clock; null for one found on arrival. */
  since: number | null;
  /** Who held the ring when it was offered: the side the pass comes from. */
  home: string | null;
}
const REST: Pass = { id: null, step: "rest", since: null, home: null };

/** A name inside a copy sentence, marked so it can be set in the serif. */
const mark = (name: string) => `\u0001${name}\u0001`;
function rich(sentence: string): ReactNode {
  return sentence.split("\u0001").map((part, i) =>
    i % 2 === 1 ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: the parts of one sentence never reorder
      <span className="serif" key={i}>
        {part}
      </span>
    ) : (
      part
    ),
  );
}

export const BatonLane = memo(function BatonLane({
  s,
  me,
  client,
  presence,
  agentName,
  frozen = false,
}: {
  s: SessionState;
  me: Actor;
  client: HenosisClient;
  presence: PresenceEntry[];
  agentName: string;
  /** Looking back with the scrubber: the lane shows who drives and offers nothing to press. */
  frozen?: boolean;
}) {
  const calm = useMotion() === "calm";
  const phone = useMediaQuery(PHONE_QUERY);
  const g = phone ? PHONE : DESK;
  const name = (id: string) => s.participants[id]?.actor.name ?? id;

  // ---- the handoff on show: the one offered to me first, then mine, then the latest ----
  const pendings = Object.values(s.handoffs)
    .filter((h) => h.status === "pending")
    .sort((a, b) => b.seq - a.seq);
  const pending =
    pendings.find((h) => h.to === me.id) ?? pendings.find((h) => h.from === me.id) ?? pendings[0];
  const pendingId = pending?.id ?? null;
  const pendingForMe = pending?.to === me.id;

  const [pass, setPass] = useState<Pass>(() =>
    pendingId ? { id: pendingId, step: "offered", since: null, home: s.driver } : REST,
  );
  const tracked = pass.id ? (s.handoffs[pass.id] ?? null) : null;
  const status = tracked?.status ?? null;
  const trackedForMe = tracked?.to === me.id;
  const [said, setSaid] = useState("");

  // What the polite region says when an offer starts and when one is declined.
  const offerSaid = !pending
    ? ""
    : pendingForMe
      ? copy.stream.offeredYou(name(pending.from))
      : copy.composer.baton.offersTo(name(pending.from), name(pending.to));
  const declineSaid = tracked
    ? copy.composer.baton.saidDeclined(name(tracked.to), s.driver ? name(s.driver) : null)
    : "";

  // The kernel moves the pass along: a new offer lifts the ring, an answer closes or stops it.
  useEffect(() => {
    const waiting = WAITING.includes(pass.step);
    if (waiting && status === "accepted") {
      setPass((p) => ({ ...p, step: "take" }));
      return;
    }
    if (waiting && status === "declined") {
      setPass((p) => ({ ...p, step: "stop" }));
      setSaid(declineSaid);
      return;
    }
    if (waiting && status === null) {
      setPass(REST);
      return;
    }
    if (pendingId === null || pendingId === pass.id) return;
    if (SETTLED.includes(pass.step) || (waiting && pendingForMe && !trackedForMe)) {
      setPass({ id: pendingId, step: "lift", since: Date.now(), home: s.driver });
      setSaid(offerSaid);
    }
  }, [
    pass.id,
    pass.step,
    status,
    pendingId,
    pendingForMe,
    trackedForMe,
    offerSaid,
    declineSaid,
    s.driver,
  ]);

  // Each step hands over to the next on its clock; under Calm only the reading holds remain.
  useEffect(() => {
    const next = NEXT[pass.step];
    if (!next) return;
    const from = pass.step;
    const t = setTimeout(
      () =>
        setPass((p) => (p.step !== from ? p : next.to === "rest" ? REST : { ...p, step: next.to })),
      calm && !next.hold ? 0 : next.ms,
    );
    return () => clearTimeout(t);
  }, [pass.step, calm]);

  // "Bo has the baton": said once, politely, whenever the driver changes after arrival.
  const lastDriver = useRef(s.driver);
  useEffect(() => {
    if (lastDriver.current === s.driver) return;
    lastDriver.current = s.driver;
    if (s.driver)
      setSaid(copy.stream.hasTheBaton(s.participants[s.driver]?.actor.name ?? s.driver));
  }, [s.driver, s.participants]);

  // ---- who sits on the lane: the people here, in the order they joined ----
  const online = new Set(
    presence.filter((p) => p.online && p.actor.kind === "human").map((p) => p.actor.id),
  );
  const must = [s.driver, tracked?.to, online.has(me.id) ? me.id : null].filter(
    (id): id is string => !!id && s.participants[id]?.actor.kind !== "agent",
  );
  const order = (id: string) => s.participants[id]?.joinedSeq ?? Number.MAX_SAFE_INTEGER;
  const everyone = [...new Set([...online, ...must])].sort(
    (a, b) => order(a) - order(b) || a.localeCompare(b),
  );

  const lane = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = lane.current;
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // How many seats the lane holds; past that the last slot is a count and the rest wait there.
  const room =
    width > 0 ? Math.max(2, Math.floor((width - g.pad - g.first - g.seat / 2) / g.pitch) + 1) : 4;
  let seats = everyone;
  if (everyone.length > room) {
    const keep = new Set(must);
    for (const id of everyone) {
      if (keep.size >= room - 1) break;
      keep.add(id);
    }
    seats = everyone.filter((id) => keep.has(id));
  }
  const more = everyone.filter((id) => !seats.includes(id));
  const slots = seats.length + (more.length > 0 ? 1 : 0);

  // ---- where the ring is: around the driver, or waiting just short of the person offered ----
  const centre = (i: number) => g.pad + g.first + g.pitch * i;
  const di = s.driver ? seats.indexOf(s.driver) : -1;
  const ti = tracked ? seats.indexOf(tracked.to) : -1;
  const hi = pass.home ? seats.indexOf(pass.home) : -1;
  /** −1 when the receiver sits to the right: the ring stops on their left with its gap facing them. */
  const dir = ti >= 0 && hi >= 0 && ti < hi ? 1 : -1;
  const beside = ti >= 0 ? centre(ti) + dir * g.gap : null;
  const x =
    beside !== null && (BESIDE.includes(pass.step) || di < 0) ? beside : centre(Math.max(di, 0));
  const turn = (px: number) => (px - centre(0)) * DEG_PER_PX;
  // The open ring's gap faces the receiver once it has rolled to its place beside them.
  const dash = beside === null ? 0 : (1 + OPEN) / 2 + (turn(beside) - (dir < 0 ? 0 : 180)) / 360;
  const up = UP.includes(pass.step);
  const rolling = pass.step === "roll" || pass.step === "return";
  const stopped = STOPPED.includes(pass.step) && ti >= 0;
  const threadFrom = g.pad + g.seat + g.stitch;
  const threadTo = di >= 0 ? Math.max(threadFrom, centre(di) - g.seat / 2 - g.stitch) : threadFrom;

  // ---- who may pass it, and to whom ----
  const settled = SETTLED.includes(pass.step);
  const iDrive = s.driver === me.id;
  const mayHandOff =
    !frozen && settled && !pending && (iDrive || s.participants[me.id]?.role === "owner");
  const canTake = (id: string) => mayHandOff && id !== me.id && id !== s.driver && online.has(id);
  const someoneToTake = seats.some(canTake);

  const open = online.size > 1 || pendingForMe || pass.step !== "rest";
  const talking = pass.step !== "rest";

  // ---- the wait clock: only for an offer that reached this client live ----
  const [now, setNow] = useState(() => Date.now());
  const since = pass.step === "offered" ? pass.since : null;
  useEffect(() => {
    if (since === null) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [since]);
  const waited = since === null ? null : Math.max(0, Math.floor((now - since) / 1000));

  // ---- the sentence beside the baton ----
  const who = (id: string) => (id === me.id ? null : mark(name(id)));
  let sentence: ReactNode = null;
  if (tracked) {
    const from = who(tracked.from);
    const to = who(tracked.to);
    if (pass.step === "lift" || pass.step === "roll")
      sentence = rich(copy.composer.baton.handingOff(from));
    else if (pass.step === "offered")
      sentence = rich(
        to === null
          ? copy.stream.offeredYou(from ?? mark(name(tracked.from)))
          : copy.composer.baton.offers(from, to),
      );
    else if (pass.step === "take" || pass.step === "taken")
      sentence = rich(copy.composer.baton.took(to, agentName));
    else if (STOPPED.includes(pass.step))
      sentence = (
        <>
          {rich(to ?? copy.composer.baton.you)}{" "}
          <span className="no">{copy.composer.baton.declinedIt}</span>
          {" · "}
          {rich(
            copy.composer.baton.stillDrives(
              s.driver ? (s.driver === me.id ? null : mark(name(s.driver))) : undefined,
            ),
          )}
        </>
      );
  }
  const atRest = iDrive
    ? copy.composer.baton.youHave
    : s.driver
      ? copy.stream.hasTheBaton(mark(name(s.driver)))
      : copy.composer.baton.nobody;

  const vars = {
    "--seat": `${g.seat}px`,
    "--pitch": `${g.pitch}px`,
    "--pad": `${g.pad}px`,
    "--first": `${g.first}px`,
    "--lane-h": `${g.height}px`,
    "--bx": `${x - 24}px`,
    "--rot": `${turn(x).toFixed(2)}deg`,
    "--dash": dash.toFixed(4),
    "--bump": `${dir * 4}px`,
    "--sx": `${ti >= 0 ? centre(ti) + dir * (g.seat / 2 + 7) - 1 : 0}px`,
    "--thread-from": `${threadFrom}px`,
    "--thread-to": `${threadTo}px`,
    "--rest-from": `${centre(slots - 1) + g.pitch / 2}px`,
  } as CSSProperties;
  // A seat joining or leaving moves the ring with its avatar, at once: only a pass travels.
  const layout = `${phone ? "p" : "d"}:${seats.join("\u0000")}`;
  const agent = Object.values(s.participants).find((p) => p.actor.kind === "agent");
  const laneClass = [
    "baton-lane",
    pass.step === "offered" ? "offered" : "",
    rolling ? "rolling" : "",
    stopped ? "stopped" : "",
    talking ? "talking" : "",
    di < 0 && beside === null ? "unheld" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <div className={`baton-fold${open ? " open" : ""}`} inert={!open}>
        <div className="baton-fold-in">
          {/* biome-ignore lint/a11y/useSemanticElements: a fieldset would bring its own box into the composer's form */}
          <div className="baton-body" role="group" aria-label={copy.stream.baton}>
            <div
              className={laneClass}
              ref={lane}
              data-spring={SPRING[pass.step] ?? "none"}
              style={vars}
            >
              <span className="baton-tracks" aria-hidden="true">
                <i className="baton-track" />
                <svg
                  className="baton-run"
                  aria-hidden="true"
                  key={layout}
                  viewBox="0 0 4000 18"
                  width="4000"
                  height="18"
                >
                  <path d="M0 1H1952Q2000 17 2048 1H4000" />
                </svg>
              </span>
              <i className="baton-thread" aria-hidden="true" />
              <div className="baton-seat head">
                <Avatar
                  id={agent?.actor.id ?? "agent"}
                  name={agentName}
                  kind="agent"
                  status={s.status}
                />
                <span className="label">
                  <span className="who">{agentName}</span>
                </span>
              </div>
              {seats.map((id, i) => {
                const mine = id === me.id;
                const person = name(id);
                const handOff = canTake(id) ? copy.composer.baton.handOffTo(person) : null;
                const inner = (
                  <>
                    <Avatar
                      id={id}
                      name={person}
                      title={handOff ?? person}
                      presence={online.has(id) ? null : "away"}
                      joined={pass.step === "taken" && id === s.driver}
                    />
                    <span className="label">
                      <span className="who">
                        {person}
                        {mine && <i> · {copy.roles.you}</i>}
                      </span>
                      {handOff && (
                        <span className="verb" aria-hidden="true">
                          {copy.details.handOff}
                        </span>
                      )}
                    </span>
                  </>
                );
                const at = { "--i": i } as CSSProperties;
                return handOff ? (
                  <button
                    type="button"
                    className="baton-seat hand"
                    key={id}
                    style={at}
                    aria-label={handOff}
                    onClick={() => client.send({ type: "handoff.request", to: id })}
                  >
                    {inner}
                  </button>
                ) : (
                  <div className="baton-seat" key={id} style={at}>
                    {inner}
                  </div>
                );
              })}
              {more.length > 0 && (
                <span
                  className="baton-more mono"
                  style={{ "--i": seats.length } as CSSProperties}
                  title={copy.composer.baton.more(more.map(name))}
                >
                  <span aria-hidden="true">+{more.length}</span>
                  <span className="sr-only">{copy.composer.baton.more(more.map(name))}</span>
                </span>
              )}
              <i className="baton-stop" aria-hidden="true" />
              <div className="baton-carrier" key={layout} aria-hidden="true">
                <div className={`baton-sag${pass.step === "bump" ? " bump" : ""}`}>
                  <div className={`baton-lift${up ? " up" : ""}`}>
                    <svg className="baton-halo" viewBox="0 0 48 48" aria-hidden="true">
                      <circle cx="24" cy="24" r={RADIUS} />
                    </svg>
                    <svg className="baton-ring" viewBox="0 0 48 48" aria-hidden="true">
                      <circle className="ring" cx="24" cy="24" r={RADIUS} pathLength="1" />
                    </svg>
                  </div>
                </div>
              </div>
              <p className="baton-rest">
                <span>{rich(atRest)}</span>
                {someoneToTake && <span className="pick">{copy.composer.baton.pick}</span>}
              </p>
            </div>
            <div className={`baton-fold line${talking ? " open" : ""}`} inert={!talking}>
              <div className="baton-fold-in">
                <div className="baton-line">
                  <span className="say">{sentence}</span>
                  {waited !== null && (
                    <span className="clock mono" aria-hidden="true">
                      {Math.floor(waited / 60)}:{String(waited % 60).padStart(2, "0")}
                    </span>
                  )}
                  {pass.step === "offered" && tracked && trackedForMe && !frozen && (
                    <div className="acts">
                      <button
                        type="button"
                        className="btn primary"
                        onClick={() =>
                          client.send({ type: "handoff.accept", handoffId: tracked.id })
                        }
                      >
                        {copy.composer.baton.take}
                      </button>
                      <button
                        type="button"
                        className="btn ghost danger"
                        onClick={() =>
                          client.send({ type: "handoff.decline", handoffId: tracked.id })
                        }
                      >
                        {copy.stream.decline}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="sr-only baton-said" role="status" aria-live="polite">
        {said}
      </p>
    </>
  );
});
