# Organisation memory: what the fleet knows, and who said so

*Design note for `packages/memory`, built 2 October 2026. Research summarised at the end;
sources in `10_sources.md`.*

## The problem

Every agent an engineer starts begins ignorant of what every other agent on the team already
learned: where things live, which conventions hold, which decisions were taken and why. The
products that share memory today either attribute an entry to a session (Anthropic's
memory stores), to a scope id (Mem0), or to nobody (Claude Code auto memory), and when two
entries contradict they pick one, in the docs' own words, "arbitrarily" or "latest wins".
Nobody surfaces "fact X (added by Ana) contradicts fact Y (added by Bo)" to a human, and
nobody carries attribution through compaction.

## The model

Organisation memory is a hash-chained ledger per organisation, folded into state the same
way sessions and projects are. An **entry** is a fact, decision or convention with a scope
(org, team, project, optional path prefix), an optional topic key, content, tags, evidence,
a trust tier (agent, human, commit) and an **attribution**: the engineer it belongs to, the
agent and session that wrote it, and the commit that introduced it when known. When an
agent writes, the project host maps the session to its owner at write time, so the entry
is Ana's even though Ana's agent typed it.

Three rules replace "latest wins":

1. **Same author, same key, same scope: supersede.** Ana's new entry on `db.engine`
   replaces her old one; the old one stays in the ledger as superseded.
2. **Different authors, same key, same scope: conflict.** Both entries stay active and a
   conflict entry is opened. Readers see both, attributed, under a "conflicts" heading,
   and the agent is told to ask before relying on either. A lead resolves; the loser is
   superseded with a note. Conflicting entries are never compacted.
3. **Narrower scope wins on the same key.** A project's `api.style` shadows the org's for
   readers in that project and nowhere else.

Retraction is a first-class, authored entry with a reason (a tombstone), not a deletion.
Redaction blanks content and keeps the row, the author and the time.

Compaction follows the log-structured merge idea the founder asked for, applied as an audit
structure rather than only a performance one: level 0 holds raw entries; when a scope's
level grows past a threshold the curator folds it into one level-1 summary that cites every
entry id and author it folded (tags `by:ana`, `by:bo`) and inherits the highest trust among
them; folded entries stay readable in the ledger. The summariser is pluggable; the default
is deterministic, and an LLM summariser's output is journaled the same way so replay never
calls a model.

Reads are journaled too. The **curator**, the organisation's long-lived driver, runs a loop:
compact scopes that grew, flag agent-written entries unread past the policy window and
propose their retraction for a human to approve, and list open conflicts. It is an API-driven
job, not a computer-use agent; every vendor that has a comparable curator converged on the
same shape, and a GUI-driving agent would be slow, unattributable and non-deterministic for
this role.

Injection is budgeted: each session's model sees open conflicts first, then entries from
the narrowest scope outward until the byte budget (24 kB by default, the same order as
Claude Code's auto-memory cap) is spent; one entry per key. Agents also get `memory.recall`
for on-demand search and `memory.remember` for attributed writes.

## Where it lives in the product

The session view shows project memory with "added by Ana · session billing-42 · commit
9f3c1a" on every entry; the fleet board has an attributed memory feed; the management view
shows the curator's report: compactions, stale entries, conflicts awaiting a lead. Slack
shows conflicts in the project channel with both authors named.

## Tests

`packages/memory/test`: scope chain and coverage; attribution, self-supersession and
cross-author conflicts with resolution; narrower-scope precedence, authored retraction and
redaction keeping the trail; compaction into an attributed summary, curator triggering,
trust inheritance and conflict exclusion; stale detection sparing human and commit-backed
entries; recall, knows and the byte budget; deterministic fold and serialisation.
`packages/server/test/memory.test.ts`: an agent's write is attributed to its engineer with
session id, lands in the project scope, and appears with attribution in the context the next
engineer's agent receives.
