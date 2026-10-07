# Command palette · notes

## The idea
⌘K opens one lit surface over whatever page you were on; the page stays in view behind a navy scrim so you never lose where you are, and a scope chip in the query bar names the session the Actions belong to. Five groups in one fixed order (Actions, Switch session, Go to, People and agents, Team memory) answer the five questions a person has mid-session: what can I do here, where else is live, where do I go, who is on this, what do we already know; the typed letters are drawn in ink where they matched and the rest of the label steps back, so a three-letter query reads as a sentence, not a list of hits. The highlighted row says what Enter will do and, for a release-gate approval, shows the rating step inline (four stars, "Enter alone sends 4", who rated already), so the two-step prompt the app runs is visible before you commit.

## What to keep
- The group order and the per-group count beside the title, with a quiet right-aligned "why" (on this session · on what matched · Payments) instead of a second heading.
- Match highlighting as weight and ink (`b` in `--match`, the rest in `--rest`), never a yellow background; works in both themes and inside serif names and mono keys.
- Names in Instrument Serif inside rows (people, agents, projects, sessions) and keys in JetBrains Mono; the row itself stays in Sans, so the three fonts carry the three kinds of thing without icons doing all the work.
- Selection as the pulse: a 11–30% apricot wash plus a hairline ring, the row icon turning to the hand colour, and the ↵ key appearing only on the highlighted row (the grey hint word hides); hint words on every other row (project · page · person · memory).
- Status on session and agent rows is the same `.status` dot as the rail (running green, awaiting amber), lifted two steps in dark.
- The release-gate action carries the `irreversible` pill in the danger wash and a second line with the stars; the mobile version drops "Bo already rated 4" and keeps the stars.
- The scrim: navy 42% on cream, near-black 50% on dark, no blur (blur doubled the PNG weight and added nothing). Dark palette surface `#242C3C` with a 1px top highlight and a 6% hairline instead of a shadow halo.
- Footer key legend (↑↓ move · ↵ run · ⇥ next group · esc close) with the mark and "11 of 38 across Payments" on the right; the legend keeps only move/run/close at phone width.
- Mobile: the palette becomes a bottom sheet with a handle and safe-area padding; subtitles hide and labels ellipsise; the rail is gone and the page behind still shows.

## Open questions
- "People and agents" does not exist in the app's palette today (palette.tsx has actions, sessions, places, memory). Should a person row open their profile, their current session, or a chat with them? Should an agent row open its session or its card in the rail?
- Tab as "next group" is a proposal; the app has only ↑↓ and Enter. Is a group jump worth a key, or should ⇥ scope the query (`>` for actions, `@` for people, `#` for projects) instead?
- Memory hits open the project or team they belong to today; the row here makes the entry itself look openable. Should a memory hit expand inline (full content, attribution, conflicts) with a second Enter to go?
- The empty state (just opened, nothing typed) shows Actions and Switch session only. Should it also show "Recent" (the three sessions you were last in) and the two newest memory entries, so the palette is useful before a letter is typed?
- The scope chip names the current session; on the manager overview or a project page it would name that place. Is that the right reading, or should it say what the Actions group is for ("Actions · this session")?
- In dark the rail behind the scrim nearly vanishes; is 50% the right weight, or should the scrim be lighter on dark so the frame still reads as the room you are in?
