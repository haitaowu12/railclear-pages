import { InputError } from "./engine.mjs";
export function captureDraftTarget(w) {
  const a = w.alternatives.find((x) => x.id === w.activeStudyId);
  return {
    workspaceId: w.id,
    alternativeId: a.id,
    vehicleId: a.vehicleId,
    routeId: a.routeId,
  };
}
export function assertDraftTarget(w, target, kind) {
  const current = captureDraftTarget(w),
    keys = [
      "workspaceId",
      "alternativeId",
      kind === "alignment" ? "routeId" : "vehicleId",
    ];
  if (!target || keys.some((k) => current[k] !== target[k]))
    throw new InputError(
      "Draft target changed. Discard the draft, or review and re-enter it for the intended library asset before applying.",
    );
}

// Draft contents may be unfinished, but their container must be safe to bind.
// Missing optional fields mean no draft, never undefined/phantom pending work.
export function readSavedDrafts(raw, workspace) {
  const empty = { alignment: null, alignmentTarget: null, curves: null };
  if (raw === null) return empty;
  let draft;
  try { draft = JSON.parse(raw); } catch { throw Error('Saved draft JSON is unreadable.'); }
  if (draft === null) return empty;
  if (typeof draft !== 'object' || Array.isArray(draft)) throw Error('Saved draft record is malformed.');
  const alignment = draft.alignment ?? null, curves = draft.curves ?? null;
  if ((alignment !== null && typeof alignment !== 'string') ||
      (curves !== null && (typeof curves !== 'object' || Array.isArray(curves) || typeof curves.brake !== 'string' || typeof curves.traction !== 'string')))
    throw Error('Saved draft fields are malformed.');
  if (alignment === null && curves === null) return empty;
  if (draft.workspaceId !== workspace.id || draft.alternativeId !== workspace.activeStudyId)
    throw Error('Saved drafts belong to another workspace or alternative.');
  if (draft.baseline != null && draft.baseline !== captureDraftBaseline(workspace, {alignment, curves}))
    throw Error('Saved drafts were created for different applied inputs.');
  // Older drafts without a target remain visible, but cannot apply silently.
  return { alignment, alignmentTarget: draft.alignmentTarget ?? null, curves };
}

// Bind to the assets being edited without duplicating every fleet/route input.
export function captureDraftBaseline(workspace, { alignment, curves }) {
  const target = captureDraftTarget(workspace);
  return JSON.stringify({target,
    route: alignment !== null ? workspace.routes.find(r => r.id === target.routeId) : null,
    vehicle: curves !== null ? workspace.vehicles.find(v => v.id === target.vehicleId) : null,
  });
}
