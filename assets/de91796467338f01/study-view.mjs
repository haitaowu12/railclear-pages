import { esc as e } from "./exports.mjs";
import { ALGORITHMS, algorithmId, algorithmName } from "./algorithms.mjs";
import {
  workspaceReportHTML,
  continuousBoundsHTML,
} from "./workspace-exports.mjs";
import { trajectoryOverlaySVG, envelopeSVG } from "./workspace-charts.mjs";
const n = (x) =>
  Number.isFinite(x)
    ? x.toLocaleString("en", { maximumFractionDigits: 2 })
    : "—";
const tabs = (values, current, attr) =>
  `<nav class="workspace-tabs" aria-label="${attr === "data-result-view" ? "Result views" : "Input views"}">${values.map(([id, label]) => `<button ${attr}="${id}" ${current === id ? 'aria-current="page"' : ""}>${label}</button>`).join("")}</nav>`;
export const inputTabs = (tab) =>
  tabs(
    [
      ["inputs", "Overview"],
      ["vehicles", "Vehicle"],
      ["profile", "Failure & allowances"],
      ["alignment", "Alignment"],
      ["project", "Study record"],
    ],
    tab,
    "data-nav",
  );
export function inputsOverview(w, p) {
  const a = w.alternatives.find((x) => x.id === w.activeStudyId),
    r = w.routes.find((x) => x.id === a.routeId),
    profile = w.profiles.find((x) => x.id === a.profileId);
  return `<section class="input-overview"><div class="section-title"><div><h2>${e(a.name)}</h2></div><button data-nav="fleet">Manage assignments</button></div><div class="input-index">${[
    [
      "vehicles",
      "Vehicle",
      p.vehicle.name,
      `${n(p.vehicle.lengthM)} m · ${n(p.vehicle.massT)} t · ${n(p.vehicle.maxSpeedKph)} km/h`,
      "Edit vehicle sheet",
    ],
    [
      "profile",
      "Failure & allowances",
      profile.name,
      `${algorithmName(p)} · ${p.scenario.direction === 1 ? "Increasing" : "Decreasing"} chainage`,
      "Edit failure profile",
    ],
    [
      "alignment",
      "Alignment",
      r.name,
      `${p.alignment.length} segments · ${n(p.alignment[0].fromM)}–${n(p.alignment.at(-1).toM)} m`,
      "Edit alignment",
    ],
    [
      "project",
      "Study record",
      w.name,
      `Revision ${w.revision || "not set"} · ${w.author || "Preparer not set"}`,
      "Edit study record",
    ],
  ]
    .map(
      ([id, type, name, detail, label]) =>
        `<div><span class="index-type">${type}</span><div><strong>${e(name)}</strong><p>${e(detail)}</p></div><button data-nav="${id}">${label}</button></div>`,
    )
    .join(
      "",
    )}</div><div class="input-overview-footer"><span>Coordinate datum: ${e(r.datum)}</span><button data-input-editor="route">Edit route identity</button></div></section>`;
}
export function methodsView(w, p) {
  const profile = w.profiles.find(
    (x) =>
      x.id === w.alternatives.find((a) => a.id === w.activeStudyId).profileId,
  );
  return `<section class="method-selection"><div class="section-title"><div><h2>Calculation algorithm</h2><p class="note">Assigned through operating profile <strong>${e(profile.name)}</strong>. Shared alternatives use the same selection.</p></div><button data-input-editor="profile">Edit profile & method</button></div><div class="method-options">${Object.entries(
    ALGORITHMS,
  )
    .map(
      ([id, a]) =>
        `<label class="method-option ${algorithmId(p) === id ? "selected" : ""}"><input type="radio" name="algorithm" data-algorithm="${id}" ${algorithmId(p) === id ? "checked" : ""}><span><strong>${a.name}</strong><span>${e(a.detail)}</span></span><small>${a.status === "definition" ? "Definition only" : algorithmId(p) === id ? "Selected" : "Available"}</small></label>`,
    )
    .join(
      "",
    )}</div><p class="note">Grade model: <strong>${p.scenario.method === "constant" ? "Constant-grade reference" : "Alignment · uniform finite-train footprint"}</strong>. Rates already represent loading, adhesion and equipment condition. These algorithms do not add a force/inertia or component-brake model.</p></section><details class="method-disclosure"><summary>ETCS profile requirements</summary><p>Definition only; no ETCS calculation or result is available. There is no project baseline selected.</p><table><thead><tr><th>Profile element</th><th>Required definition</th></tr></thead><tbody>${[
    [
      "Specification",
      "SUBSET-026 edition, baseline/system version and applicable national values.",
    ],
    [
      "Brake model",
      "Gamma/lambda applicability; emergency and service brake data by speed and configuration.",
    ],
    [
      "Corrections",
      "Dry/wet correction factors and confidence basis, adhesion limits, rotating-mass treatment and correction ownership.",
    ],
    [
      "Timing & position",
      "Equivalent build-up times, traction removal, speed-estimation uncertainty, position confidence and release-speed conditions.",
    ],
    [
      "Infrastructure",
      "Gradient treatment, speed targets, movement-authority/end-of-authority and danger-point datums.",
    ],
    [
      "Curves & outputs",
      "Explicit scope for EBD/SBD and EBI/SBI/warning/indication limits. A braking curve alone is not full ETCS supervision.",
    ],
    [
      "Independent cases",
      "Published or independently checked reference inputs, intermediate states, distances and boundary/refusal cases for the selected baseline.",
    ],
  ]
    .map((row) => `<tr>${row.map((x) => `<td>${e(x)}</td>`).join("")}</tr>`)
    .join(
      "",
    )}</tbody></table><a href="https://www.era.europa.eu/domains/european-rail-traffic-management-system/braking-curves" target="_blank" rel="noreferrer">ERA braking-curve guidance</a></details><details class="method-disclosure"><summary>Track geometry and model boundaries</summary><p>Gradient and along-track distance affect trajectories. Civil speed limits filter entry cases only. Curvature, cant, wind, dynamic wheel slip, separate track/disc brakes, rotating inertia and post-arrest holding are not modeled. Curvature resistance receives no braking credit. A project force/energy model requires separate inputs and validation.</p><p>Sampled selections and continuous comparison bounds are separate outputs. Neither applies an automatic infrastructure transition policy or establishes project acceptance.</p></details>`;
}
export function resultsView(
  w,
  r,
  {
    stale,
    busy,
    view = "allocations",
    groupId,
    metric = "selectionBasisM",
    query = "",
    routeId = "",
    page = 0,
  },
) {
  const ready = r && !stale && !busy;
  const exports = `<div class="result-actions"><button data-fleet-export="fleet-report" ${ready ? "" : "disabled"}>Study report · HTML</button><button class="primary" data-fleet-export="study-pack" ${ready ? "" : "disabled"}>Download study pack · ZIP</button></div>`;
  if (!ready) {
    const rows=w.allocations.filter(a=>a.enabled);
    return `<div class="uncomputed-scope"><div class="scope-heading"><h2>${rows.length} sections</h2><span>${w.alternatives.filter(a=>a.enabled).length} alternatives</span><button data-nav="fleet">Edit sections & fleet</button></div><div class="table-scroll"><table><thead><tr><th>Section</th><th>Entry domain · m</th><th>Quantity</th></tr></thead><tbody>${rows.map(a=>`<tr><td><strong>${e(a.name)}</strong>${a.status&&a.status!=="computed"?`<span class="status-chip status-review">${e(a.status.replaceAll("-"," "))}</span>`:""}<small>${e(a.referenceId||'')}</small></td><td>${n(a.fromM)}–${n(a.toM)}</td><td>${a.metric==='protectedM'?'Protected first arrest':'Margin beyond service'}</td></tr>`).join('')}</tbody></table></div><p class="run-prompt">${busy?'Calculating the current inputs…':stale&&r?'Inputs changed. Run study to update allocations and the report.':'Run study to calculate these sections.'}</p></div>`;
  }
  const names = new Map(r.members.map((m) => [m.id, m.name]));
  const needle = query.trim().toLocaleLowerCase();
  const filtered = r.allocations.filter(
    (a) =>
      (!routeId || a.routeId === routeId) &&
      [
        a.name,
        a.referenceId,
        w.routes.find((x) => x.id === a.routeId)?.name,
      ].some((x) =>
        String(x ?? "")
          .toLocaleLowerCase()
          .includes(needle),
      ),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / 50));
  page = Math.min(page, pageCount - 1);
  const visible = filtered.slice(page * 50, (page + 1) * 50);
  const mobileRegister =
    visible
      .map((a) => {
        const b = r.continuousBounds?.find(
            (x) => x.allocationKey === a.allocationKey,
          ),
          g = a.governing;
        return `<article class="mobile-allocation"><header><h3>${e(a.name)}</h3><span>${e(a.status.replaceAll("-", " "))}</span></header><p>${e(w.routes.find((x) => x.id === a.routeId)?.name)} · ${a.direction === 1 ? "Increasing" : "Decreasing"} · ${n(a.fromM)}–${n(a.toM)} m</p><dl><div><dt>Sampled allocation · m</dt><dd class="selected-distance">${n(a.allocatedM)}</dd></div><div><dt>Continuous bound · m</dt><dd>${n(b?.allocatedUpperM)}</dd></div><div><dt>Sampled demand · m</dt><dd>${n(a.observedMaxM)}</dd></div></dl><p>${a.metric === "protectedM" ? "Protected first arrest" : "Margin beyond service"} · ${e(ALGORITHMS[a.algorithm ?? "rk4"].name)}</p>${g ? `<button class="governing-link" data-inspect-member="${e(g.alternativeId)}" data-inspect-start="${g.startM}" data-inspect-speed="${g.speedKph}">${e(names.get(g.alternativeId) || g.alternativeId)}</button><small>Governing sample: ${n(g.startM)} m · ${n(g.speedKph)} km/h</small>` : ""}</article>`;
      })
      .join("") ||
    "<p>No matching sections. Clear the search or choose all routes.</p>";
  const unavailable = r.allocations.filter(
    (a) => !["computed", "review-required"].includes(a.status),
  ).length;
  const intro = `<div class="results-summary"><strong>${r.allocations.length} section allocations</strong><span>${r.computedCount} cases</span><span class="${r.failedCount?'failure-count':''}">${r.failedCount} failed</span>${r.excludedCount?`<span>${r.excludedCount} excluded</span>`:''}<span>${r.members.length} alternatives</span>${unavailable?`<strong class="failure-count">${unavailable} unavailable</strong>`:''}</div>${tabs([['allocations','Allocations'],['diagnostics','Trajectories & checks'],['report','Report']],view,'data-result-view')}`;
  if (view === "report") {
    const html=workspaceReportHTML(r);
    const body=html.slice(html.indexOf('<body>')+6,html.lastIndexOf('</body>')).replaceAll('<div class="table">','<div class="table" role="region" tabindex="0" aria-label="Scrollable report table">');
    return intro+`<div class="report-toolbar"><span>Complete study · ${r.members.length} alternatives · ${r.computedCount} cases</span><div class="toolbar"><button data-print-report>Print / Save PDF</button><button data-fleet-export="fleet-report">Download HTML</button><button data-fleet-export="fleet-json">Study JSON</button></div></div><article class="report-document" aria-label="Complete study report">${body}</article>`;
  }
  if (view === "diagnostics") {
    const group = r.groups.find((g) => g.id === groupId) || r.groups[0];
    return (
      intro +
      `<section class="result-diagnostics"><div class="diagnostic-toolbar"><label>Comparison group<select id="fleet-group">${r.groups.map((g) => `<option value="${e(g.id)}" ${g.id === group?.id ? "selected" : ""}>${e(g.routeName)} · ${g.direction === 1 ? "Increasing" : "Decreasing"} · ${e(g.method)} · ${e(ALGORITHMS[g.algorithm ?? "rk4"].name)}</option>`).join("")}</select></label><div class="toolbar"><button data-fleet-export="fleet-csv">All cases · CSV</button><button data-fleet-export="overlay-csv">Traces · CSV</button></div></div>${group ? `<h3>Common-entry trajectories</h3><p class="note">${n(w.probe.startM)} m · ${n(w.probe.speedKph)} km/h commanded · ${e(group.datum)}</p><div class="figure-scroll" tabindex="0" role="region" aria-label="Common-entry trajectories">${trajectoryOverlaySVG(r, group)}</div><h3>Sampled margin basis by entry</h3><div class="figure-scroll" tabindex="0" role="region" aria-label="Sampled margin basis">${envelopeSVG(r, group, metric)}</div>` : ""}<details class="method-disclosure"><summary>Figures & additional exports</summary><div class="toolbar"><button data-fleet-export="overlay-svg">Trajectory figure · SVG</button><button data-fleet-export="envelope-svg">Envelope figure · SVG</button><button data-fleet-export="envelope-csv">Envelope · CSV</button><button data-fleet-export="fleet-json">Reproducible study · JSON</button></div></details><details class="method-disclosure"><summary>Failures and exclusions · ${r.failedCount + r.excludedCount}</summary><div class="table-scroll"><table><thead><tr><th>Alternative</th><th>Entry · m</th><th>Speed · km/h</th><th>Reason</th></tr></thead><tbody>${r.members.flatMap((m) => m.rows.filter((x) => x.status !== "computed").map((x) => `<tr><td>${e(m.name)}</td><td>${n(x.startM)}</td><td>${n(x.speedKph)}</td><td>${e(x.message || x.status)}</td></tr>`)).join("") || '<tr><td colspan="4">No failed or excluded cases.</td></tr>'}</tbody></table></div></details><details class="method-disclosure"><summary>Continuous bounds and refusals</summary>${continuousBoundsHTML(r)}</details></section>`
    );
  }
  return (
    intro +
    `<form id="results-filter" class="result-filters"><label><span class="sr-only">Find result sections</span><input id="results-query" aria-label="Find result sections" type="search" placeholder="Find section or reference" value="${e(query)}"></label><label><span class="sr-only">Result route</span><select id="results-route" aria-label="Result route"><option value="">All routes</option>${w.routes.map((x) => `<option value="${e(x.id)}" ${x.id === routeId ? "selected" : ""}>${e(x.name)}</option>`).join("")}</select></label><button type="submit">Filter</button><span>${filtered.length} of ${r.allocations.length} allocations</span><button type="button" data-fleet-export="allocation-csv">All allocations · CSV</button><button type="button" data-fleet-export="bound-csv">All bounds · CSV</button></form><div class="table-scroll results-register" tabindex="0" role="region" aria-label="Study allocation register"><table><thead><tr><th>Section / route</th><th>Quantity / method</th><th class="number">Sampled demand · m</th><th class="number">Sampled allocation · m</th><th class="number">Continuous bound · m</th><th>Governing sample</th></tr></thead><tbody>${
      visible
        .map((a) => {
          const b = r.continuousBounds?.find(
              (b) => b.allocationKey === a.allocationKey,
            ),
            g = a.governing;
          return `<tr><td><strong>${e(a.name)}</strong>${a.status&&a.status!=="computed"?`<span class="status-chip status-review">${e(a.status.replaceAll("-"," "))}</span>`:""}<small>${e(w.routes.find((x) => x.id === a.routeId)?.name)} · ${a.direction === 1 ? "Increasing" : "Decreasing"}</small><small>${n(a.fromM)}–${n(a.toM)} m · ${e(a.referenceId || "No reference")}</small></td><td>${a.metric === "protectedM" ? "Protected first arrest" : "Margin beyond service"}<small>${e(ALGORITHMS[a.algorithm ?? "rk4"].name)} · ${e(a.method)}</small></td><td class="number">${n(a.observedMaxM)}</td><td class="number selected-distance">${n(a.allocatedM)}</td><td class="number">${n(b?.allocatedUpperM)}<small>${b?.status === "bounded" ? "Bounded" : "Unavailable"}</small></td><td>${g ? `<button class="governing-link" data-inspect-member="${e(g.alternativeId)}" data-inspect-start="${g.startM}" data-inspect-speed="${g.speedKph}">${e(names.get(g.alternativeId) || g.alternativeId)}</button><small>${n(g.startM)} m · ${n(g.speedKph)} km/h</small>` : "—"}</td></tr>`;
        })
        .join("") ||
      '<tr><td colspan="6">No matching sections. Clear the search or choose all routes.</td></tr>'
    }</tbody></table></div><section class="mobile-allocations" aria-label="Section allocation results">${mobileRegister}</section>${pageCount>1?`<div class="result-pagination"><span>Page ${page+1} of ${pageCount}</span><div><button data-results-page="-1" ${page===0?"disabled":""}>Previous</button> <button data-results-page="1" ${page>=pageCount-1?"disabled":""}>Next</button></div></div>`:""}<p class="note">Sampled selection and continuous bound are different results. Their governing cases can differ. — means unavailable.</p><details class="method-disclosure"><summary>Run identity & review notes</summary><p>Input SHA-256: <code class="digest">${e(r.inputDigest)}</code></p><ul>${r.warnings.map((x) => `<li>${e(x)}</li>`).join("")}</ul></details>`
  );
}
