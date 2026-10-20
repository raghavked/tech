/**
 * settings-page, "My agent" and "Team agents" (docs/19_council.md, member models). A person
 * edits the profile of the agent they bring to a council: who runs it (the scripted stand-in
 * or Claude), the model id, its manner, the tools it may call and a token budget per council.
 * A manager's manner defaults to the chair's. A lead edits the org's shared agents the same
 * way, with an id each. The server (PUT /api/agents, PUT /api/agents/:org) checks the role
 * again and writes users.json or agents.json.
 */
import { type ReactNode, useEffect, useState } from "react";
import {
  type AgentProfileInput,
  type AgentRow,
  type AgentsResponse,
  api,
  type Me,
  type SharedAgentInput,
  useFetch,
} from "../api.js";
import { copy } from "../copy.js";
import type { Identity } from "../identity.js";
import { toast } from "../ui.js";

type Provider = AgentRow["provider"];

interface Draft {
  /** A stable key for the list while the id is edited; never sent. */
  key: string;
  id: string;
  name: string;
  provider: Provider;
  model: string;
  persona: string;
  tools: string[];
  /** As typed; blank for no budget. */
  budget: string;
}

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const BUDGET = /^[1-9][0-9]*$/;

let nextKey = 0;
const freshKey = () => `draft-${++nextKey}`;

function draftOf(p: AgentRow): Draft {
  return {
    key: freshKey(),
    id: p.id,
    name: p.name,
    provider: p.provider,
    model: p.model,
    persona: p.persona,
    tools: [...p.tools],
    budget: p.budget === null ? "" : String(p.budget),
  };
}

/** What goes to the server for a person's own agent: every field, so a cleared one stays cleared. */
export function inputOf(d: Draft): AgentProfileInput {
  return {
    name: d.name.trim(),
    provider: d.provider,
    model: d.model.trim(),
    persona: d.persona,
    tools: d.tools,
    budget: d.budget.trim() === "" ? null : Number(d.budget.trim()),
  };
}

export function sharedOf(d: Draft): SharedAgentInput {
  return { id: d.id.trim(), ...inputOf(d) } as SharedAgentInput;
}

/** Why a draft cannot be saved, or null. */
export function problemOf(d: Draft, withId = false): string | null {
  if (withId && !ID.test(d.id.trim())) return copy.agents.badId;
  if (!d.name.trim()) return copy.agents.badName;
  if (d.budget.trim() !== "" && !BUDGET.test(d.budget.trim())) return copy.agents.badBudget;
  return null;
}

function Row({
  title,
  detail,
  children,
  wide = false,
}: {
  title: string;
  detail?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`rowitem${wide ? " wide" : ""}`}>
      <span className="ellipsis">
        <span className="t">{title}</span>
        {detail && <span className="s">{detail}</span>}
      </span>
      {children}
    </div>
  );
}

/** The fields of one profile; `withId` for a shared agent, `chair` when the person manages. */
function AgentFields({
  draft,
  set,
  info,
  withId = false,
  chair = false,
  prefix,
}: {
  draft: Draft;
  set: (patch: Partial<Draft>) => void;
  info: AgentsResponse;
  withId?: boolean;
  chair?: boolean;
  prefix: string;
}) {
  const label = (s: string) => (withId ? `${s}: ${draft.id || prefix}` : s);
  const badId = withId && !ID.test(draft.id.trim());
  const badBudget = draft.budget.trim() !== "" && !BUDGET.test(draft.budget.trim());
  const toggleTool = (name: string) =>
    set({
      tools: draft.tools.includes(name)
        ? draft.tools.filter((t) => t !== name)
        : [...draft.tools, name],
    });
  return (
    <div className="list agentform">
      {withId && (
        <Row title={copy.agents.id} detail={badId ? copy.agents.badId : copy.agents.idHint}>
          <input
            className={`input mono sm${badId ? " bad" : ""}`}
            aria-label={label(copy.agents.id)}
            value={draft.id}
            onChange={(e) => set({ id: e.target.value })}
          />
        </Row>
      )}
      <Row
        title={copy.agents.name}
        detail={draft.name.trim() ? copy.agents.nameHint : copy.agents.badName}
      >
        <input
          className="input sm"
          aria-label={label(copy.agents.name)}
          value={draft.name}
          maxLength={80}
          onChange={(e) => set({ name: e.target.value })}
        />
      </Row>
      <Row
        title={copy.agents.provider}
        detail={
          draft.provider === "claude" && !info.providers.claude
            ? copy.agents.claudeOffline
            : copy.agents.providerHint
        }
      >
        <fieldset className="seg" aria-label={label(copy.agents.provider)}>
          {(["scripted", "claude"] as const).map((p) => (
            <button
              type="button"
              key={p}
              className={draft.provider === p ? "on" : ""}
              aria-pressed={draft.provider === p}
              onClick={() => set({ provider: p })}
            >
              {p === "scripted" ? copy.agents.scripted : copy.agents.claude}
            </button>
          ))}
        </fieldset>
      </Row>
      {draft.provider === "claude" && (
        <Row title={copy.agents.model} detail={copy.agents.modelHint}>
          <input
            className="input mono sm"
            aria-label={label(copy.agents.model)}
            value={draft.model}
            maxLength={120}
            onChange={(e) => set({ model: e.target.value })}
          />
        </Row>
      )}
      <Row
        title={copy.agents.persona}
        detail={chair ? copy.agents.personaChairHint : copy.agents.personaHint}
        wide
      >
        <span className="stack grow">
          <textarea
            className="input"
            aria-label={label(copy.agents.persona)}
            value={draft.persona}
            maxLength={4000}
            rows={3}
            onChange={(e) => set({ persona: e.target.value })}
          />
          {draft.persona !== info.chairPersona && (
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => set({ persona: info.chairPersona })}
            >
              {copy.agents.useChair}
            </button>
          )}
        </span>
      </Row>
      <Row title={copy.agents.tools} detail={copy.agents.toolsHint} wide>
        <fieldset className="chips" aria-label={label(copy.agents.tools)}>
          {info.tools.map((t) => (
            <label key={t.name} className={`chip${draft.tools.includes(t.name) ? " on" : ""}`}>
              <input
                type="checkbox"
                aria-label={`${label(copy.agents.tools)}: ${t.name}`}
                checked={draft.tools.includes(t.name)}
                onChange={() => toggleTool(t.name)}
              />
              <span className="mono">{t.name}</span>
            </label>
          ))}
        </fieldset>
      </Row>
      <Row
        title={copy.agents.budget}
        detail={badBudget ? copy.agents.badBudget : copy.agents.budgetHint}
      >
        <span className="row">
          <input
            className={`input mono sm budget${badBudget ? " bad" : ""}`}
            aria-label={label(copy.agents.budget)}
            inputMode="numeric"
            value={draft.budget}
            onChange={(e) => set({ budget: e.target.value })}
          />
          <span className="small muted">{copy.agents.budgetUnit}</span>
        </span>
      </Row>
    </div>
  );
}

// ---- My agent ---------------------------------------------------------------------------------

export function MyAgent({ identity }: { identity: Identity }) {
  const info = useFetch(() => api.agents(identity.userId), identity.userId);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mine = info.data?.mine ?? null;
  const savedKey = JSON.stringify(mine);
  // What arrived from the server replaces an untouched draft.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `savedKey` is the identity of `mine`
  useEffect(() => {
    if (!dirty && mine) setDraft(draftOf(mine));
  }, [savedKey]);

  const set = (patch: Partial<Draft>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setDirty(true);
  };
  const save = () => {
    if (!draft) return;
    setBusy(true);
    setError(null);
    api
      .putMyAgent(identity.userId, inputOf(draft), identity.token || undefined)
      .then((r) => {
        if (r.mine) setDraft(draftOf(r.mine));
        setDirty(false);
        toast(copy.agents.savedMine);
        info.reload();
      })
      .catch((e: unknown) =>
        setError(copy.agents.failed(e instanceof Error ? e.message : String(e))),
      )
      .finally(() => setBusy(false));
  };
  const problem = draft ? problemOf(draft) : null;
  return (
    <section className="group agents" aria-label={copy.agents.myTitle}>
      <h2>{copy.agents.myTitle}</h2>
      <p className="muted">
        {copy.agents.myIntro}
        {mine && (
          <>
            {" "}
            <span className="mono small">{copy.agents.runsOn(mine.modelName)}</span>
          </>
        )}
      </p>
      {info.error && <p className="small danger">{info.error}</p>}
      {!info.data && !info.error && <p className="muted">{copy.agents.loading}</p>}
      {info.data && draft && (
        <>
          <AgentFields
            draft={draft}
            set={set}
            info={info.data}
            chair={info.data.manager}
            prefix="mine"
          />
          {error && <p className="small danger">{error}</p>}
          <p className="row">
            <span className="grow" />
            <button
              type="button"
              className="btn ghost sm"
              disabled={busy || !dirty}
              onClick={() => {
                if (mine) setDraft(draftOf(mine));
                setDirty(false);
                setError(null);
              }}
            >
              {copy.agents.reset}
            </button>
            <button
              type="button"
              className="btn primary sm"
              disabled={busy || !dirty || problem !== null}
              onClick={save}
            >
              {busy ? copy.agents.saving : copy.agents.save}
            </button>
          </p>
        </>
      )}
    </section>
  );
}

// ---- Team agents ------------------------------------------------------------------------------

export function TeamAgents({ identity, me }: { identity: Identity; me: Me | null }) {
  const info = useFetch(() => api.agents(identity.userId), identity.userId);
  const leads = info.data?.leads ?? [];
  const [picked, setPicked] = useState<string | null>(null);
  const orgId = leads.includes(picked ?? "") ? (picked as string) : (leads[0] ?? null);
  const orgName = (id: string) => me?.projects.find((p) => p.orgId === id)?.orgName ?? id;
  const shared = useFetch(
    orgId ? () => api.orgAgents(orgId, identity.userId) : null,
    `${orgId ?? ""}:${identity.userId}`,
  );
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedKey = JSON.stringify(shared.data?.agents ?? null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `savedKey` is the identity of the list
  useEffect(() => {
    if (!dirty && shared.data) setDrafts(shared.data.agents.map(draftOf));
  }, [savedKey, orgId]);

  if (!info.data || leads.length === 0 || !orgId) {
    if (info.data && leads.length === 0)
      return (
        <section className="group">
          <h2>{copy.agents.teamTitle}</h2>
          <p className="muted">{copy.agents.notLead}</p>
        </section>
      );
    return null;
  }
  const at = (i: number, patch: Partial<Draft>) => {
    setDrafts((ds) => (ds ? ds.map((d, j) => (j === i ? { ...d, ...patch } : d)) : ds));
    setDirty(true);
  };
  const remove = (i: number) => {
    setDrafts((ds) => (ds ? ds.filter((_, j) => j !== i) : ds));
    setDirty(true);
  };
  const add = () => {
    setDrafts((ds) => {
      const list = ds ?? [];
      let n = list.length + 1;
      while (list.some((d) => d.id === copy.agents.newId(n))) n++;
      return [
        ...list,
        {
          key: freshKey(),
          id: copy.agents.newId(n),
          name: copy.agents.newName(n),
          provider: "scripted",
          model: "",
          persona: "",
          tools: [],
          budget: "",
        },
      ];
    });
    setDirty(true);
  };
  const problems = (drafts ?? []).map((d) => problemOf(d, true));
  const ids = (drafts ?? []).map((d) => d.id.trim());
  const duplicate = ids.some((id, i) => ids.indexOf(id) !== i);
  const valid = problems.every((p) => p === null) && !duplicate;
  const save = () => {
    if (!drafts) return;
    setBusy(true);
    setError(null);
    api
      .putOrgAgents(orgId, identity.userId, drafts.map(sharedOf), identity.token || undefined)
      .then((r) => {
        setDrafts(r.agents.map(draftOf));
        setDirty(false);
        toast(copy.agents.savedTeam);
        shared.reload();
      })
      .catch((e: unknown) =>
        setError(copy.agents.failed(e instanceof Error ? e.message : String(e))),
      )
      .finally(() => setBusy(false));
  };
  return (
    <section className="group agents" aria-label={copy.agents.teamTitle}>
      <h2>{copy.agents.teamTitle}</h2>
      <p className="row">
        <span className="muted grow">{copy.agents.teamIntro(orgName(orgId))}</span>
        {leads.length > 1 && (
          <select
            className="select sm"
            aria-label={copy.agents.org}
            value={orgId}
            onChange={(e) => {
              setPicked(e.target.value);
              setDirty(false);
            }}
          >
            {leads.map((id) => (
              <option key={id} value={id}>
                {orgName(id)}
              </option>
            ))}
          </select>
        )}
      </p>
      {shared.error && <p className="small danger">{shared.error}</p>}
      {!shared.data && !shared.error && <p className="muted">{copy.agents.loading}</p>}
      {drafts && drafts.length === 0 && <p className="muted">{copy.agents.none}</p>}
      {drafts?.map((d, i) => (
        <article className="agentcard" key={d.key}>
          <p className="row">
            <span className="serif grow">
              {d.name.trim() || d.id}
              <span className="small faint mono"> · {d.id}</span>
            </span>
            <button
              type="button"
              className="btn ghost sm"
              aria-label={`${copy.agents.remove}: ${d.name.trim() || d.id}`}
              onClick={() => remove(i)}
            >
              {copy.agents.remove}
            </button>
          </p>
          <AgentFields
            draft={d}
            set={(patch) => at(i, patch)}
            info={info.data as AgentsResponse}
            withId
            prefix={`shared ${i + 1}`}
          />
          {problems[i] && <p className="small danger">{problems[i]}</p>}
        </article>
      ))}
      {duplicate && <p className="small danger">{copy.agents.badId}</p>}
      {error && <p className="small danger">{error}</p>}
      <p className="row">
        <button type="button" className="btn sm" disabled={busy || !drafts} onClick={add}>
          {copy.agents.add}
        </button>
        <span className="grow" />
        <button
          type="button"
          className="btn ghost sm"
          disabled={busy || !dirty}
          onClick={() => {
            if (shared.data) setDrafts(shared.data.agents.map(draftOf));
            setDirty(false);
            setError(null);
          }}
        >
          {copy.agents.reset}
        </button>
        <button
          type="button"
          className="btn primary sm"
          disabled={busy || !dirty || !valid}
          onClick={save}
        >
          {busy ? copy.agents.saving : copy.agents.save}
        </button>
      </p>
    </section>
  );
}
