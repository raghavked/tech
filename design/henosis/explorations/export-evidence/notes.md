# Export and evidence · notes

## The idea
Export is one sheet with three doors, and what goes through any of them is the ledger and nothing else: a Markdown document for people (the PR, the wiki, the handoff), an audit view for the reviewer who was not in the room (who planned, rated and approved what, in one signed ledger), and a compliance bundle for the machine (every event of the log, signed, with the hash CI replays to). The audit view is previewed as the paper it becomes: a mark and a date line, the title, project, team and the policy the session ran under, six counts (plan approved, gate granted, ratings, unites, tokens of budget, people and agent), then one row per act with the time in mono, the person in serif with their role at that moment, the act in plain words with its note as an italic quote, and the evidence at the right edge (stars and the number, the event id, the commit, or a green check with "fold" where the kernel decided). The include list says what leaves and what stays (team chat stays in the circle by default; secrets are masked and counted), the verify line says the export replays to the same hash, and the export itself is recorded, so "Bo exported the audit view" is one more row in the ledger it came from.

## What to keep
- Format as three labelled cards with the file name in mono and the size on the right; the chosen one takes the apricot glow and a chocolate tick. The cards and the preview tabs are the same radio, so picking either moves both (CSS only, no script).
- The audit record's row grammar: time · who (serif name, role as it was then: owner, contributor, driving, observer, agent, kernel) · did · evidence. Kernel rows ("Plan approved", "Gate granted") in green with the rule that produced them stated inline; a release-gate ask carries the navy→chocolate stripe used by the gate notice in the stream.
- Stars drawn as five glyphs plus the number in mono, exactly as the rating control and the gate ledger draw them, so a rating looks the same in the stream, the queue and the PDF.
- The six count tiles in mono with short labels, in two rows of three, so the record can be read in one glance before the rows.
- The include list with the reason beside the off item ("stays in the circle"), the masked-secrets count in amber on the tool-steps row, and the event count at the section's right edge.
- The verify line in green: "Replays to the same hash." with the sha in mono; the signature row at the foot of the paper: signed by henosis serve, key name, sha, page n of 6.
- The hint under the primary button: exports are themselves recorded, in the voice ("Bo exported the audit view.").
- Bundle contents as plain cards (log.jsonl, audit.json, session.md, policy and usage and the replay hash) with one sentence that nothing in it needs Henosis to read.
- Mobile: rail gone, the sheet stacks, cards go to one column with the size under the text; the preview follows below the options.

## Open questions
- Who may export what: can an observer take the compliance bundle, or only owners and leads; and should the policy name the role per format?
- Team chat is off by default and the note says why; is there a case (a dispute, a retro) where the owner can include it, and does each author get a say?
- The audit record names the role a person had at the moment of each act; the roster at the end should also list the final roles. Is one table enough, or does a reviewer want a "who could have voted" list per gate, as the drawer shows?
- Secrets: masked in tool results by the server's redaction rules; should the record list which rules fired, so a reviewer can tell a masked token from a missing one?
- The scope "main only" drops branches that were never united; a reviewer may want the branches that were abandoned, with why. A fourth scope, "everything including forks", or a checkbox?
- Does the Markdown copy include tool results in full or folded to one line each, and is that a per-export choice or a session policy?
- The signature: one key per team (payments-01) or one per server; and does the PDF carry a verification URL or only the hash?
