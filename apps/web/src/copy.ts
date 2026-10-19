/**
 * Every user-facing string of the web app, in Henosis's voice (docs/15_copy.md): calm, specific,
 * no AI-speak. Views import `copy` and never carry a literal of their own. Strings that take
 * data are functions, so word order and plurals live here too.
 *
 * Grouped by surface: shell (sidebar, account), home, session (top row, stream, steps,
 * approvals, composer, details drawer), project, team, notify (browser notifications) and the
 * five status words.
 */

import { DEFAULT_RATING } from "@henosis/protocol";

/** "1 approval" / "3 approvals". */
export const plural = (n: number, one: string, many = `${one}s`): string =>
  `${n} ${n === 1 ? one : many}`;

/** "1,800 tokens", with the thousands separated the same way everywhere. */
export const tokens = (n: number): string => `${n.toLocaleString("en-US")} tokens`;

/** A rating average with at most one decimal: 4, 4.5, 4.3. */
export const average = (n: number): string => String(Math.round(n * 10) / 10);

/** "Bo", "Bo and Cy", "Bo, Cy and Dee": names in a sentence. */
export const list = (names: readonly string[]): string =>
  names.length <= 1
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

/**
 * The one cast (SYSTEM.md, the cast rule): every example, fixture, preview and board uses these
 * four people, in this order, and an agent is "X's agent". Ids match the e2e identities.
 */
export const cast = {
  ana: { id: "ana", name: "Ana Moreau", short: "Ana" },
  bo: { id: "bo", name: "Bo Lindqvist", short: "Bo" },
  cy: { id: "cy", name: "Cy Okafor", short: "Cy" },
  dee: { id: "dee", name: "Dee", short: "Dee" },
} as const;

/** The rating a plain Approve carries under a release gate: the product's default, one value for the app and Slack. */
export { DEFAULT_RATING };

/**
 * The five words of the rating scale, one per star (rating-control): the word says what the pick
 * does and doubles as the star's accessible name ("4 of 5, Good").
 */
export const RATING_WORDS = ["Not yet", "Risky", "Fine", "Good", "Ship it"] as const;

/** The five status words, the same everywhere (sidebar dot, top row, fleet rows, Slack). */
export const status = {
  running: "Running",
  awaiting_approval: "Awaiting approval",
  blocked: "Blocked",
  paused: "Paused",
  idle: "Idle",
  cancelled: "Cancelled",
  closed: "Closed",
  offline: "Offline",
} as const;

export const copy = {
  product: "Henosis",
  loading: "Loading…",
  roles: { driving: "driving", you: "you" },

  /**
   * Copy for the waits (loading-screens, MOTION.md §5.6): one sentence, present tense, names who
   * and what, never "loading"; counts, not bars; after 8 s a cause, after 30 s one action.
   */
  wait: {
    launch: "Opening the circle.",
    launchSlow: (version?: string) => (version ? `Still opening. ${version}` : "Still opening."),
    connecting: (where: string) => `Connecting to ${where}.`,
    serverSlow: "The server is slow to answer.",
    tryAgain: "Try again",
    joining: (names: readonly string[], where: string) =>
      names.length ? `Joining ${list(names)} in ${where}.` : `Joining ${where}.`,
    folded: (n: number, total: number | null) =>
      total === null
        ? `${n.toLocaleString("en-US")} events folded so far`
        : `${n.toLocaleString("en-US")} of ${total.toLocaleString("en-US")} events folded`,
    longSession: "A long session; the count keeps moving.",
    openReplay: "Open the replay",
    reconnecting: (driver: string | null) =>
      driver ? `Reconnecting · ${driver} still has the baton.` : "Reconnecting.",
    /** "Reconnecting · attempt 3 · again in 4s · the stream is as of 14:02" */
    reconnectLine: (attempt: number | null, inSeconds: number | null, asOf: string | null) =>
      [
        "Reconnecting",
        attempt !== null ? `attempt ${attempt}` : null,
        inSeconds !== null ? `again in ${inSeconds}s` : null,
        asOf ? `the stream is as of ${asOf}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    offlineCause: "Offline. Open the last brief?",
    openBrief: "Open the last brief",
    tryNow: "Try now",
    project: (name: string, inCount: number | null, of: number | null) =>
      inCount !== null && of !== null
        ? `Opening ${name}. ${inCount} of ${of} sessions in`
        : `Opening ${name}.`,
    notAnswering: (n: number) => `${plural(n, "session")} ${n === 1 ? "is" : "are"} not answering.`,
    longOp: (agent: string, what: string) => `${agent} is ${what}. About a minute.`,
    longer: "Longer than expected",
    watchTests: "Watch tests",
    failed: (where: string) => `Could not join ${where}.`,
    composerMuted: "You can type once the history is in.",
    inbox: "Opening your inbox.",
    team: (name: string) => `Opening ${name}.`,
    page: "Opening the page.",
    rows: "The rows are on their way.",
    sendingVote: "Sending your vote.",
    tidying: (org: string) => `Tidying ${org}'s memory.`,
  },

  /** The joining line (welcome-agent, members-drawer, MOTION.md §7): the same sentence for a person, an agent or a session. */
  join: {
    line: (name: string) => `${name} joins the circle.`,
    /** The toast on navy: the same sentence. */
    toast: (name: string) => `${name} joins the circle.`,
  },

  /** The rating scale (rating-control): five words, one accessible name, the number the button sends. */
  rating: {
    words: RATING_WORDS,
    word: (n: number) => RATING_WORDS[Math.min(5, Math.max(1, n)) - 1] ?? "",
    /** "4 of 5, Good": the star's accessible name. */
    name: (n: number) => `${n} of 5, ${RATING_WORDS[n - 1] ?? ""}`,
    yourRating: "Your rating",
    ratePlan: "Rate the plan",
    cleared: "No rating",
  },

  shell: {
    menu: "Menu",
    closeMenu: "Close menu",
    sidebar: "Sidebar",
    newSession: "New session",
    searchSessions: "Search sessions",
    projects: "Projects",
    agents: "Agents",
    memory: "Memory",
    orgMemory: (org: string) => `${org} memory`,
    defaultTeam: "Default team",
    chats: "Chats",
    orgChats: (org: string) => `${org} chats`,
    newGroup: "New group",
    recents: "Recents",
    signIn: "Sign in",
    teamEmblem: "Team emblem",
    // the rail (design/henosis SCREENS.md §1)
    searchOrJump: "Search or jump to",
    newSessionKey: "New session · N",
    inbox: "Inbox",
    approvals: "Approvals",
    live: (n: number) => `${n} live`,
    overview: "Overview",
    groups: "Groups",
    collapse: "Collapse the rail · [",
    expand: "Expand the rail · ]",
    closeRail: "Close the rail",
    noAgents: "No agents running. Start a session and its card appears here.",
    crewOf: (names: string[]) =>
      names.length === 0
        ? ""
        : names.length === 1
          ? (names[0] ?? "")
          : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`,
    agentsOf: (n: number) => `${n} agent${n === 1 ? "" : "s"}`,
    crewsAndSolos: (crews: number, solos: number) =>
      [crews ? `${crews} crew${crews === 1 ? "" : "s"}` : "", solos ? `${solos} solo` : ""]
        .filter(Boolean)
        .join(" · "),
    driving: "driving",
    member: "member",
    missingVoice: "one more voice",
  },

  account: {
    menu: "Account",
    theme: "Theme",
    themeAuto: "Auto",
    themeLight: "Light",
    themeDark: "Dark",
    notifications: "Notifications",
    notifyOn: "On while this tab is hidden",
    notifyOnDesktop: "On while Henosis is in the background",
    notifyBlocked: "Blocked by the browser",
    notifyUnsupported: "Not available here",
    notifyTurnOn: "Turn on",
    notifyShort: "on while hidden",
    calm: "Calm mode",
    on: "on",
    off: "off",
    teamLook: "Team look",
    shortcuts: "Shortcuts",
    settings: "Settings",
    session: "Session",
    exportMarkdown: "Export as markdown",
    changeIdentity: "Change identity",
    signOut: "Sign out",
  },

  home: {
    title: "Home",
    heroTitle: "Many hands, one team. One holds the baton at a time.",
    heroLine: "Watch the course, redirect, hand off.",
    needsIdentity: "Pick an identity to open that page.",
    signedInAs: (name: string) => `Signed in as ${name}`,
    unknownToServer: " · unknown to the server; first in owns a session",
    change: "Change",
    yourName: "Your name",
    userId: "User id",
    userIdHint: "as in users.json",
    token: "Token (optional)",
    tokenHint: "only if the server requires one",
    continue: "Continue",
    cancel: "Cancel",
    projects: "Projects",
    meFailed: (error: string) => `Could not load /api/me: ${error}`,
    noProjects: "No projects for you yet. Ask a lead to add you.",
    open: "Open",
    teamOverview: "team overview",
    project: "Project",
    sessionId: "Session id",
    sessionIdHint: "Open a session by id",
    openSession: "Open session",
    planFirst: "Plan first",
    planFirstHint: "The agent proposes a plan; the team rates it before any work",
    tokenBudget: "Token budget",
    tokenBudgetHint: "tokens, optional",
    // Identity (auth.ts): single sign-on in oidc mode.
    continueWith: (provider: string) => `Continue with ${provider}`,
    ssoLine: (provider: string) => `Your team signs in through ${provider}.`,
    ssoObserver: " · known to the provider, not yet to a team; ask a lead to add you",
    signingIn: "Signing you in…",
    signInFailed: (error: string) => `Could not sign you in: ${error}`,
    signedOut: "Your sign-in ended; continue to pick up where you were.",
    tryAgain: "Try again",
    signOut: "Sign out",
  },

  session: {
    joining: "Joining…",
    connecting: "Connecting…",
    reconnecting: "Reconnecting…",
    present: (names: string[]) => `Present: ${names.join(", ")}`,
    avatarTitle: (name: string, role: string, driving: boolean) =>
      `${name} · ${role}${driving ? " · driving" : ""}`,
    more: (n: number) => `+${n}`,
    presentSummary: (summary: string) => `Present: ${summary}`,
    writing: " · writing",
    share: "Share",
    copied: "Copied",
    details: "Details",
    copyLink: "Copy this link",
    linkCopied: "Link copied",
    copyFailed: "Could not copy the link",
  },

  stream: {
    label: "Conversation",
    empty: "Set a goal to start the agent.",
    note: "note",
    interrupt: "interrupt",
    turnEnded: (turn: number, reason: string, summary: string | undefined) =>
      `Turn ${turn} ${reason}${summary ? ` · ${summary}` : ""}`,
    projectDirection: (who: string, text: string) => `${who} set a project direction: ${text}`,
    picked: (who: string) => `${who} picked a direction`,
    withdrew: (who: string) => `${who} withdrew a directive`,
    offered: (who: string, to: string) => `${who} offers the baton to ${to}`,
    hasTheBaton: (who: string) => `${who} has the baton`,
    declined: (who: string) => `${who} declined the baton`,
    joined: (who: string, role: string) => `${who} joined as ${role}`,
    left: (who: string) => `${who} left`,
    roleChanged: (who: string, role: string) => `${who} is now ${role}`,
    checkpoint: (label: string) => `Checkpoint ${label}`,
    forked: (branch: string, from: string) => `Branch ${branch} forked from ${from}`,
    folded: (source: string, base: string, conflicts: number) =>
      `United ${source} into ${base}${conflicts ? ` · ${plural(conflicts, "conflict")}` : ""}`,
    writeRefused: (path: string, holder: string) => `Write to ${path} refused: held by ${holder}`,
    fleetContention: (kind: string, resource: string, others: string[], resolved: boolean) =>
      `${resolved ? "Resolved: " : "Fleet contention: "}${kind} on ${resource} with ${others.join(", ") || "another session"}`,
    /** "Two directions for <b>scope</b>. The agent holds this scope until you pick one." */
    contentionBefore: "Two directions for ",
    contentionAfter: ". The agent holds this scope until ",
    youPick: "you pick one",
    theyPick: (who: string) => `${who} picks one`,
    pick: "Pick",
    withdraw: "Withdraw",
    offeredYou: (who: string) => `${who} offers you the baton.`,
    accept: "Accept",
    decline: "Decline",
    planDecided: (who: string, status: "approved" | "revise" | "rejected") =>
      status === "approved"
        ? `${who} approved the plan`
        : status === "revise"
          ? `${who} asked for a revised plan`
          : `${who} rejected the plan`,
  },

  /** Plan first: the card in the stream, its ratings and the words around it. */
  plan: {
    title: "Plan",
    heading: (n: number) => `Plan · ${plural(n, "step")}`,
    proposedOn: (turn: number) => `proposed on turn ${turn}`,
    status: {
      proposed: "Waiting for ratings",
      approved: "Approved",
      revise: "Revision asked",
      rejected: "Rejected",
      done: "Done",
    },
    /** The same states as one lowercase word for the progress line. */
    statusWord: {
      proposed: "waiting",
      approved: "approved",
      revise: "revision asked",
      rejected: "rejected",
      done: "done",
    },
    stepStatus: { pending: "pending", running: "running", done: "done" },
    est: (n: number) => `~${n.toLocaleString("en-US")}`,
    used: (n: number) => `${n.toLocaleString("en-US")} used`,
    totals: (est: number, used: number, budget: number | null) =>
      `${tokens(est)} estimated${used ? ` · ${tokens(used)} used` : ""}${
        budget ? ` · budget ${tokens(budget)}` : ""
      }`,
    yourRating: "Your rating",
    rate: (n: number) => `Rate ${n} of 5`,
    noteHint: "A note with your rating (optional)",
    progress: (count: number, min: number, avg: number, status: string) =>
      `${count} of ${min} ratings${count ? ` · ${average(avg)} average` : ""} · ${status}`,
    needs: (min: number, bar: number) => `needs ${min} at ${average(bar)}+`,
    rated: (who: string, rating: number) => `${who} rated it ${rating}`,
    approveNow: "Approve now",
    askRevise: "Ask to revise",
    reject: "Reject",
    decisionHint: "A note with your decision (optional)",
    decidedBy: (who: string) => `by ${who}`,
    byPolicy: "by the team's ratings",
    replaced: "Replaced by a newer plan.",
    planning: "Planning",
    waits: "The plan waits for ratings",
    waitingFor: "ratings on the plan",
  },

  /** What a tool call does, in words: `ask` for the approval sentence, `doing`/`done` for the step. */
  steps: {
    read: (p: string) => ({ ask: `read ${p}`, doing: `Reading ${p}`, done: `Read ${p}` }),
    write: (p: string) => ({ ask: `write ${p}`, doing: `Writing ${p}`, done: `Wrote ${p}` }),
    delete: (p: string) => ({ ask: `delete ${p}`, doing: `Deleting ${p}`, done: `Deleted ${p}` }),
    list: { ask: "list the workspace", doing: "Listing files", done: "Listed files" },
    shell: (cmd: string) => ({
      ask: `run \`${cmd}\``,
      doing: `Running shell: ${cmd}`,
      done: `Ran shell: ${cmd}`,
    }),
    deploy: (env: string) => ({
      ask: `deploy to ${env}`,
      doing: `Deploying to ${env}`,
      done: `Deployed to ${env}`,
    }),
    remember: (key: string) => ({
      ask: `remember ${key}`,
      doing: `Remembering ${key}`,
      done: `Remembered ${key}`,
    }),
    recall: { ask: "recall team memory", doing: "Recalling memory", done: "Recalled memory" },
    claim: { ask: "claim a resource", doing: "Claiming", done: "Claimed" },
    release: { ask: "release a claim", doing: "Releasing", done: "Released" },
    other: (name: string, args: string) => ({ ask: `${name} ${args}`, doing: name, done: name }),
    exitOk: " · exit 0",
    failed: " · failed",
  },

  approval: {
    approved: "Approved",
    denied: "Denied",
    wants: (ask: string, risk: string, rule: string) =>
      `The agent wants to ${ask} (${risk}); needs ${rule}.`,
    vote: (who: string, approve: boolean, rating: number | null = null) =>
      `${who} ${approve ? "approved" : "denied"}${rating ? ` · ${rating} of 5` : ""}`,
    approve: "Approve",
    deny: "Deny",
    releaseGate: "Release gate",
    /** The chip in the top row once the pending gate has scrolled out of view; the number precedes it. */
    waitsForYou: (n: number) => (n === 1 ? "waits for you" : "wait for you"),
    /** A release gate: how many rated approvals there are against the rule's minimum. */
    progress: (count: number, min: number, avg: number) =>
      `${count} of ${min} raters${count ? ` · ${average(avg)} average` : ""}`,
    /** "Approve with 4": the button carries the number it sends. */
    approveWith: (n: number) => `Approve with ${n}`,
    /** The hint beside it while nothing is picked: "4 if you leave it". */
    ifYouLeaveIt: (n: number) => `${n} if you leave it`,
    rateHint: `Rate it before you approve; ${DEFAULT_RATING} if you leave it`,
    noteHint: "A note with your vote (optional)",
    approveRated: (action: string, risk: string) => `Approve ${action} (${risk}) with a rating`,
    ratePrompt: "Rate it 1 to 5 (Enter for 4)",
  },

  composer: {
    label: "Steer the agent",
    labelTeam: "Say to the team",
    sendTo: "Send to",
    toAgent: "Agent",
    toTeam: "Team",
    placeholderTeam: "Say something to the people in this session",
    directive: "Directive",
    placeholder: "Steer the agent",
    placeholderFor: (mode: string) => `Send "${mode}"`,
    modeAndScope: "Mode and scope",
    send: "Send",
    mode: "Mode",
    scope: "Scope",
    scopeDefault: "goal",
    interruptNow: "Interrupt now",
    viewingPast: "Viewing the past · ",
    returnToNow: "Return to now",
    reconnecting: "Reconnecting · ",
    planWaits: "The plan waits for ratings",
    hint: (name: string, role: string, driving: boolean) =>
      `Enter to send · Shift+Enter for a new line · ? for shortcuts · as ${name}, ${role}${driving ? ", driving" : ""}`,
  },

  details: {
    title: "Details",
    close: "Close details",
    intent: "Intent",
    noGoal: "No goal yet.",
    always: "always",
    fromProject: " · project",
    held: (scopes: string[]) => `Held until a pick: ${scopes.join(", ")}`,
    control: (control: string, interrupt: boolean, turn: number) =>
      `${control}${interrupt ? " · interrupt pending" : ""} · turn ${turn}`,
    pause: "Pause",
    resume: "Resume",
    people: "People",
    you: " (you)",
    away: " · away",
    handOff: "Hand off",
    roleOf: (name: string) => `Role of ${name}`,
    alone: "Nobody else here yet. Share the link.",
    branches: "Branches",
    here: " · here",
    switch: "Switch",
    foldInto: (branch: string) => `Unite into ${branch}`,
    branchName: "New branch name",
    branchHint: "try/idea",
    fork: "Fork",
    files: (n: number) => plural(n, "file"),
    conflicts: (n: number) => ` · ${plural(n, "conflict")}`,
    checkpoints: (n: number) => ` · ${n} checkpoints`,
    checkpoint: "Checkpoint",
    conflict: " · conflict",
    memory: "Memory",
    refresh: "Refresh",
    catchUp: "Catch-up",
    briefHint: "A brief of what happened since you were last here.",
    askBrief: "Ask for brief",
    memoryEmpty: "Nothing remembered for this project yet.",
    memoryEmptyHint: "Nothing remembered here yet; ask the agent to remember something.",
    writeToAgent: "Write to the agent",
    memoryConflict: "Conflict · ",
    usage: "Usage",
  },

  /** Token usage: the chip in the top row, the Usage section of the drawer, card feet. */
  usage: {
    /** "12.4k tokens"; `n` is already the short form. */
    chip: (n: string) => `${n} tokens`,
    input: "Input",
    output: "Output",
    cacheRead: "Cache read",
    cacheWrite: "Cache write",
    budget: "Budget",
    noBudget: "No budget set",
    /** "12,400 of 50,000 · 25%" */
    ofBudget: (used: string, budget: string, pct: number) => `${used} of ${budget} · ${pct}%`,
    left: (n: string) => `about ${n} left`,
    nearing: "Nearing the budget",
    over: "Over the budget",
    byTurn: "By turn",
    turn: (n: number) => `Turn ${n}`,
    noTurns: "No turns yet.",
    /** The chip's accessible name: "Tokens: 12,400 used, 25% of the budget". */
    label: (used: string, pct: number | null) =>
      `Tokens: ${used} used${pct === null ? "" : `, ${pct}% of the budget`}`,
  },

  project: {
    sessions: "Sessions",
    agents: "Agents",
    withOthers: (names: string[]) => ` with ${names.join(", ")}`,
    noSessions: "No sessions yet.",
    emptySessions: "No sessions in this project yet.",
    // the page-size empty state (empty-states): the sentence, the line, the ghost of the first row
    noSessionsOn: (project: string) => `No sessions on ${project} yet.`,
    emptyLine:
      "Start one and the agent plans first; the people on the project rate the plan before any work.",
    ghostTitle: "Invoice PDF: tax lines and proration",
    ghostLine: (who: string) => `${who} · plan first`,
    ghostBudget: "0 of 120k",
    startOne: "Start one",
    memoryEmptyHint: "Nothing remembered here yet; an agent adds facts as it works.",
    startSession: "Start a session",
    approvalsWaiting: (n: number) => ` · ${plural(n, "approval")} waiting`,
    newSession: "New session",
    title: "Title",
    titleHint: "What is this session for?",
    sessionId: "Session id",
    open: "Open",
    planFirst: "Plan first",
    tokenBudget: "Token budget",
    tokenBudgetHint: "tokens, optional",
    contentions: "Contentions",
    bothWant: "Both want",
    mergeConflictOn: "Merge conflict on",
    overlapOn: "Overlapping work on",
    and: " and ",
    wins: (who: string) => `${who} wins`,
    dismiss: "Dismiss",
    dismissed: "dismissed",
    direction: "Project direction",
    directionHint: "Set direction for everyone in this project",
    constrainHint: "A standing constraint for every session",
    steerHint: "A steer every session follows",
    setDirection: "Set direction",
    withdraw: (text: string) => `Withdraw: ${text}`,
    teamMemory: "Team memory",
    allMemory: "All memory",
    disagree: "Two entries disagree on ",
    memoryEmpty: "Nothing remembered for this project yet.",
    brief: "Brief",
    tokens: (n: string) => ` · ${n} tokens`,
  },

  viz: {
    tokens: "tokens",
    nothingYet: "Nothing to show yet.",
    table: "Table",
    chart: "Chart",
    name: "Name",
    share: "Share",
    when: "When",
  },
  team: {
    refresh: "Refresh",
    overview: "Overview",
    tokensTotal: "Tokens",
    tokensDetail: (input: string, output: string) => `${input} in · ${output} out`,
    agentsOpen: "Agents",
    agentsDetail: (team: number, solo: number) => `${team} in teams · ${solo} solo`,
    needsYouTile: "Needs you",
    needsDetail: (approvals: number, contentions: number) =>
      `${plural(approvals, "approval")} · ${plural(contentions, "contention")}`,
    membersTile: "Members",
    membersDetail: (people: number, agents: number) =>
      `${plural(people, "person", "people")} · ${plural(agents, "agent")}`,
    tokensByProject: "Tokens by project",
    tokensByPerson: "Tokens by person",
    tokensByAgent: "Tokens by agent",
    tokensOverTurns: "Tokens over turns",
    turnBucket: (from: number, to: number) =>
      from === to ? `turn ${from}` : `turns ${from}–${to}`,
    calls: (n: number) => plural(n, "call"),
    membersAndAgents: "Members and agents",
    crews: "Crews",
    crewLine: (n: number, owners: string) => `${plural(n, "agent")} · ${owners}`,
    agentOf: (owner: string) => `${owner}'s agent`,
    inProject: (p: string) => `in ${p}`,
    noProjects: "No projects in this team are visible to you.",
    summary: (open: number, projects: number, counts: string, needs: number) =>
      `${plural(open, "open session")} across ${plural(projects, "project")}${counts ? `: ${counts}` : ""}. ${
        needs === 0
          ? "Nothing needs you right now."
          : `${plural(needs, "thing")} need${needs === 1 ? "s" : ""} you.`
      }`,
    counts: {
      running: (n: number) => `${n} running`,
      awaiting_approval: (n: number) => `${n} awaiting approval`,
      blocked: (n: number) => `${n} blocked`,
      paused: (n: number) => `${n} paused`,
      idle: (n: number) => `${n} idle`,
    },
    needsYou: "Needs you",
    nothingWaiting: "Nothing waiting.",
    approvalsIn: (n: number, title: string) => `${plural(n, "approval")} waiting in ${title}`,
    open: "Open",
    resolve: "Resolve",
    on: " on ",
    projects: "Projects",
    noOpenSessions: "no open sessions",
    recentHandoffs: "Recent handoffs",
    noHandoffs: "None offered to you yet.",
    noHandoffsYet: "No one has offered you a session yet.",
    turnOnNotifications: "Turn on notifications",
    openProject: "Open a project",
    noProjectsYet: "No projects in this team are visible to you yet.",
    tryDemo: "Try the demo session",
    new: "New",
    housekeeping: "Memory housekeeping",
    browseMemory: "Browse memory",
    curatorHint: (org: string) =>
      `One curator pass over ${org}: compact grown scopes, flag stale entries, list conflicts.`,
    run: "Run",
    running: "Running…",
    runAgain: "Run again",
    nothingToTidy: "Nothing to tidy.",
    foldedIn: (n: number) => `Compacted ${n} entries in `,
    level: (n: number) => `level ${n}`,
    stale: "Stale: ",
    staleLine: (author: string, unreadFor: number) =>
      `by ${author} · unread for ${unreadFor} events`,
    conflictOn: "Conflict on ",
  },

  /** Groups and chats (views/ChatView.tsx): people and agents in one circle. */
  chat: {
    title: "Chats",
    messages: "Messages",
    groups: "Groups",
    noGroups: "No groups yet. Start one with a person and an agent.",
    notAMember: "You are not in this group. Ask its creator or a lead to add you.",
    unknownGroup: "No such group here.",
    joining: "Opening…",
    members: "Members",
    memberCount: (n: number) => plural(n, "member"),
    closeMembers: "Close members",
    people: "People",
    agents: "Agents",
    you: " (you)",
    creator: "created it",
    inSession: "Open session",
    remove: "Remove",
    leave: "Leave",
    addPerson: "Add a person",
    addAgent: "Add an agent",
    add: "Add",
    nobodyToAdd: "Everyone in the organisation is already here.",
    noAgentsToAdd: "No live agents to add; start a session first.",
    agentOf: (owner: string, project: string) => `${owner}'s agent · ${project}`,
    composer: "Write a message",
    label: "Message",
    placeholder: (group: string) => `Say something in #${group}`,
    placeholderMention: "Say something; @ mentions a person or an agent",
    send: "Send",
    hint: "Enter to send · Shift+Enter for a new line · @ to mention a person or an agent",
    mentionList: "Mention",
    mentionHead: (group: string) => `People and agents in #${group}`,
    mentionFoot: "Mentioning an agent steers its session; its next words come back here.",
    yourself: "you",
    kindPerson: "person",
    kindAgent: "agent",
    ownersAgent: (owner: string) => `${owner}'s agent`,
    mentionCount: (n: number) => `${n} ${n === 1 ? "mention" : "mentions"} of you`,
    newSince: (n: number) => `New since you looked away · ${n}`,
    agentReplied: "replied",
    inReplyTo: "in reply to",
    turn: (n: number) => `turn ${n}`,
    empty: "Nothing said yet. Mention an agent with @ to bring it in.",
    today: "Today",
    yesterday: "Yesterday",
    newGroup: "New group",
    name: "Name",
    nameHint: "Invoice rollout",
    purpose: "Purpose",
    purposeHint: "What is this group for?",
    scope: "Scope",
    scopeOrg: "Whole organisation",
    scopeTeam: (team: string) => `Team ${team}`,
    scopeProject: (project: string) => `Project ${project}`,
    membersHint: "Pick people and agents. You are in it already.",
    create: "Create group",
    cancel: "Cancel",
    created: (name: string) => `#${name} created`,
    renamed: "Renamed",
    noOrg: "Pick an organisation first.",
    live: (status: string) => status,
  },
  /** settings-page, "Team look": how a lead styles their team (team-theme). */
  teamLook: {
    title: "Team look",
    intro: (team: string) =>
      `How ${team} looks to everyone in it: the rail, the buttons, the glow and the mark.`,
    notLead: "Only a lead or manager of a team can change how it looks.",
    team: "Team",
    preset: "Preset",
    presetHint: "Three looks made only of the palette",
    accent: "Accent",
    accentHint: "Buttons, links, the hand",
    highlight: "Highlight",
    highlightHint: "The crease, the driver ring, the glow",
    surface: "Surface",
    surfaceHint: "The rail and the disc of the mark",
    glow: "Glow",
    glowHint: "Around anything live",
    mark: "Mark",
    markHint: "What sits at the centre of the mark",
    markRing: "Centre dot",
    markBead: "Emblem",
    markDot: "Dot only",
    motion: "Motion",
    motionHint: "Calm turns the loaders and side animations off for the team",
    motionFull: "Full",
    motionCalm: "Calm",
    emblem: "Emblem",
    emblemHint: "One or two letters beside the wordmark",
    preview: "Preview",
    previewCard: "Invoice PDF",
    previewDoing: "working on",
    previewGoal: "tax lines under the subtotal",
    previewWith: `with ${cast.bo.short}, ${cast.cy.short}`,
    previewButton: "Approve",
    previewRunning: "Running",
    contrast: (what: string, ratio: string, ok: boolean) =>
      `${what} ${ratio} · ${ok ? "fine" : "low"}`,
    onCream: "on the canvas",
    onSurface: "on the rail",
    textOnAccent: "text on it",
    save: "Save",
    saving: "Saving…",
    saved: "Team look saved",
    reset: "Reset",
    resetDone: "Team look reset to the palette",
    failed: (error: string) => `Could not save the team look: ${error}`,
    badHex: "a colour as #RRGGBB",
  },

  /** The approvals queue when nothing waits: a good empty explains the gate it is waiting to hold. */
  approvalsPage: {
    emptyTitle: "Nothing needs you yet.",
    emptyLine:
      "When an agent reaches an exec or external call it waits here for a contributor; a push to main is a release gate that two people rate 4 or better. You rate, the agent goes on.",
    reviewRules: "Review the approval rules",
    ghostTitle: "Release gate · push invoice-tax-lines to main",
    ghostLine: "3 files, 142 lines · the plan was rated 4.5",
    ghostRatings: "0 of 2 ratings",
  },

  /** The memory browser before the first entry. */
  memoryPage: {
    emptyTitle: "Nothing remembered yet.",
    emptyLine:
      "Agents add facts as they work and every entry names who added it, in which session and commit. You can add the first one from a session's Details.",
  },

  /** The branch compare view. */
  branches: {
    nothingDiffers: "Nothing differs between these branches yet.",
  },

  /** The inbox before anything has needed you. */
  inboxPage: {
    emptyTitle: "Nothing has needed you yet.",
    emptyLine:
      "Approvals, handoffs, mentions and blocked agents land here, one sentence each, with the thing to do beside it.",
  },

  notify: {
    mentionTitle: (who: string, group: string) => `${who} mentioned you in #${group}`,
    approvalTitle: "Approval needed",
    approvalBody: (call: string, risk: string, where: string) => `${call} [${risk}] in ${where}`,
    handoffTitle: "You are offered the baton",
    handoffBody: (who: string, where: string) => `${who} wants to hand off ${where}`,
    contentionTitle: "Fleet contention",
    contentionBody: (kind: string, resource: string) => `${kind} on ${resource}`,
    planTitle: "A plan waits for your rating",
    planBody: (steps: number, where: string) => `${plural(steps, "step")} in ${where}`,
  },
} as const;
