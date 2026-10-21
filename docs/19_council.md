# The council: a team's models deliberate together

Henosis's differentiator. Every member of a team has a model of their own, the agent they
bring to the circle: a person's agent, a manager's agent, a team's shared agent. A **council**
convenes several of them on one task so they deliberate the way a good team does: each
answers alone first, then they discuss as a group, then a chair writes the plan the team
rates, and the work is split among the members' agents who report back into the same room.
People sit in the room throughout: they brief, they interject, they instruct an agent in
private, they rate, they decide. Compared with a single assistant or a one-model answer, a
council gives a team several perspectives it chose itself, a record of who argued what, and
a plan with named owners.

## Where it stands

This document is the design. What is built: the eight council events and their fold in
`packages/chat` (`council.ts`, `councilProtocol.ts`, which says what round is due next), the
wire commands `chat.council.convene`, `chat.council.instruct` and `chat.council.end` that
the server records into the group's log, the member profiles (`agent` on a `users.json`
row, shared agents in `agents.json`), and the prompts, the synthesis tool and the parsers in
`packages/runner/src/council.ts`, with the scripted model answering every round offline; the
host that runs the rounds (packages/server); the rooms in the web app; the Slack and CLI
commands; and "My agent" in Settings. The sections below describe each as it works, and
"Status" at the end says where every part is tested.

## Vocabulary

- **Member model**: the agent a member brings. Its *profile* (provider, model id, persona,
  tools, budget) belongs to the member and will be edited in Settings → My agent. A manager's
  profile defaults to the chair's manners. Profiles live in `users.json` (`agent` field) and
  in the org's `agents.json` for shared team agents.
- **Council**: a deliberation convened in a group (packages/chat) on one task, with a chair,
  a set of member models, a round plan and a budget. One council is one chain of events in
  the group's chat log, so it replays and its spend is counted.
- **Round**: *individual* (each model answers alone, in parallel, without seeing the others),
  *discussion* (each model reads every answer and replies: agree, differ, add, with reasons),
  *synthesis* (the chair writes the plan: steps with estimates and an owner each), *vote*
  (people rate the plan with the ordinary plan ratings; the chair's own model does not vote).
- **Assignment**: a step owned by a member model becomes a directive in that member's
  session (a crew is created for the council's task); progress and the step's result are
  posted back into the council as the agent's report.
- **Instruction**: a human's private message to one model during a council (a one-to-one
  room with that agent), which lands as a steer in that agent's session and is cited in the
  model's next council message as "instructed by Ana".
- **Dissent**: a model that disagrees with the synthesis records it; the council's conclusion
  carries the dissent beside the plan.

## Events (packages/chat, in the group's log)

```
council.convened   { councilId, groupId, task, chair: Member, members: Member[], rounds: ["individual","discussion","synthesis","vote"], discussionRounds: 1, budget: number|null, by: userId }
council.round.started { councilId, round, index }
council.said       { councilId, round, index, member: Member, text, usage, cites: [{kind:"instruction", by}], stance?: "agree"|"differ"|"add" }
council.instructed { councilId, member: Member, by: userId, text }          // private; visible to the instructed member's owner and the chair
council.synthesised { councilId, planId, steps: [{id,title,detail,estTokens,risk,owner: Member}], dissent: [{member, text}] }
council.assigned   { councilId, stepId, owner: Member, projectId, sessionId }
council.reported   { councilId, stepId, owner: Member, status: "done"|"blocked"|"revised", text, usage }
council.concluded  { councilId, outcome: "done"|"abandoned"|"revised", summary, usage }
```

The plan the chair writes is a real plan (`plan.proposed`) in a council session owned by the
chair, so the existing ratings, release gates and token accounting apply unchanged. Votes
are plan ratings; the policy's `planApproval` decides.

## Orchestration (packages/server, the council host; owed)

The host will run the rounds. Today the server records what a person convenes, instructs
and ends; nothing calls a model between those events. An individual round calls every
member model in parallel with the task, the group's recent messages and that member's
instructions, records each answer as
`council.said`, and sums usage against the budget. A discussion round gives each model the
others' answers. Synthesis calls the chair's model with every answer and dissent and asks for
steps with owners from the member list; the host opens the council session, proposes the
plan, and waits for ratings. When approved, each step is assigned: a session is opened or
reused for the owner (their member session in the project, in a crew named for the council)
with a directive `council <id> step <n>: <title>`, and the host relays each session's next
turn summary back as `council.reported`. When every step reports done, the host concludes.
A council stops early when the budget is spent, when the convener ends it, or when a round
has no answers.

Member models run through the same `Model` interface as sessions (`packages/runner`): the
scripted model answers deterministically offline (a stance from a hash of task and member);
the Claude model uses the member's profile (`ServerOptions.modelFor` picks the model for a
profile; by default a `claude` profile gets the Claude model it names when a key is set,
everything else the server's model). Usage from every call is `council.said.usage` and rolls
into the usage API as `byCouncil`: one row per person, the words of the models they own plus
those of a shared agent in a council they convened, counted in `totals` and in their `byUser`
row and in "tokens today"; the assigned work is counted with its sessions as before.

The host is one loop per council that asks `councilNext` what to do and sleeps until an
event touches the council (a chat event, a plan event in the council session, a turn ending
in a member session), so a restart resumes every council that has not concluded from the
log alone. An instruction that lands while a member's model is already thinking is carried
into that member's next round and cited there. Sessions live in the group's project (else
the first project of the group's team, else the org's first): the council session is
`council_<hash>` with the chair's owner as owner and `planFirst`, each owner's member
session `member_<hash>`, all in the crew `Council: <task>`. A member whose model fails
answers "No answer: <reason>" with no usage; a round in which nobody answered ends the
council.

`GET /api/chat/:org/councils/:id` returns the council's fold with its label, what the chair's
session says of the vote (`vote`, `plan` with its ratings), what the protocol does next and
the member sessions by profile; `GET /api/chat/:org/councils` lists them, latest first.

## Rooms (apps/web)

- **Convene** from any group: task, members (people's and managers' agents, shared agents,
  from the org's profiles; a manager's agent says so), chair (defaults to the convener's
  manager's agent, a model whose owner manages a team the convener is in, else the convener's
  agent; any model may chair, and a chair outside the members only writes the plan), rounds,
  budget. The council appears as a threaded room inside the group. The directory
  (`GET /api/chat/:org/directory`) carries each person's teams and the teams each model's
  owner manages, so the sheet can propose the chair; a person users.json does not know is
  in every team of the org, on trust.
- **Council view**: the task at the top; rounds as sections; in the individual round each
  model's answer is a column card with its owner's name and model; in discussion, replies in
  the stream with stances as words; the synthesis as a plan card with owners; the vote as
  the plan card's ratings; assignments as agent cards with live status; the conclusion with
  dissent. A side panel lists members with their models and a private "Instruct" box per
  model. Usage meter for the council.
- **Instruct**: a one-to-one room with a model, opened from the member list; messages land
  as steers in that agent's session and are cited in its next council message.
- The rail shows a council as a live agent card group under its group name: "Council ·
  4 models · discussion 1 of 1".

## Slack and CLI (owed)

`/henosis council <group> <task>` convenes a council of the group's people's agents (the
group by id or by name, dashes for spaces; the convener must be a member; their agent chairs).
The council's root message lands in the group's channel (the project's, else the team's,
else management) and every round posts into its thread: the round's opening line, then each
word as that model, with the member and its model named ("*Ana's agent* (scripted)") and the
stance a word in a discussion. The synthesis posts the chair's plan with an owner per step,
the dissent beside it, and five rating buttons; a star rates the plan in the chair's council
session exactly as the app's plan card does, and the message edits in place as the ratings
land and when the policy decides. Assignments and reports are lines in the thread; the
conclusion posts with the dissent on the record. A private instruction never reaches Slack.
A council convened from the app posts the same way, since the adapter follows the chat log.

`henosis council <org> <id> [--dir ./store]` prints a council's members, rounds, plan with
dissent, work and conclusion from the organisation's chat log; without an id it lists the
org's councils. `henosis report` gains a Council section: a chat log (`store/chat/<org>.json`)
reports its groups and every council; a session log with `--chat <chat.json>` carries the
councils whose work ran in that session.

## Why it is new

Model councils answer one question with several vendors' models and a synthesis. Henosis's
council is a team's own models, each with an owner who can instruct it in private, with the
plan rated by people, the work assigned to the models that proposed it, their reports in the
same room, and every word and token in a replayable log. The council is the unit of
cooperation between a team's people and its agents, not a feature of a chat box.

## Status

- **Core (packages/chat, packages/fleet, packages/runner)**: the eight events, the reducer and
  the protocol (`councilNext`), the convene / instruct / end wire messages, member profiles in
  `users.json` and `agents.json`, the council prompts and the scripted model's deterministic
  stances. Tested offline.
- **Slack (packages/slack)**: `/henosis council <group> <task>`, the rounds in the group's
  thread with the member and model named, the synthesis with rating buttons that rate the
  chair's plan in its session, assignments and reports as lines, the conclusion with dissent.
  Tested against the in-memory `FakeSlackClient`.
- **CLI (packages/cli)**: `henosis council <org> [<id>]` and the Council section of
  `henosis report`, both rendered from the folded chat log.
- **Host (packages/server)**: the council host that runs the rounds, opens the chair's
  session, assigns the steps and concludes; `GET /api/chat/:org/councils[/:id]`.
- **Rooms (apps/web)**: the convene sheet from a group (members from the org's profiles, the
  chair proposed as above), the council room with the rounds as sections, the plan card with
  owners and ratings, the assignments as live agent cards and the conclusion with dissent,
  the members panel with an Instruct box per model, the one-to-one Instruct room, and the
  rail card "Council · 4 models · discussion 1 of 1". Walked end to end by
  `apps/web/test/flows.spec.ts` against the scripted model.
