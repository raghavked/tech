/**
 * The phone's rating control (SCREENS.md §21 "The star tile", COMPONENTS.md §3.8): five tiles in
 * a 48–50 px grid with 12 px corners. Off tiles sit on `--surface-2` at .55; the tiles up to the
 * pick wear `--apricot-soft` with the star in apricot-deep; the pick is solid apricot with a
 * chocolate star and the team glow. The words (Not yet · Risky · Fine · Good · Ship it) sit in
 * the labels and name each radio ("4 of 5, Good"), so the same locators find a star here and in
 * the desktop control. The serif line under the grid says what the pick does: "Good · 4 of 5",
 * or "4 if you leave it" while nothing is picked. A second tap on the pick clears it.
 */
import { type KeyboardEvent as ReactKeyboardEvent, useRef } from "react";
import { DEFAULT_RATING } from "../approvalsQueue.js";
import { copy } from "../copy.js";
import { ICONS, ratingLevel } from "../ui.js";

export function StarTiles({
  value,
  onChange,
  label = copy.rating.yourRating,
  readonly = false,
  word = true,
}: {
  value: number | null;
  /** `0` clears the pick (a second tap on the picked tile). */
  onChange: (n: number) => void;
  label?: string;
  /** Submitted: the tiles locked at the rating given. */
  readonly?: boolean;
  /** The serif line under the tiles. */
  word?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const focusAt = value ?? DEFAULT_RATING;
  const pick = (n: number) => {
    if (readonly) return;
    onChange(value === n ? 0 : n);
  };
  const onKey = (e: ReactKeyboardEvent<HTMLButtonElement>, n: number) => {
    if (readonly) return;
    let next: number | null = null;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
        next = Math.min(5, n + 1);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        next = Math.max(1, n - 1);
        break;
      case "Home":
        next = 1;
        break;
      case "End":
        next = 5;
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        pick(n);
        return;
      case "0":
        e.preventDefault();
        onChange(0);
        return;
      default:
        if (/^[1-5]$/.test(e.key)) {
          e.preventDefault();
          onChange(Number(e.key));
        }
        return;
    }
    e.preventDefault();
    refs.current[next - 1]?.focus();
  };
  return (
    <div className={`star-tiles-wrap${readonly ? " locked" : ""}`}>
      <div className="star-tiles" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          // biome-ignore lint/a11y/useSemanticElements: a tile is a drawn button; the group is the radio control
          <button
            type="button"
            key={n}
            role="radio"
            ref={(el) => {
              refs.current[n - 1] = el;
            }}
            className={`star-tile${value !== null && n < value ? " upto" : ""}${value === n ? " pick" : ""}`}
            aria-checked={value === n}
            aria-label={copy.rating.name(n)}
            aria-disabled={readonly || undefined}
            tabIndex={n === focusAt ? 0 : -1}
            onClick={() => pick(n)}
            onKeyDown={(e) => onKey(e, n)}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d={ICONS.star} />
            </svg>
            <span className="w">{copy.rating.word(n)}</span>
          </button>
        ))}
      </div>
      {word && (
        <span
          className={`tile-word serif${value ? ` ${ratingLevel(value)}` : " none"}`}
          aria-live="polite"
        >
          {value
            ? `${copy.rating.word(value)} · ${copy.approval.picked(value)}`
            : copy.approval.ifYouLeaveIt(DEFAULT_RATING)}
        </span>
      )}
    </div>
  );
}
