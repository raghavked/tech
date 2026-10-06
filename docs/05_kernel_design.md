# Kernel design: the deep tech

Henosis's claim is that a multiplayer agent session is a well-defined object with
deterministic semantics, not a chat thread with more people in it. This document states
those semantics. The code is `packages/kernel`; every rule here has a test.

## 1. Session as a hash-chained, branchable log

A session is an append-only log. Each event commits to its predecessor by hash, so the
history is tamper-evident, and recorded model and tool outputs make replay a pure fold.
Two properties follow and are tested:

- **Determinism.** `fold(events)` equals `fold(tail, fold(prefix))` for any split. The
  server, the CLI and the browser compute the same state from the same events.
- **Resumability.** A runner that dies mid-turn is replaced by one that reads the open turn
  from the state, finishes the tool calls the model already chose, and carries on.

Branches share prefixes. A fork is a pointer to a checkpoint event in the parent plus new
events; it costs nothing to create and nothing to keep.

Prior art: Temporal and Restate journal activity results and replay deterministically for a
single input stream; certificate transparency logs give tamper evidence. Henosis applies both
to a session with many concurrent human inputs. (See `10_sources.md` for references.)

## 2. Intent arbitration: concurrent humans, one unambiguous intent

The problem no shipped product solves: two people tell one agent different things at once.
Every vendor either serializes messages into the transcript (and lets the model guess) or
gives one person a read-only link. The multi-user LLM literature finds that frontier models
do not keep stable priorities under conflicting principals, so precedence must be a kernel
policy, decided before the model sees anything.

Henosis represents the team's intent as a lattice-shaped value:

| Component | Type | Merge rule |
|---|---|---|
| Constraints | grow-only set | union; constraints never conflict |
| Goal | register | arbitration (below) |
| Steer per scope | register per scope | arbitration (below) |
| Control | last-writer among authorised | pause (contributor+), resume and cancel (driver+) |

A **directive** carries `mode` (steer, constrain, pause, resume, cancel), `scope` (free-form,
`goal` by default), optional explicit `supersedes`, and `interrupt`. The kernel records the
author's authority rank at submission and the **epoch**: the number of agent turns started
so far. Two directives on the same scope are *concurrent* when they share an epoch (the agent
has not acted between them) or when either arrived through a merge.

Arbitration, per scope, in order:

1. **Same author:** latest supersedes earlier.
2. **Different rank:** the higher rank wins whether earlier or later; the lower directive is
   *shadowed* (recorded, visible, not applied), so an owner cannot be silently overridden by
   a contributor and a contributor's suggestion is never lost.
3. **Same rank, not concurrent:** the later one is a redirect and supersedes the earlier.
4. **Same rank, concurrent:** a **contention**. The scope is frozen and surfaced to the
   team; the agent keeps working on every other scope. A contention on `goal` blocks the
   session. A driver or owner resolves it by picking a winner, writing a replacement, or an
   author withdraws. Policies `latest-wins` and `driver-wins` exist for teams that prefer
   speed to discussion.

The property that makes this safe to compute on every replica without coordination:
**within an epoch the composed intent does not depend on the arrival order of directives
from different authors.** `test/intent.test.ts` runs 300 seeded random interleavings per
trial set and asserts equality of goal, steers, constraints, control, contentions and
statuses. This is the intent-level analogue of convergence in operational transformation,
with intention preservation provided by the contention mechanism instead of a transform:
when two intentions cannot both be preserved, the kernel refuses to pick.

The composed intent is rendered to the model as a short, stable system fragment: goal,
direction by scope, standing constraints, and scopes under discussion the model must not act
on. The scripted model demonstrates the contract: a contended scope never reaches the plan.

## 3. Authority and approvals

Authority is a lattice: observer < contributor < driver < owner. The **driver** is a
transferable token held by exactly one human; it lifts a contributor to driver rank. Owners
assign roles; drivers and owners resolve contentions, merge, resume and cancel; contributors
steer, constrain, pause, fork and vote; observers watch and ask for briefs.

Every tool has a risk class: `read`, `write`, `exec`, `external`, `irreversible`. A session
policy maps each class to an approval rule: none, one contributor, one driver, one owner, an
M-of-N quorum of a role, or a **release gate** `{ ratings: { min, average, of } }` that grants
only when `min` approvals from people at `of` or above carry ratings averaging `average` or
more. The default requires one contributor for `exec`, the driver for `external`, and a gate
of two contributors at 4+ for `irreversible`. Only humans vote; a deny by any eligible voter
denies; an unrated approve under a gate is a voice, not a vote; votes are events bound to the
approval id, which is derived from the content hash of the exact call. "Two people approving
two different realities" cannot happen because the thing approved is the hash.

### Plans

With `planFirst` on, the agent may read but not change anything until a plan for the current
goal is approved. The agent proposes (`plan.proposed`: steps with a title, detail, a token
estimate and a risk class); humans at contributor rank or above rate it 1..5 (`plan.rated`,
one rating per person); the reducer marks the plan approved with `decidedBy: "policy"` the
moment the policy's `planApproval { min, average }` is met. No second event is written for
that: the approval is derived in the fold, so every replica agrees on when the bar was met.
The driver or an owner may decide outright (`plan.decided`: approved, revise, rejected). A new
proposal supersedes the active plan, whatever its status, and the plan is keyed to the goal
text, so a changed goal needs a new plan. `gateForCall(state, call)` is the one function the
runner asks; it refuses every call above `read` with a tool result the model reads.

Steps run one at a time: `plan.step.started` when the agent moves to a step (or the runner
starts the first pending one), `plan.step.completed` with the tokens spent since it started,
computed from the session's running usage total, which the reducer sums from every
`agent.model.completed`. The plan is done when every step is. Token budgets are soft: the
agent is told what it has spent; nothing is cut off.

## 4. Fork and merge

Anyone with contributor rank can fork at a checkpoint (an implicit checkpoint is taken at the
head if needed). A branch has its own participants, directives, turns and runner. Merging
back requires the driver or an owner and does three things:

- **Workspace:** three-way merge against the tree at the fork checkpoint, file by file, with a
  line-level diff3 for files both sides changed. Conflicts are written with markers and
  recorded as open conflicts that block the agent until a human or the agent rewrites the
  file. Delete-versus-modify keeps the modification and flags it.
- **Directives:** constraints are unioned by text. Steers active on the source for scopes the
  target did not steer carry over. Steers for scopes both branches steered differently enter
  arbitration as *merged* directives, i.e. concurrent with the target's, so peers produce a
  contention rather than a silent override. The session test "forks, diverges, and merges"
  covers all three outcomes.
- **Provenance:** the merge event records the base checkpoint, the resulting tree, the
  conflicts, and every carried directive with its original author and rank.

Context merge in phase 1 adds a journaled summarizer call so the merged session still
replays.

## 5. Handoff and the brief

The driver (or an owner) offers the seat; the recipient accepts or declines; acceptance is
the authority-transfer event. The **handoff brief** is computed from the log, not generated:
situation (goal, direction, constraints), open items (contentions, pending approvals,
pending handoffs, merge conflicts, shadowed suggestions), what the agent did in recent turns
with new turns marked, decisions and files changed since the recipient was last present, and
the workspace. It follows the I-PASS structure that cut medical handoff errors by about a
quarter in the NEJM 2014 study. Phase 1 adds receiver synthesis: the incoming driver restates
the plan and that acknowledgement is journaled before authority moves.

## 6. Presence

Presence (who is here, on which branch, doing what) is ephemeral, broadcast on change, and
never logged. Joins, leaves and role changes are logged because they change authority.

## What is deliberately simple in phase 0

Scopes are declared by the author; a classifier can propose them later. Conflict detection is
by scope, not by semantic overlap of text. The merge of agent context is structural, not
LLM-assisted. Authentication is a shared token. None of these change the semantics above;
they are the places where product polish goes once the semantics have been validated with
teams.
