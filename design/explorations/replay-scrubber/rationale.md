# Replay scrubber: rationale

**Decision: a 24 px strip under the top row, one dot per turn, a native range input as the handle, and one label line that holds "Viewing turn 9 of 14" and the Return to now button.**

The log is already replayable, so time travel is a view, not a feature, and the control should weigh like one. An `<input type="range">` gives dragging, arrow keys, Home/End and `aria-valuetext` for free; its track is made transparent and the dots are a decoration behind it. Dots are spaced by turn, not by clock time, because a silence is not a turn. In the past the column folds the log up to that turn (the approval is pending again), turns ahead go hollow, and the composer stays in place but goes quiet and loses its send arrow, so Return to now is the one accent on screen. The apricot crease drops under the strip: what is below is not live.

**Rejected.** A timeline drawer on the right (too much chrome for one number). A mark per event rather than per turn (hundreds of marks; the turn is the unit people reason in). A floating "you are in the past" banner (a second box in a stream that allows only notices).

**Carry into the product.** The dot vocabulary (solid, hollow, larger for decisions), the folded-log column with its "5 more turns after this" divider, the quiet composer, Fork from here beside Return to now, and Esc as the way back.
