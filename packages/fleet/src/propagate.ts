/**
 * Propagation: project directives enter every live branch of every targeted session as
 * project-origin directives (rank above owner), and withdrawals follow them.
 */
import type { Session } from "@tiller/kernel";
import type { ProjectDirective, ProjectState } from "./state.js";
import { directiveAppliesTo } from "./state.js";

export function propagateDirective(
  project: ProjectState,
  d: ProjectDirective,
  sessionId: string,
  session: Session,
): void {
  if (!directiveAppliesTo(d, sessionId)) return;
  for (const branch of session.branches()) {
    const already = Object.values(session.state(branch).directives).some(
      (x) =>
        x.origin === "project" &&
        x.status !== "withdrawn" &&
        x.input.text === d.input.text &&
        x.input.scope === d.input.scope,
    );
    if (!already) session.applyProjectDirective(branch, project.projectId, d.id, d.author, d.input);
  }
}

export function withdrawPropagated(d: ProjectDirective, session: Session): void {
  for (const branch of session.branches()) {
    for (const x of Object.values(session.state(branch).directives)) {
      if (
        x.origin === "project" &&
        x.status !== "withdrawn" &&
        x.input.text === d.input.text &&
        x.input.scope === d.input.scope
      ) {
        session.withdrawProjectDirective(branch, x.id);
      }
    }
  }
}

/** Bring a session up to date with every active project directive (on registration or restart). */
export function syncDirectives(project: ProjectState, sessionId: string, session: Session): void {
  for (const d of Object.values(project.directives))
    propagateDirective(project, d, sessionId, session);
}
