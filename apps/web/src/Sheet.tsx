/**
 * The one bottom sheet (design/henosis SCREENS.md §21, COMPONENTS.md §1.10, BACKLOG.md L3).
 * Centred on a desktop; on a phone it rises from the bottom edge on `--surface` with 26 px
 * corners, a 40 × 5 handle, 16 px gutters and the scrim, in two detents: half (the drawer head
 * and the first things) and full (96 px from the top). The foot is a 50 px full-width primary
 * beside a quiet pill and one line of fine print. The gate sheet on the approvals page, the
 * rating sheet on the manager page, the shortcuts sheet and the new-group sheet render through
 * it; the Team | Details drawer, the share and members drawers and the palette share its CSS
 * (`.drawer`, `.palette` take the same rule at 640), so there is one sheet in styles.css.
 *
 * Motion (MOTION.md §10): the sheet follows the finger with no easing while it drags; on
 * release it settles to the nearer detent over `--t-slow`, or closes when pulled past the
 * threshold from the half detent. Escape closes; focus moves into the dialog and back out.
 */
import {
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { copy } from "./copy.js";
import { ICONS, Icon } from "./ui.js";

export type Detent = "half" | "full";

/** Past this many pixels down from the half detent the sheet closes; up from half it goes full. */
export const SHEET_CLOSE_PX = 80;
export const SHEET_LIFT_PX = 60;

/** Where a drag ends: the next detent, closed, or where it started. Pure, for the tests. */
export function settleDrag(detent: Detent, dy: number): Detent | "closed" {
  if (dy > SHEET_CLOSE_PX) return detent === "full" ? "half" : "closed";
  if (dy < -SHEET_LIFT_PX && detent === "half") return "full";
  return detent;
}

export function Sheet({
  onClose,
  label,
  closeLabel = copy.sheet.close,
  detent: initial = "half",
  head,
  primary,
  quiet,
  fine,
  className = "",
  children,
}: {
  onClose: () => void;
  /** The dialog's accessible name. */
  label: string;
  closeLabel?: string;
  detent?: Detent;
  /** The drawer head: the title with the live dot and its summary, a segment where it applies. */
  head?: ReactNode;
  /** The 50 px full-width primary and the quiet pill beside it. */
  primary?: ReactNode;
  quiet?: ReactNode;
  /** One line of fine print under the actions. */
  fine?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const [detent, setDetent] = useState<Detent>(initial);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; dy: number; id: number } | null>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  // Focus lands in the sheet and goes back where it was when the sheet closes.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onClose();
    };
    addEventListener("keydown", onKey);
    return () => {
      removeEventListener("keydown", onKey);
      before?.focus?.();
    };
  }, [onClose]);
  const onDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType === "mouse") return;
    drag.current = { y: e.clientY, dy: 0, id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    d.dy = e.clientY - d.y;
    // Up from the full detent has nowhere to go: hold it there.
    setOffset(detent === "full" ? Math.max(0, d.dy) : d.dy);
  };
  const onUp = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    setDragging(false);
    setOffset(0);
    const next = settleDrag(detent, d.dy);
    if (next === "closed") onClose();
    else setDetent(next);
  };
  const style = dragging ? { transform: `translateY(${offset}px)`, transition: "none" } : undefined;
  // On the body, outside the main column's stacking context, so the toasts never cover it.
  return createPortal(
    <div className="sheet-wrap">
      <button type="button" className="sheet-dim" aria-label={closeLabel} onClick={onClose} />
      <div
        ref={box}
        className={`sheet bsheet ${detent}${className ? ` ${className}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        style={style}
      >
        {/* biome-ignore lint/a11y/noStaticElementInteractions: the handle is a touch affordance; the sheet's close button and Escape are the controls */}
        <div
          className="handle"
          aria-hidden="true"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
        {head !== undefined && (
          <div className="sheet-head">
            {head}
            <button
              type="button"
              className="btn ghost icon sm close"
              aria-label={closeLabel}
              onClick={onClose}
            >
              <Icon d={ICONS.close} size={14} />
            </button>
          </div>
        )}
        <div className="sheet-body">{children}</div>
        {(primary || quiet || fine) && (
          <div className="sheet-foot">
            {(primary || quiet) && (
              <div className="acts">
                {primary}
                {quiet}
              </div>
            )}
            {fine && <p className="fine">{fine}</p>}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
