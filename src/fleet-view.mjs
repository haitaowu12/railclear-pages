import { samplingView } from "./input-view.mjs";
import { continuousBoundsHTML } from "./workspace-exports.mjs";
import { esc as e } from "./exports.mjs";
import {
  PALETTE,
  compatibleRouteGroups,
  routeVariantSVG as drawRouteVariants,
  METRICS,
  trajectoryOverlaySVG as drawOverlay,
  envelopeSVG as drawEnvelope,
} from "./workspace-charts.mjs";
const n = (x) =>
  Number.isFinite(x)
    ? x.toLocaleString("en", { maximumFractionDigits: 2 })
    : "—";
const option = (id, name, selected) =>
  `<option value="${e(id)}" ${id === selected ? "selected" : ""}>${e(name)}</option>`;
const select = (label, attr, options) =>
  `<label class="field"><span>${e(label)}</span><select aria-label="${e(label)}" ${attr}>${options}</select></label>`;
const input = (label, attr, value, type = "text") =>
  `<label class="field"><span>${e(label)}</span><input aria-label="${e(label)}" ${attr} type="${type}" ${type === "number" ? 'step="any"' : ""} value="${e(value ?? "")}"></label>`;
const scrollFigure = (svg, label) =>
  `<div class="figure-scroll" tabindex="0" role="region" aria-label="${e(label)}">${svg}</div>`;
const trajectoryOverlaySVG = (...args) =>
  scrollFigure(
    drawOverlay(...args),
    "Mixed-fleet trajectory figure; scroll horizontally to inspect",
  );
const envelopeSVG = (...args) =>
  scrollFigure(
    drawEnvelope(...args),
    "Sampled fleet envelope figure; scroll horizontally to inspect",
  );
const routeVariantSVG = (...args) =>
  scrollFigure(
    drawRouteVariants(...args),
    "Route-variant figure; scroll horizontally to inspect",
  );
const editIcon = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12.5 3.5 4 4M4 12l9-9a1.4 1.4 0 0 1 2 0l2 2a1.4 1.4 0 0 1 0 2l-9 9-5 1z"/></svg>';
export function allocationRows(w, r, { stale = false, query = "", routeId = "", activeId = null } = {}) {
  if (stale) r = null;
  const needle = query.trim().toLocaleLowerCase();
  const rows = w.allocations.filter(a => (!routeId || a.routeId === routeId) &&
    [a.name, a.referenceId, w.routes.find(route => route.id === a.routeId)?.name].some(value => String(value || "").toLocaleLowerCase().includes(needle)));
  const names = new Map(w.alternatives.map(a => [a.id, a.name]));
  const methodName = value => ({ trajectory: "Trajectory", constant: "Constant grade" }[value] || value || "Unassigned");
  const stateName = value => ({ computed: "Computed", "review-required": "Review required", incomplete: "Incomplete", "not-evaluated": "Not evaluated", "no-applicable-cases": "No applicable cases" }[value] || value);
  const html = rows.map(a => {
    const results = r?.allocations.filter(result => result.id === a.id) || [];
    const allocated = !a.enabled ? '<span class="status-chip status-neutral">Not in run</span>' : !results.length ? '<span class="status-chip status-neutral">Run required</span>' : results.map(value => `<div class="allocation-value"><strong>${n(value.allocatedM)}</strong><div class="result-state"><span class="status-chip ${value.status === "computed" ? "status-computed" : "status-review"}">${e(stateName(value.status))}</span><span>${e(methodName(value.method))}${stale ? " · Previous run" : ""}</span></div>${value.protectedPointM !== null ? `<small class="cell-note ${value.minimumResidualM < 0 ? "negative-residual" : ""}">Point residual ${n(value.minimumResidualM)} m</small>` : ""}</div>`).join("");
    const governors = a.enabled ? results.filter(value => value.governing) : [];
    return `<tr class="${a.id === activeId ? "is-active-row" : ""} ${a.enabled ? "" : "row-excluded"}"><td><input class="in-run-switch" type="checkbox" role="switch" aria-label="Include section ${e(a.name)} in run" data-allocation-enable="${a.id}" ${a.enabled ? "checked" : ""}></td><td><strong class="row-title">${e(a.name)}</strong><small class="cell-note">${e({ signal: "Signal", "track-section": "CBTC", engineering: "Engineering" }[a.referenceKind] || a.referenceKind)} ${e(a.referenceId || "Reference not specified")} · ${e(w.routes.find(route => route.id === a.routeId)?.name)}</small></td><td class="numeric-domain">${n(a.fromM)}–${n(a.toM)}<small class="cell-note">${a.direction === 1 ? "Increasing →" : "← Decreasing"}</small></td><td class="quantity-cell">${a.metric === "selectedMarginM" ? "Margin beyond ideal service target" : "Protected first-arrest distance"}</td>${r ? `<td>${allocated}</td><td>${governors.length ? governors.map(value => `<div class="governing-case"><span>${n(value.governing.startM)} m · ${n(value.governing.speedKph)} km/h</span><small class="cell-note">${e(names.get(value.governing.alternativeId) || value.governing.alternativeId)}</small>${results.length > 1 ? `<small class="cell-note">${e(methodName(value.method))}</small>` : ""}</div>`).join("") : "—"}</td>` : ""}<td><button class="icon-button" data-edit-allocation="${a.id}" aria-label="Edit ${e(a.name)}" title="Edit ${e(a.name)}" aria-haspopup="dialog">${editIcon}</button></td></tr>`;
  }).join("") || `<tr><td colspan="${r ? 7 : 5}" class="register-empty">No matching sections <button class="text-button" data-clear-section-filters>Clear filters</button></td></tr>`;
  return { html, count: rows.length };
}
export function fleetView(
  w,
  r,
  { stale, busy, groupId, metric, allocationEditId, canUndo = false, query = "", routeId = "" },
) {
  const previousResults = !!r && stale;
  if (stale) r = null;
  const active = w.alternatives.find((a) => a.id === w.activeStudyId),
    ready = r && !stale && !busy,
    group = r?.groups.find((g) => g.id === groupId) || r?.groups[0];
  const routeVariants = group ? compatibleRouteGroups(r, group) : [];
  const register = allocationRows(w, r, { stale, query, routeId, activeId: allocationEditId });
  return `${previousResults ? '<div class="stale-notice">Inputs changed. Previous allocations and bounds are withheld until you run the current workspace.</div>' : ""}<section class="panel allocation-panel"><div class="register-toolbar"><label class="section-search"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg><span class="sr-only">Find sections</span><input type="search" id="section-search" placeholder="Find section or reference" aria-label="Find sections" value="${e(query)}"></label><label class="route-filter"><span class="sr-only">Filter sections by route</span><select id="section-route-filter" aria-label="Filter sections by route"><option value="">All routes</option>${w.routes.map(route => option(route.id, route.name, routeId)).join("")}</select></label><div class="register-actions"><button data-fleet-action="import-sections">Import CSV</button><button data-fleet-action="section-template">Export CSV</button><button data-fleet-action="add-allocation" class="add-section"><span aria-hidden="true">+</span> Add section</button></div></div><div class="register-meta"><span id="section-match-count" role="status" aria-live="polite">${register.count} of ${w.allocations.length} sections</span><span data-enabled-count="allocations">${w.allocations.filter(a => a.enabled).length} in run</span></div><div class="table-scroll" role="region" aria-label="Allocation sections" tabindex="0"><table class="allocation-table ${r ? "with-results" : ""}"><thead><tr><th class="run-column">In run</th><th>Section / route</th><th>Entry domain · m</th><th>Allocated quantity</th>${r ? "<th>Sampled allocation · m</th><th>Governing case</th>" : ""}<th><span class="sr-only">Actions</span></th></tr></thead><tbody id="allocation-rows">${register.html}</tbody></table></div><p class="note section-rule">Entry limits define failure starts; the complete stopping path continues along the route beyond section ends.</p></section>
 ${r ? `<section class="panel ${stale ? "is-stale" : ""}" aria-label="Continuous section bounds">${continuousBoundsHTML(r)}</section>` : ""}
 <section class="panel fleet-inputs"><div class="section-title"><div><h2>Fleet alternatives <span class="count" data-enabled-count="alternatives">${w.alternatives.filter((a) => a.enabled).length} in run</span></h2></div><button data-fleet-action="add-alternative">Add alternative</button></div><div class="table-scroll" role="region" aria-label="Fleet alternatives" tabindex="0"><table class="alternatives-table"><thead><tr><th class="run-column">In run</th><th>Alternative</th><th>Vehicle sheet</th><th>Operating profile</th><th>Route profile</th><th>Inputs</th><th>Remove</th></tr></thead><tbody>${w.alternatives
   .map(
     (a) =>
       `<tr class="${a.id === active.id ? "governing" : ""}"><td><input class="in-run-switch" type="checkbox" role="switch" data-alternative-enable="${a.id}" aria-label="Include ${e(a.name)}" ${a.enabled ? "checked" : ""}></td><td><input aria-label="Alternative name ${e(a.name)}" data-alternative-field="name" data-alternative-id="${a.id}" value="${e(a.name)}"></td>${[
         ["vehicleId", w.vehicles, (x) => x.spec.name],
         ["profileId", w.profiles, (x) => x.name],
         ["routeId", w.routes, (x) => x.name],
       ]
         .map(
           ([key, list, label]) =>
             `<td><select aria-label="${e({ vehicleId: "Vehicle", profileId: "Operating profile", routeId: "Route profile" }[key])} for ${e(a.name)}" data-alternative-field="${key}" data-alternative-id="${a.id}">${list.map((x) => option(x.id, label(x), a[key])).join("")}</select></td>`,
         )
         .join(
           "",
         )}<td><button data-edit-alternative="${a.id}">${a.id === active.id ? "Active inputs" : "Edit inputs"}</button></td><td><button data-remove-alternative="${a.id}" ${w.alternatives.length === 1 ? "disabled" : ""}>Remove</button></td></tr>`,
   )
   .join(
     "",
   )}</tbody></table></div><p class="note">Shared library inputs change every alternative using the same ID. Duplicate an input before making an independent variant. Route variants and directions retain separate allocation envelopes.</p><details class="library-tools"><summary>Library tools & coordinate datum</summary><div class="toolbar"><button data-fleet-action="add-starters">Add synthetic starter vehicles</button><button data-fleet-action="clone-vehicle">Duplicate active vehicle</button><button data-fleet-action="clone-profile">Duplicate active operating profile</button><button data-fleet-action="clone-route">Duplicate active route & sections</button><button data-fleet-action="import-library">Import library / vehicle JSON</button><button data-fleet-action="export-library">Export libraries</button><button data-fleet-action="prune-unused">Remove unused library entries</button><button data-fleet-action="undo" ${!canUndo ? "disabled" : ""}>Undo last applied change</button></div><div class="toolbar"><button data-input-editor="profile" aria-haspopup="dialog">Edit operating profile</button><button data-input-editor="route" aria-haspopup="dialog">Edit route identity & datum</button></div></details></section>
 ${samplingView(w)}
 ${r ? `<section class="metrics ${stale ? "is-stale" : ""}" aria-label="Fleet run summary"><div class="metric primary-metric"><span>Allocation sections / groups</span><strong>${r.allocations.length}</strong><small>${r.allocations.filter((x) => !["computed", "review-required"].includes(x.status)).length} unavailable or unevaluated</small></div><div class="metric"><span>Calculated cases</span><strong>${r.computedCount} <em>/ ${r.candidateCount}</em></strong><small>${r.failedCount} failed · ${r.excludedCount} inapplicable · ${r.probeFailedCount || 0} overlay failures</small></div><div class="metric"><span>Compared alternatives</span><strong>${r.members.length}</strong><small>${r.groups.length} separate route/direction/method groups</small></div><div class="metric"><span>Run state</span><strong class="state-word">${e(r.status)}</strong><small>Continuous bounds: ${e(r.continuousCoverageStatus || "not evaluated")} · ${r.unavailableBoundCount || 0} unavailable</small></div></section>` : ""}
 ${
   group
     ? `<section class="panel ${stale ? "is-stale" : ""}"><div class="section-title"><h2 id="fleet-overlays">Overlays and governing samples</h2><span class="tag">COMMON ENTRY · ${n(r.workspace.probe.startM)} m / ${n(r.workspace.probe.speedKph)} km/h</span></div><div class="form-grid">${select("Comparison group", 'id="fleet-group"', r.groups.map((g) => option(g.id, `${g.routeName} · ${g.direction === 1 ? "increasing" : "decreasing"} · ${g.method}`, group.id)).join(""))}${select(
         "Envelope quantity",
         'id="fleet-metric"',
         Object.entries(METRICS)
           .map(([id, label]) => option(id, label, metric))
           .join(""),
       )}</div><p class="note">Datum: ${e(group.datum)}. Each trajectory begins at the same specified chainage and commanded speed. Failure speed allowances may differ by operating profile.</p>${trajectoryOverlaySVG(r, group)}<h3>${e(METRICS[metric])} by entry chainage</h3>${envelopeSVG(r, group, metric)}<p class="note">Black markers show the maximum of the selected display quantity across applicable speed samples at each chainage. Margin allocations round the unrounded basis once using the section increment. Failed applicable cases leave gaps. Connecting lines are visual guides, not calculations at intermediate locations. This is an individual-train requirement overlay; moving train-pair separation and operational headway are not simulated.</p>${routeVariants.length > 1 ? `<details><summary>Overlay route variants · same declared datum and direction</summary><p class="note">These variants share the datum text as entered. Confirm coordinate comparability before interpretation. Allocations remain separate; there is no combined route envelope.</p>${routeVariantSVG(r, routeVariants, metric)}<h3>Common-entry trajectories across route variants</h3>${trajectoryOverlaySVG(r, { routeName: "Route variants", alternativeIds: routeVariants.flatMap((g) => g.alternativeIds) })}</details>` : ""}<details><summary>Case failures and exclusions · ${r.failedCount + r.excludedCount}</summary><div class="table-scroll" role="region" aria-label="Fleet case issues" tabindex="0"><table><thead><tr><th>Alternative</th><th>Entry m / speed km/h</th><th>Status</th><th>Reason</th></tr></thead><tbody>${r.members
         .flatMap((m) =>
           m.rows
             .filter((x) => ["failed", "not-applicable"].includes(x.status))
             .map((x) => ({ m, x })),
         )
         .slice(0, 100)
         .map(
           ({ m, x }) =>
             `<tr><td>${e(m.name)}</td><td>${n(x.startM)} / ${n(x.speedKph)}</td><td>${e(x.status)}</td><td>${e(x.message)}</td></tr>`,
         )
         .join(
           "",
         )}</tbody></table></div><p class="note">Preview shows at most 100 issue rows. Full registers retain every row.</p></details><div class="toolbar">${[
         ["allocation-csv", "Sampled allocation register CSV"],
         ["bound-csv", "Continuous bounds CSV"],
         ["fleet-report", "Fleet calculation report"],
         ["fleet-csv", "All cases CSV"],
         ["envelope-csv", "Envelope CSV"],
         ["fleet-json", "Reproducible fleet study JSON"],
         ["overlay-csv", "Common-entry traces CSV"],
         ["overlay-svg", "Overlay SVG"],
         ["envelope-svg", "Envelope SVG"],
       ]
         .map(
           ([id, label]) =>
             `<button data-fleet-export="${id}" ${!ready ? "disabled" : ""}>${label} ↗</button>`,
         )
         .join("")}</div></section>`
     : ""
 }`;
}
