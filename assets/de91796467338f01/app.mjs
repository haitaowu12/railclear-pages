import {algorithmName} from "./algorithms.mjs";
import {workspaceContext} from "./workspace-context.mjs";
import {alignmentDraftRows,alignmentRowsCSV} from "./alignment-editor.mjs";
import {inputTabs,inputsOverview,methodsView,resultsView} from "./study-view.mjs";
import { saveWorkspaceSnapshot, saveDraftSnapshot, readBrowserSnapshot, recoverBrowserSaving, WORKSPACE_KEY, DRAFTS_KEY } from "./storage.mjs";
import { openInputEditor } from "./input-editor.mjs";
import { vehicleView, profileView, projectView } from "./input-view.mjs";
import { captureDraftTarget, assertDraftTarget, readSavedDrafts, captureDraftBaseline } from "./drafts.mjs";
import { sectionsCSV, parseSectionsCSV } from "./sections.mjs";
import {
  defaultWorkspace,
  importWorkspace,
  validateWorkspace,
  resolveProject,
  syncActive,
  newId,
  planWorkspace,
  mergeLibrary,
  addSyntheticFleet,
  useVehicleTemplate,
} from "./workspace.mjs";
import { fleetView, allocationRows } from "./fleet-view.mjs";
import { openSectionEditor } from "./section-editor.mjs";
import {
  workspaceReportHTML,
  workspaceRegisterCSV,
  envelopeCSV,
  overlayTraceCSV,
  allocationCSV,
  continuousBoundsCSV,
  portableWorkspaceResult,
} from "./workspace-exports.mjs";
import { trajectoryOverlaySVG, envelopeSVG } from "./workspace-charts.mjs";
import {
  trajectorySVG as drawTrajectory,
  alignmentSVG as drawAlignment,
} from "./charts.mjs";
import {
  DEFAULT,
  VEHICLES,
  VERSION,
  SOURCES,
  ALIGNMENT_EXAMPLE,
} from "./data.mjs";
import {
  validateProject,
  parseCSV,
  calculateCase,
  ENGINE,
  chainage,
} from "./engine.mjs";
import {
  esc as e,
  download,
  digest,
  resultCSV,
  traceCSV,
  reportHTML,
} from "./exports.mjs";
let workspace = defaultWorkspace(),
  lastValid = null,
  undoWorkspace = null,
  fleetResult = null,
  fleetGroupId = null,
  fleetMetric = "selectionBasisM",
  allocationEditId = null,
  allocationQuery = "",
  allocationRoute = "",
  resultView = "allocations", alignmentPage = 0, resultQuery="", resultRoute="", resultPage=0;
let p = resolveProject(workspace),
  result = null,
  tab = ["results", "inputs", "profile", "project", "fleet", "study", "alignment", "vehicles", "method", "report"].includes(globalThis.location?.hash.slice(1)) ? globalThis.location.hash.slice(1) : "results",
  worker = null,
  packWorker = null,
  generation = 0,
  alignmentImport = 0,
  editorEpoch = 0,
  stale = true,
  busy = false,
  error = "",
  progress = "",
  page = 0,
  alignmentDraft = null,
  alignmentDraftTarget = null,
  curveDraft = null,
  storageExpected = null,
  storageBlocked = false,
  storageMessage = "",
  draftStorageMessage = "",
  draftsExpected = null,
  draftsBlocked = false;
try {
  storageExpected = localStorage.getItem(WORKSPACE_KEY);
  const saved =
    storageExpected ||
    localStorage.getItem("railclear.workspace.v1");
  if (saved) {
    workspace = importWorkspace(JSON.parse(saved));
    p = resolveProject(workspace);
  }
} catch {
  storageBlocked = true;
  storageMessage = "Saved workspace could not be loaded. Existing browser data is preserved; open a saved workspace JSON or use the recovery actions.";
}
try {
  draftsExpected = localStorage.getItem(DRAFTS_KEY);
  const draft = readSavedDrafts(draftsExpected, workspace);
  alignmentDraft = draft.alignment;
  alignmentDraftTarget = draft.alignmentTarget;
  curveDraft = draft.curves;
} catch (ex) {
  draftsBlocked = true;
  draftStorageMessage = `Saved drafts were not loaded: ${ex.message} The original data is preserved; applied project inputs remain editable.`;
}
lastValid = structuredClone(workspace);
const trajectorySVG = (g) => drawTrajectory(g, p),
  alignmentSVG = () => drawAlignment(p);
const $ = (s) => document.querySelector(s),
  n = (v, d = 1) =>
    v === null || v === undefined
      ? "—"
      : Number.isFinite(v)
        ? v.toLocaleString("en", {
            minimumFractionDigits: d,
            maximumFractionDigits: d,
          })
        : "Invalid",
  ch = (x) => {
    const a = Math.round(Math.abs(x) * 10) / 10;
    return `${x < 0 ? "-" : ""}${Math.floor(a / 1000)}+${(a % 1000).toFixed(1).padStart(5, "0")}`;
  };
const icon =
  '<svg width="25" height="30" viewBox="0 0 25 30" fill="none" aria-hidden="true"><path d="M8 2 3 28M17 2l5 26M7 8h11M5 16h15M4 24h17" stroke="currentColor" stroke-width="2"/></svg>';
const field = (label, path, value, unit = "", step = "0.1") =>
  `<label class="field"><span>${e(label)}</span><div class="input-unit"><input data-path="${e(path)}" value="${e(value ?? "")}" type="number" step="${step}" aria-label="${e(label)}"><span>${e(unit)}</span></div></label>`;
const txt = (label, path, value) =>
  `<label class="field"><span>${e(label)}</span><input data-text="${e(path)}" value="${e(value ?? "")}" aria-label="${e(label)}"></label>`;
const navs = [
 ["results","01","Study"],
 ["inputs","02","Inputs"],
 ["fleet","03","Sections & fleet"],
 ["method","04","Methods"],
];
const inputViews=['inputs','vehicles','profile','alignment','project'];
const viewIds=[...navs.map(([id])=>id),'study','report',...inputViews];
const navCurrent=id=>id===(inputViews.includes(tab)?'inputs':['report','study'].includes(tab)?'results':tab);
const navigationIcon = id => {
  const paths = { results:'<path d="M3 3v14h14M5 12l4-5 4 3 4-6"/>', inputs:'<rect x="3" y="4" width="14" height="12" rx="1"/><path d="M3 8h14M8 8v8"/>', fleet: '<rect x="3" y="4" width="14" height="12" rx="1"/><path d="M3 8h14M8 8v8"/>', study: '<path d="M3 3v14h14M5 12l4-5 4 3 4-6"/>', alignment: '<path d="M5 3c9 0-1 14 9 14M3 6h5M10 14h6"/>', vehicles: '<rect x="5" y="2.5" width="10" height="13" rx="3"/><path d="M5 9h10M8 12h.01M12 12h.01M7 15.5 5 18M13 15.5l2 2.5"/>', method: '<path d="M3 4.5c4-2 7-1 7 1v12c0-2-3-3-7-1zM17 4.5c-4-2-7-1-7 1v12c0-2 3-3 7-1z"/>', report: '<path d="M5 2h7l4 4v12H5zM12 2v4h4M8 10h5M8 13h5"/>' };
  return `<svg viewBox="0 0 20 20" aria-hidden="true">${paths[id]}</svg>`;
};
function navigateView(id, updateUrl = false) {
  tab = id;
  if (updateUrl && location.hash !== `#${id}`) history.pushState(null, "", `#${id}`);
  shell();
  window.scrollTo(0, 0);
  $("#workspace-title").focus({ preventScroll: true });
}
if (typeof window !== "undefined") window.addEventListener("hashchange", () => {
  const next = location.hash.slice(1) || "fleet";
  if (viewIds.includes(next) && next !== tab) navigateView(next);
});
function status() {
  if (alignmentDraft !== null || curveDraft !== null)
    return "Unapplied draft · apply or discard";
  if (busy) return "Calculating…";
  if (stale) return fleetResult ? "Inputs changed · run required" : "Not calculated";
  if (fleetResult?.status === "computed") return "Current";
  if (fleetResult?.status === "incomplete")
    return "Incomplete · review allocations";
  if (fleetResult?.status === "no-applicable-cases")
    return "No applicable cases";
  return "Review required";
}
function shell() {
  const titles={results:'Section allocations',inputs:'Input records',profile:'Failure profile',project:'Study record',fleet:'Sections & fleet',study:'Alternative study',alignment:'Alignment',vehicles:'Vehicle sheet',method:'Calculation methods',report:'Section allocations'};
  const ready=fleetResult&&!stale&&!busy;
  const isResults=['results','report'].includes(tab);
  const compact=window.matchMedia('(max-width:800px)').matches;
  $("#app").innerHTML=`<a class="skip-link" href="#content">Skip to workspace</a>
  <header class="appbar"><a class="brand" href="#results" data-nav="results">RailClear</a><div class="project-context"><strong>${e(workspace.name)}</strong><span>${e(workspace.revision)}</span></div><div class="file-actions"><button data-action="import-project" class="quiet">Open</button><button data-action="save-project" class="quiet">Save inputs</button></div></header>
  <div class="nav-bar"><button id="navigation-toggle" class="navigation-toggle" aria-controls="main-navigation" aria-expanded="false" hidden>Menu</button><nav id="main-navigation" aria-label="Main navigation">${navs.map(([id,,label])=>`<a href="#${id}" data-nav="${id}" ${navCurrent(id)?'class="active" aria-current="page"':''}>${label}</a>`).join('')}</nav>${!isResults?`<label class="active-alternative"><span>Alternative</span><select data-active-study aria-label="Active alternative">${workspace.alternatives.map(a=>`<option value="${e(a.id)}" ${a.id===workspace.activeStudyId?'selected':''}>${e(a.name)}</option>`).join('')}</select></label>`:''}</div>
  <main class="workspace ${isResults?'results-workspace':''}"><div class="heading"><h1 id="workspace-title" tabindex="-1">${isResults&&resultView==='report'?'Study report':titles[tab]}</h1><div class="heading-actions"><span class="state ${stale?'pending':''}" id="state" role="status">${status()}</span><button class="primary run-action ${ready?'ready':''}" data-action="run" ${busy?'disabled':''}>${busy?'Running…':ready?'Run again':'Run study'}</button>${busy?'<button data-action="cancel">Cancel</button>':''}${isResults&&resultView==='report'?'':`<button data-result-view="report" ${ready?'':'disabled'}>View report</button>`}<button class="pack-action" data-fleet-export="study-pack" ${ready?'':'disabled'}>Download study pack</button></div></div>
  ${isResults&&resultView==='report'?'':`<div class="basis-banner"><span>${e(p.vehicle.status)}</span><span>Independent engineering review required.</span></div>`}<div id="storage-status" role="status">${storageNotice()}</div><div id="error" role="alert">${error?`<div class="error">${e(error)} <button data-action="restore-valid">Restore valid inputs</button></div>`:''}</div><div id="progress" role="status" aria-live="polite">${e(progress)}</div>
  <div class="work-area ${isResults&&resultView!=='report'?'with-context':''}">${isResults&&resultView!=='report'?workspaceContext(workspace,p,{compact}):''}<div id="content" tabindex="-1">${inputViews.includes(tab)?inputTabs(tab):''}${content()}</div></div><footer class="project-footer"><a href="https://haitaowu12.github.io/tony-wu-home/">Tony Wu · More projects</a></footer></main>
  <input id="project-file" type="file" accept=".json" hidden><input id="alignment-file" type="file" accept=".csv,.txt" hidden><input id="library-file" type="file" accept=".json" hidden><input id="sections-file" type="file" accept=".csv,.txt" hidden>`;
  bind();
}

function content() {
  if(tab==='inputs')return inputsOverview(workspace,p);
  if(tab==='profile')return `<section class="input-record">${profileView(workspace,p)}</section>`;
  if(tab==='project')return `<section class="input-record">${projectView(workspace)}<div class="toolbar"><button data-fleet-action="export-library">Export input libraries</button><button data-fleet-action="import-library">Import input libraries</button></div></section>`;
  if(tab==='results'||tab==='report')return resultsView(workspace,fleetResult,{stale,busy,view:resultView,groupId:fleetGroupId,metric:fleetMetric,query:resultQuery,routeId:resultRoute,page:resultPage})+recoveryCopiesView();
  if (tab === "fleet")
    return fleetView(workspace, null, {
      stale,
      busy,
      groupId: fleetGroupId,
      metric: fleetMetric,
      allocationEditId,
      canUndo: undoWorkspace !== null,
      query: allocationQuery,
      routeId: allocationRoute,
    });
  if (tab === "study") return study();
  if (tab === "alignment") return alignment();
  if (tab === "vehicles") return vehicles();
  if (tab === "method") return methodsView(workspace,p)+`<details class="method-disclosure"><summary>Calculation contract & numerical checks</summary>${method()}</details>`;
  return report();
}
function study() {
  const g = result?.governing;
  const active = workspace.alternatives.find((a) => a.id === workspace.activeStudyId);
  const profile = workspace.profiles.find((x) => x.id === active.profileId);
  const route = workspace.routes.find((x) => x.id === active.routeId);
  const residuals = result?.results.filter((x) => x.residualM !== null) || [],
    least = residuals.length ? residuals.reduce((m, x) => x.residualM < m.residualM ? x : m) : null;
  const controls = profileView(workspace, p);
  const context = `<div class="study-context"><strong>${e(route.name)}</strong><span>${e(route.datum)}</span><span>Entry extent ${n(p.study.fromM)}–${n(p.study.toM)} m</span></div>`;
  if (!result || stale) return `${stale && result ? '<div class="stale-notice">Inputs changed. Run the workspace to update the calculated trajectory and register.</div>' : ""}${context}<div class="study-setup-grid"><section class="config">${controls}</section><aside class="route-context"><div class="scope-note"><h2>Run scope</h2><dl class="route-facts"><div><dt>Route chainage · m</dt><dd>${ch(p.alignment[0].fromM)}–${ch(p.alignment.at(-1).toM)}</dd></div><div><dt>Train length</dt><dd>${n(p.vehicle.lengthM)} m</dd></div></dl><p><strong>${workspace.alternatives.filter((a) => a.enabled).length} alternatives</strong> across <strong>${workspace.allocations.filter((a) => a.enabled).length} enabled sections</strong>.</p><p>Run workspace calculates every enabled alternative. This view shows the selected alternative.</p><button data-fleet-action="preflight">Check inputs & case budget</button><button class="text-button" data-nav="fleet">Review sections & fleet</button></div></aside></div><div class="setup-alignment"><section class="plot-section"><div class="section-title"><h2>Alignment context</h2><span class="tag">${p.alignment.length} SEGMENTS · ${n((p.alignment.at(-1).toM - p.alignment[0].fromM) / 1000, 1)} km</span></div><div class="legend"><span class="key amber">Gradient in increasing chainage · ‰</span><span class="key muted">Study extent</span></div><div class="figure-scroll" tabindex="0" role="region" aria-label="Alignment gradient profile; scroll horizontally to inspect">${alignmentSVG()}</div><p class="plot-note">Positive grade rises with increasing chainage. The sign reverses automatically for reverse travel.</p></section></div>`;
  return `${context}${least ? `<div class="${least.residualM < 0 ? "error" : "stale-notice"}">Minimum modeled obstacle residual: <strong>${n(least.residualM, 2)} m</strong> at ${ch(least.startM)}, ${n(least.speedKph, 0)} km/h. ${least.residualM < 0 ? "Protected distance exceeds available distance." : "Positive within this sampled model; independent review remains required."} ${result.failures.length ? "Failed cases prevent a complete minimum." : ""}</div>` : ""}${stale && result ? '<div class="stale-notice" data-stale-notice>Previous results are stale. Run again to update charts, tables and exports.</div>' : ""}<section class="metrics ${stale ? "is-stale" : ""}" aria-label="Study results"><div class="metric primary-metric"><span>Selected sampled margin</span><strong>${g ? n(result.selectedMarginM) : "—"} <em>m</em></strong><small>Beyond ideal service target · rounded up</small></div><div class="metric"><span>Governing raw arrest distance</span><strong>${g ? n(g.distanceM) : "—"} <em>m</em></strong><small>${g ? `${ch(g.startM)} · ${n(g.speedKph, 0)} km/h entry` : "Run a study to identify the case"}</small></div><div class="metric"><span>Peak attained speed · governing</span><strong>${g ? n(g.peakKph) : "—"} <em>km/h</em></strong><small>Failure trajectory · not an authorised speed</small></div><div class="metric"><span>Cases evaluated</span><strong>${result ? result.results.length : "—"} <em>/ ${result?.caseCount || "—"}</em></strong><small>${result?.failures.length ? `${result.failures.length} failed cases — maximum is incomplete` : "Chainage × entry speed samples"}</small></div></section><details class="operating-editor"><summary>Edit operating inputs <span>${e(profile.name)}</span></summary>${controls}</details><div class="analysis ${stale ? "is-stale" : ""}"><section class="plot-section"><div class="section-title"><div><p class="eyebrow">GOVERNING SAMPLED CASE</p><h2>Failure stopping trajectory</h2></div><span class="tag">${g ? `${ch(g.startM)} / ${n(g.speedKph, 0)} km/h` : "NO GOVERNING CASE"}</span></div><div class="legend"><span class="key teal">Failure trajectory</span><span class="key blue">Ideal service reference</span><span class="key amber">Additional position & clearance</span></div><div class="chart-wrap figure-scroll" id="trajectory" tabindex="0" role="region" aria-label="Failure stopping trajectory; scroll horizontally to inspect">${g ? trajectorySVG(g) : '<div class="unavailable-result"><h3>No trajectory available</h3><p>No governing case was produced. Inspect failed or inapplicable cases before revising the study.</p></div>'}</div>${g ? `<div class="trace-facts"><span>First arrest <b>${n(g.timeS, 2)} s</b></span><span>Protected distance <b>${n(g.protectedM)} m</b></span><span>Step difference <b>${n(g.numericalDeltaM, 5)} m</b></span></div>` : ''}</section><section class="plot-section"><div class="section-title"><h2>Alignment context</h2><span class="tag">${p.alignment.length} SEGMENTS · ${n((p.alignment.at(-1).toM - p.alignment[0].fromM) / 1000, 1)} km</span></div><div class="legend"><span class="key amber">Gradient in increasing chainage · ‰</span><span class="key muted">Study extent</span></div><div class="figure-scroll" tabindex="0" role="region" aria-label="Alignment gradient profile; scroll horizontally to inspect">${alignmentSVG()}</div><p class="plot-note">Positive grade rises with increasing chainage. The sign reverses automatically for reverse travel.</p></section>${resultsTable()}</div>`;
}

function resultsTable() {
  if (!result) return "";
  const rows = result.results.slice(page * 25, page * 25 + 25),
    pages = Math.ceil(result.results.length / 25);
  return `<section class="table-section"><div class="section-title"><h2>Sampled calculation register</h2><span class="tag">${result.results.length} COMPUTED · ${result.failures.length} FAILED</span></div><div class="table-scroll" tabindex="0" role="region" aria-label="Calculation register"><table><thead><tr><th>Entry chainage</th><th>Entry km/h</th><th>Raw arrest m</th><th>Protected m</th><th>Signed margin m</th><th>Selected m</th><th>Inspect</th></tr></thead><tbody>${rows.map((r, i) => `<tr class="${r.startM === result.governing?.startM && r.speedKph === result.governing?.speedKph ? "governing" : ""}"><td>${ch(r.startM)}</td><td>${n(r.speedKph, 0)}</td><td>${n(r.distanceM, 2)}</td><td>${n(r.protectedM, 2)}</td><td>${n(r.signedMarginM, 2)}</td><td>${n(r.selectedM, 1)}</td><td><button class="text-button" data-probe="${page * 25 + i}" ${stale ? "disabled" : ""}>Trace ↗</button></td></tr>`).join("")}</tbody></table></div><div class="pagination"><span>${rows.length ? `${page * 25 + 1}–${page * 25 + rows.length}` : "0"} of ${result.results.length}</span><button data-action="prev" ${page === 0 ? "disabled" : ""}>Previous</button><button data-action="next" ${page >= pages - 1 ? "disabled" : ""}>Next</button></div>${
    result.failures.length
      ? `<details open><summary>Failed cases · outputs unavailable</summary><ul>${result.failures
          .slice(0, 25)
          .map(
            (f) =>
              `<li>${ch(f.startM)} / ${n(f.speedKph, 0)} km/h: ${e(f.message)}</li>`,
          )
          .join(
            "",
          )}</ul>${result.failures.length > 25 ? "<p>Showing first 25 failures. The CSV, JSON and HTML report retain every failed case.</p>" : ""}</details>`
      : ""
  }</section>`;
}
function alignment() {
 const raw=alignmentDraft??alignmentCSV();let rows=null,message='';
 try{rows=alignmentDraftRows(raw);}catch(ex){message=ex.message;}
 const route=workspace.routes.find(r=>r.id===workspace.alternatives.find(a=>a.id===workspace.activeStudyId).routeId);
 const pages=Math.max(1,Math.ceil((rows?.length||0)/50));alignmentPage=Math.min(alignmentPage,pages-1);
 return `<section class="alignment-editor"><div class="section-title"><div><h2>${e(route.name)}</h2><p class="note">${e(route.datum)} · ${p.alignment.length} applied segments${alignmentDraft!==null?' · Unapplied changes':''}</p></div><div class="toolbar"><button data-input-editor="route">Route identity</button><button data-action="import-alignment">Replace from CSV</button><button data-action="template">CSV template</button></div></div><div class="alignment-edit-bar"><span>Gradient in ‰, rising with increasing chainage. Speeds in km/h.</span><div class="toolbar"><button class="primary" data-action="apply-alignment">Apply alignment</button><button data-action="discard-alignment">Discard draft</button></div></div>${rows?`<div class="table-scroll" tabindex="0" role="region" aria-label="Edit alignment segments"><table class="alignment-edit-table"><thead><tr><th>Row</th><th>From · m</th><th>To · m</th><th>Gradient · ‰</th><th>Speed · km/h</th><th>Actions</th></tr></thead><tbody>${rows.slice(alignmentPage*50,(alignmentPage+1)*50).map((row,i)=>`<tr><td>${alignmentPage*50+i+1}</td>${row.map((value,col)=>`<td><input type="text" inputmode="decimal" data-alignment-row="${alignmentPage*50+i}" data-alignment-col="${col}" aria-label="Row ${alignmentPage*50+i+1} ${['start chainage metres','end chainage metres','gradient per mille','speed kilometres per hour'][col]}" value="${e(value)}"></td>`).join('')}<td><button data-alignment-remove="${alignmentPage*50+i}" aria-label="Remove alignment row ${alignmentPage*50+i+1}" ${rows.length===1?'disabled':''}>Remove</button></td></tr>`).join('')}</tbody></table></div><div class="alignment-bottom-bar"><button data-alignment-add>Add segment</button><span>${rows.length} rows · page ${alignmentPage+1} of ${pages}</span><div><button data-alignment-page="-1" ${alignmentPage===0?'disabled':''}>Previous</button> <button data-alignment-page="1" ${alignmentPage===pages-1?'disabled':''}>Next</button></div></div>`:`<p role="status">${e(message)}</p>`}<p class="note">Apply validates every row before replacing the route. Gaps, overlaps and missing values are rejected. All alternatives sharing this route receive applied changes.</p><details ${rows?'':'open'} class="method-disclosure"><summary>CSV editor & recovery</summary><label class="field"><span>Alignment CSV</span><textarea id="alignment-csv" rows="10" spellcheck="false">${e(raw)}</textarea></label><button data-action="save-recovery">Save draft & workspace</button></details><details class="method-disclosure"><summary>Applied gradient profile</summary><div class="figure-scroll" tabindex="0" role="region" aria-label="Applied alignment gradient">${alignmentSVG()}</div></details></section>`;
}
function alignmentCSV() {
  return (
    "from_m,to_m,gradient_permille,speed_kph\n" +
    p.alignment
      .map((r) => [r.fromM, r.toM, r.gradientPermille, r.speedKph].join(","))
      .join("\n")
  );
}
function vehicles() {
  const recovered = curveDraft ? `<section class="panel"><h2>Recovered performance-curve draft</h2><p class="note">Apply or discard the draft from the earlier editor before continuing.</p><label class="field"><span>Emergency brake curve</span><textarea id="brake-curve">${e(curveDraft.brake)}</textarea></label><label class="field"><span>Traction acceleration curve</span><textarea id="traction-curve">${e(curveDraft.traction)}</textarea></label><button data-action="apply-curves">Apply performance curves</button> <button data-action="discard-curves">Discard draft</button> <button data-action="save-recovery">Save draft & workspace</button></section>` : "";
  return recovered + vehicleView(workspace, p, VEHICLES);
}
function method() {
  return `<div class="two-column"><section class="panel prose"><p class="eyebrow">IMPLEMENTED CALCULATION CONTRACT</p><h2>First forward arrest, with explicit allowances</h2><p>Distance starts at the train nose when the modeled failure begins. Initial true speed is commanded speed plus overspeed and measurement-error allowances.</p><ol><li>Traction remains active until detection/command latency plus propulsion-disable delay.</li><li>Emergency braking begins after command latency plus brake-onset delay. It ramps linearly to the supplied level-track brake rate; traction and braking can overlap.</li><li>Time integration stops at the first zero-speed event. An early arrest before full brake is flagged; holding and subsequent rollback are outside the model.</li></ol><p><code>dv/dt = a_traction − a_brake − direction × g × mean(sin θ)</code><br><code>dx/dt = v ; nose = entry + direction × x</code></p><p>For alignment mode, gravity is averaged over a uniform train footprint. Constant-grade mode uses a supplied fixed grade and is a reference calculation; alignment geometry does not affect its dynamics.</p><h3>Keep the quantities separate</h3><ul><li><b>Raw arrest:</b> integrated physical travel.</li><li><b>Protected distance:</b> raw travel plus named position, rollback and stand-off allowances.</li><li><b>Ideal service reference:</b> commanded speed squared / twice service deceleration.</li><li><b>Signed margin:</b> protected distance minus that ideal service reference.</li><li><b>Selected sampled margin:</b> nonnegative margin plus step-comparison difference, rounded up to the selected increment.</li><li><b>Peak attained speed:</b> sampled maximum along the failure path; not a maximum authorised speed.</li></ul></section><section class="panel prose"><h2>Numerics, coverage & source basis</h2><p>RK4 integration partitions command/brake timing and front/rear grade-knot events. Curve-knot and force-slope checks plus local step doubling reject unresolved trials. Root finding stops at first arrest. Two successive distance refinements must meet tolerance within four comparisons or the case fails.</p><p>The comparison is sensitivity evidence, not a rigorous error bound. Speed and chainage sampling cannot establish a continuous global maximum. Grade boundaries and front/rear transition points are added to the study grid. Civil speed limits only filter entry cases.</p><h3>Explicit exclusions</h3><p>Not an ETCS or vendor ATP implementation. No brake assurance/BAM, dynamic wheel slip, curvature resistance, wind, coupled train forces, validated load envelopes, service-controller simulation, or growing odometry uncertainty. The separate continuous comparison profile covers the declared initial position interval through changing finite-train geometry; sampled trajectories alone do not.</p><h3>Public research</h3>${SOURCES.map((s) => `<p><a href="${e(s.url)}" target="_blank" rel="noreferrer">${e(s.title)} ↗</a><br>${e(s.note)}</p>`).join("")}<p class="note">All built-in project and vehicle values are synthetic. No private project records were used in this app. Independent analytic and negative-case tests are included in the source repository.</p></section></div>`;
}
function report() {
  const ready = result && !stale && !busy;
  const workspaceReady = fleetResult && !stale && !busy;
  const workspaceExports = `<section class="panel"><div class="section-title"><h2>Complete workspace record</h2><span class="tag">${workspaceReady ? e(fleetResult.status) : "RUN CURRENT INPUTS FIRST"}</span></div><p class="note">All enabled alternatives, section allocations, continuous bounds and retained failures.</p><div class="export-grid">${[
    ["fleet-report", "Workspace calculation report", "Self-contained HTML · all alternatives"],
    ["fleet-json", "Reproducible workspace study", "Inputs, results, identities and refusals · JSON"],
    ["allocation-csv", "Sampled allocations", "Section register · CSV"],
    ["bound-csv", "Continuous section bounds", "Separate bound and refusal register · CSV"],
  ].map(([id,title,detail])=>`<button data-fleet-export="${id}" ${workspaceReady ? "" : "disabled"}><strong>${title} ↗</strong><span>${detail}</span></button>`).join("")}</div></section>`;
  return `${workspaceExports}${recoveryCopiesView()}<section class="panel"><div class="section-title"><div><h2>Export current study</h2></div><span class="tag">${ready ? result.status.toUpperCase() : "RUN CURRENT INPUTS FIRST"}</span></div><div class="input-pair">${projectView(workspace)}<div class="export-grid">${[
    ["report-html", "Calculation report", "Self-contained HTML · print to PDF"],
    [
      "results-csv",
      "Calculation register",
      "Unit-labeled CSV · every sampled case",
    ],
    [
      "study-json",
      "Reproducible study",
      "Full inputs, outputs, digest and trace",
    ],
    ["svg", "Trajectory figure", "Editable vector SVG"],
    [
      "trace-csv",
      "Governing trajectory",
      "Time, distance, chainage and speed CSV",
    ],
  ]
    .map(
      ([id, title, sub]) =>
        `<button data-export="${id}" ${!ready || (["svg", "trace-csv"].includes(id) && !result.governing) ? "disabled" : ""}><strong>${title} ↗</strong><span>${sub}</span></button>`,
    )
    .join(
      "",
    )}</div>${ready ? `<p class="note">Input SHA-256 <code class="digest">${e(result.inputDigest)}</code><br>Generated ${e(result.generatedAt)} · ${result.results.length} computed / ${result.caseCount} candidate cases. ${result.failures.length ? "INCOMPLETE: exports retain all failures and cannot establish a governing project envelope." : ""}</p>` : '<p class="note">Exports are blocked while results are missing, running or stale. Valid applied inputs can be saved as project JSON. Apply or discard drafts first.</p>'}</section>${ready ? `<section class="panel prose"><h2>Review notes carried into the report</h2><ul>${result.warnings.map((x) => `<li>${e(x)}</li>`).join("")}</ul></section>` : ""}`;
}
function mutate(fn) {
  error = "";
  fn();
  syncActive(workspace, p);
  generation++;
  packWorker?.terminate();packWorker=null;
  worker?.terminate();
  worker = null;
  busy = false;
  stale = true;
  progress = "";
  page = 0;
  persist();
  $("#error").innerHTML = error
    ? `<div class="error">${e(error)} <button data-action="restore-valid">Restore valid inputs</button></div>`
    : "";
  $('[data-action="restore-valid"]')?.addEventListener("click", () =>
    action("restore-valid"),
  );
  $("#state").textContent = status();
  $("#state").classList.add("pending");
  for (const item of document.querySelectorAll("[data-enabled-count]")) {
    item.textContent = `${workspace[item.dataset.enabledCount].filter(record => record.enabled).length} in run`;
  }
  $('.primary[data-action="run"]').disabled = false;
  for (const x of document.querySelectorAll(
    "[data-export],[data-probe],[data-fleet-export]",
  ))
    x.disabled = true;
  document
    .querySelectorAll(".metrics,.analysis")
    .forEach((x) => x.classList.add("is-stale"));
  if (result && !$("[data-stale-notice]"))
    $("#content").insertAdjacentHTML(
      "afterbegin",
      '<div class="stale-notice" data-stale-notice>Previous results are stale. Run again to update charts, tables and exports.</div>',
    );
}
function setPath(path, v) {
  if (path.startsWith("vehicle.")) customVehicle();
  const parts = path.split(".");
  let o = p;
  while (parts.length > 1) o = o[parts.shift()];
  o[parts[0]] = v;
}
function bind() {
  bindFleet();
  $('#results-filter')?.addEventListener('submit',ev=>{ev.preventDefault();resultQuery=$('#results-query').value;resultRoute=$('#results-route').value;resultPage=0;shell();$('#results-query')?.focus();});
  document.querySelectorAll('[data-results-page]').forEach(el=>el.onclick=()=>{resultPage+=Number(el.dataset.resultsPage);shell();$('.results-register')?.focus();});

  const setAlignmentRows=rows=>{alignmentDraft=alignmentRowsCSV(rows);alignmentDraftTarget=captureDraftTarget(workspace);mutate(()=>{});if($("#alignment-csv"))$("#alignment-csv").value=alignmentDraft;};
  document.querySelectorAll('[data-alignment-row]').forEach(el=>el.oninput=()=>{const rows=alignmentDraftRows(alignmentDraft??alignmentCSV());rows[Number(el.dataset.alignmentRow)][Number(el.dataset.alignmentCol)]=el.value;setAlignmentRows(rows);});
  document.querySelectorAll('[data-alignment-remove]').forEach(el=>el.onclick=()=>{const rows=alignmentDraftRows(alignmentDraft??alignmentCSV());rows.splice(Number(el.dataset.alignmentRemove),1);setAlignmentRows(rows);shell();});
  $('[data-alignment-add]')?.addEventListener('click',()=>{const rows=alignmentDraftRows(alignmentDraft??alignmentCSV());if(rows.length>=20000)return showError('Alignment is limited to 20,000 rows.');rows.push([rows.at(-1)?.[1]??'', '', '', '']);alignmentPage=Math.floor((rows.length-1)/50);setAlignmentRows(rows);shell();});
  document.querySelectorAll('[data-alignment-page]').forEach(el=>el.onclick=()=>{alignmentPage+=Number(el.dataset.alignmentPage);shell();});
  document.querySelectorAll('[data-algorithm]').forEach(el=>el.onchange=()=>{try{assertNoDrafts();mutate(()=>p.scenario.algorithm=el.dataset.algorithm);shell();document.querySelector(`[data-algorithm="${el.dataset.algorithm}"]`)?.focus();}catch(ex){showError(ex.message);shell();}});
  document.querySelectorAll('[data-result-view]').forEach(el=>el.onclick=()=>{resultView=el.dataset.resultView;if(!['results','report'].includes(tab)){navigateView('results',true);}else shell();});
  $('[data-print-report]')?.addEventListener('click',()=>window.print());
  document.querySelectorAll('[data-inspect-member]').forEach(el=>el.onclick=()=>{try{inspectSectionSample(el);}catch(ex){showError(ex.message);}});

  for (const button of document.querySelectorAll('[data-recovery-copy]')) button.onclick = () => {
    try {
      const raw = localStorage.getItem(button.dataset.recoveryCopy);
      if (raw === null) throw Error('The recovery copy is no longer available.');
      download('railclear-earlier-browser-data.json', raw, 'application/json');
    } catch(ex) { showError(ex.message); }
  };
  for (const button of document.querySelectorAll("[data-input-editor]")) button.onclick = () => {
    try {
      assertNoDrafts();
      validateWorkspace(workspace);
      editorEpoch++;
      const kind = button.dataset.inputEditor;
      openInputEditor({
        getWorkspace: () => workspace, kind,
        onApply: candidate => {
          undoWorkspace = structuredClone(workspace);
          mutate(() => { workspace = candidate; p = resolveProject(workspace); });
          progress = "";
          shell();
        },
        returnFocus: () => $(`[data-input-editor="${kind}"]`),
      });
    } catch (error) { showError(error.message); }
  };
  $("#navigation-toggle")?.addEventListener("click", () => {
    const expanded = $("#navigation-toggle").getAttribute("aria-expanded") === "true";
    $("#navigation-toggle").setAttribute("aria-expanded", String(!expanded));
    $("#main-navigation").classList.toggle("is-open", !expanded);
  });
  $("#main-navigation").onkeydown = (ev) => {
    if (ev.key === "Escape") {
      $("#main-navigation").classList.remove("is-open");
      $("#navigation-toggle").setAttribute("aria-expanded", "false");
      $("#navigation-toggle").focus();
    }
  };
  document.querySelectorAll("[data-nav]").forEach(
    (b) =>
      (b.onclick = (ev) => {
        if (b.tagName === "A" && (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || ev.button > 0)) return;
        ev.preventDefault();
        navigateView(b.dataset.nav, true);
      }),
  );
  document.querySelectorAll("[data-path]").forEach(
    (el) =>
      (el.oninput = () => {
        mutate(() =>
          setPath(
            el.dataset.path,
            el.value === "" && el.dataset.path === "scenario.obstacleM"
              ? null
              : el.value === ""
                ? NaN
                : Number(el.value),
          ),
        );
      }),
  );
  document.querySelectorAll("[data-text]").forEach(
    (el) =>
      (el.oninput = () => {
        mutate(() => setPath(el.dataset.text, el.value));
      }),
  );
  document.querySelectorAll("[data-select]").forEach(
    (el) =>
      (el.onchange = () => {
        try {
          if (el.dataset.select === "vehicle")
            changeWorkspace((w) => useVehicleTemplate(w, el.value), {
              structural: true,
            });
          else
            mutate(() => {
              if (el.dataset.select === "direction")
                p.scenario.direction = Number(el.value);
              else p.scenario.method = el.value;
            });
          shell();
        } catch (ex) {
          showError(ex.message);
        }
      }),
  );
  document.querySelectorAll("[data-vehicle]").forEach(
    (el) =>
      (el.onclick = () => {
        try {
          changeWorkspace((w) => useVehicleTemplate(w, el.dataset.vehicle), {
            structural: true,
          });
          shell();
        } catch (ex) {
          showError(ex.message);
        }
      }),
  );
  $("#speeds")?.addEventListener("input", (ev) => {
    mutate(
      () =>
        (p.study.speedsKph = ev.target.value
          .split(",")
          .map((x) => (x.trim() === "" ? NaN : Number(x)))),
    );
  });
  $("#alignment-csv")?.addEventListener("input", (ev) => {
    document.querySelectorAll("[data-alignment-row],[data-alignment-remove]").forEach(el=>el.disabled=true);
    alignmentDraft = ev.target.value;
    alignmentDraftTarget = captureDraftTarget(workspace);
    mutate(() => {});
  });
  for (const id of ["brake-curve", "traction-curve"])
    $("#" + id)?.addEventListener("input", () => {
      curveDraft = {
        brake: $("#brake-curve").value,
        traction: $("#traction-curve").value,
        target: captureDraftTarget(workspace),
      };
      mutate(() => {});
    });
  document
    .querySelectorAll("[data-action]")
    .forEach((el) => (el.onclick = () => action(el.dataset.action)));
  document
    .querySelectorAll("[data-export]")
    .forEach((el) => (el.onclick = () => exportResult(el.dataset.export)));
  document.querySelectorAll("[data-probe]").forEach(
    (el) =>
      (el.onclick = () => {
        try {
          const r = result.results[Number(el.dataset.probe)],
            trace = calculateCase(result.project, r.startM, r.speedKph, {
              record: true,
            });
          $("#trajectory").innerHTML = trajectorySVG(trace);
          $(".plot-section .eyebrow").textContent =
            "INSPECTED SAMPLE · SUMMARY ABOVE REMAINS GOVERNING";
          $(".plot-section .tag").textContent =
            ch(r.startM) + " / " + n(r.speedKph, 0) + " km/h · inspected case";
          $(".trace-facts").innerHTML =
            `<span>Inspected raw arrest <b>${n(trace.distanceM)} m</b></span><span>Protected <b>${n(trace.protectedM)} m</b></span><span>First arrest <b>${n(trace.timeS, 2)} s</b></span>`;
        } catch (ex) {
          showError(ex.message);
        }
      }),
  );
  $("#project-file").onchange = async (ev) => {
    const read = captureFileRead();
    try {
      assertNoDrafts();
      const file = ev.target.files[0];
      if (!file) return;
      if (file.size > 32e6) throw Error("Workspace JSON is limited to 32 MB.");
      const text = await file.text();
      if (!checkFileRead(read)) return;
      const imported = JSON.parse(text);
      const next = importWorkspace(imported);
      const recovered = imported.kind === 'railclear-recovery'
        ? readSavedDrafts(JSON.stringify(imported.drafts), next)
        : {alignment:null,alignmentTarget:null,curves:null};
      mutate(() => {
        workspace = next;
        undoWorkspace = null;
        alignmentDraft = recovered.alignment;
        alignmentDraftTarget = recovered.alignmentTarget;
        curveDraft = recovered.curves;
        p = resolveProject(workspace);
      });
      result = null;
      fleetResult = null;
      allocationEditId = null;
      error = "";
      persist();
      shell();
    } catch (ex) {
      if (read.token === alignmentImport) showError("Project not loaded: " + ex.message);
    } finally {
      if (read.token === alignmentImport) ev.target.value = "";
    }
  };
  $("#alignment-file").onchange = async (ev) => {
    const token = ++alignmentImport,
      targetWorkspace = workspace,
      targetProject = p,
      targetGeneration = generation,
      targetEditorEpoch = editorEpoch;
    try {
      const file = ev.target.files[0];
      if (!file) return;
      if (file.size > 8e6) throw Error("Alignment CSV is limited to 8 MB.");
      const text = await file.text();
      // A newer file selection owns the outcome, including error reporting.
      if (token !== alignmentImport) return;
      // Fail closed after navigation, replacement, or edits. IDs alone cannot
      // distinguish a re-imported workspace from the original editor target.
      if (
        workspace !== targetWorkspace ||
        p !== targetProject ||
        generation !== targetGeneration || editorEpoch !== targetEditorEpoch
      )
        throw Error(
          "Workspace, active alternative or inputs changed while reading the file. Select the intended route and choose the CSV again.",
        );
      const next = parseCSV(text);
      mutate(() => (p.alignment = next));
      alignmentDraft = null;
      alignmentDraftTarget = null;
      error = "";
      persist();
      shell();
    } catch (ex) {
      if (token === alignmentImport)
        showError("Alignment not replaced: " + ex.message);
    } finally {
      if (token === alignmentImport) ev.target.value = "";
    }
  };
}
function captureFileRead() {
  return { token: ++alignmentImport, workspace, project: p, generation, editorEpoch };
}
function checkFileRead(read) {
  if (read.token !== alignmentImport) return false;
  if (workspace !== read.workspace || p !== read.project || generation !== read.generation || editorEpoch !== read.editorEpoch)
    throw Error("Workspace, active alternative or inputs changed while reading the file. Choose the file again after reviewing the current inputs.");
  assertNoDrafts();
  return true;
}
function showError(msg) {
  error = msg;
  $("#error").innerHTML = `<div class="error">${e(msg)}</div>`;
}
function action(id) {
  try {
    if (id === "restore-valid") {
      workspace = structuredClone(lastValid);
      p = resolveProject(workspace);
      alignmentDraft = null;
      alignmentDraftTarget = null;
      curveDraft = null;
      mutate(() => {});
      shell();
      return;
    }
    if (id === "run") {
      assertNoDrafts();
      run();
    }
    if (id === "cancel") {
      worker?.terminate();
      worker = null;
      busy = false;
      stale = true;
      generation++;
      progress = "Run cancelled. Inputs preserved.";
      shell();
    }
    if (id === "save-recovery") saveRecovery();
    if (id === "recover-storage") openBrowserRecovery();
    if (id === "save-project") {
      assertNoDrafts();
      validateWorkspace(workspace);
      download(
        "railclear-workspace.json",
        JSON.stringify(workspace, null, 2),
        "application/json",
      );
    }
    if (id === "save-vehicle") {
      assertNoDrafts();
      validateWorkspace(workspace);
      download(
        "railclear-vehicle.json",
        JSON.stringify(p.vehicle, null, 2),
        "application/json",
      );
    }
    if (id === "import-project") {
      assertNoDrafts();
      $("#project-file").click();
    }
    if (id === "import-alignment") $("#alignment-file").click();
    if (id === "template")
      download(
        "railclear-alignment-template.csv",
        ALIGNMENT_EXAMPLE,
        "text/csv",
      );
    if (id === "apply-alignment") {
      if (alignmentDraft !== null)
        assertDraftTarget(workspace, alignmentDraftTarget, "alignment");
      const next = parseCSV($("#alignment-csv").value);
      mutate(() => (p.alignment = next));
      alignmentDraft = null;
      alignmentDraftTarget = null;
      error = "";
      persist();
      shell();
    }
    if (id === "apply-curves") {
      if (curveDraft !== null)
        assertDraftTarget(workspace, curveDraft.target, "vehicle");
      const b = JSON.parse($("#brake-curve").value),
        t = JSON.parse($("#traction-curve").value),
        next = structuredClone(p);
      next.vehicle.brakeCurve = b;
      next.vehicle.tractionCurve = t;
      const candidate = structuredClone(workspace);
      syncActive(candidate, next);
      validateWorkspace(candidate);
      mutate(() => {
        p = next;
        customVehicle();
      });
      curveDraft = null;
      error = "";
      persist();
      shell();
    }
    if (id === "discard-alignment") {
      alignmentDraft = null;
      alignmentDraftTarget = null;
      error = "";
      persist();
      shell();
    }
    if (id === "discard-curves") {
      curveDraft = null;
      error = "";
      persist();
      shell();
    }
    if (id === "prev") {
      page--;
      shell();
    }
    if (id === "next") {
      page++;
      shell();
    }
  } catch (ex) {
    showError(ex.message);
  }
}
function assertNoDrafts() {
  if (alignmentDraft !== null || curveDraft !== null)
    throw Error(
      "Apply or discard the alignment and performance-curve drafts before running or saving. Drafts remain available on their input tabs.",
    );
}
function customVehicle() {
  p.vehicle.id = "custom";
  p.vehicle.status = "User modified — unverified";
}
function persist() {
  try { validateWorkspace(workspace); }
  catch (ex) {
    error = "Invalid draft: " + ex.message + " Last valid workspace remains saved. Restore valid inputs or correct the field.";
    return;
  }
  lastValid = structuredClone(workspace);
  const saved = saveWorkspaceSnapshot(localStorage, workspace, storageExpected, { blocked: storageBlocked, draftsExpected: draftsBlocked ? undefined : draftsExpected });
  storageExpected = saved.expected;
  storageMessage = saved.message;
  // Preserve independently changed or malformed drafts even when inputs save.
  if (!saved.message && !draftsBlocked) {
    const savedDrafts = saveDraftSnapshot(localStorage, currentDrafts(), draftsExpected);
    draftsExpected = savedDrafts.expected;
    draftStorageMessage = savedDrafts.message;
  }
  const storageStatus = $("#storage-status");
  if (storageStatus) storageStatus.innerHTML = storageNotice();
  for (const button of storageStatus?.querySelectorAll?.('[data-action]') || []) button.onclick = () => action(button.dataset.action);
}
function currentDrafts() {
  return {workspaceId: workspace.id, alternativeId: workspace.activeStudyId, baseline: alignmentDraft !== null || curveDraft !== null ? captureDraftBaseline(workspace, {alignment:alignmentDraft,curves:curveDraft}) : null,
    alignment: alignmentDraft, alignmentTarget: alignmentDraftTarget, curves: curveDraft};
}
function storageNotice() {
  const message = [storageMessage, draftStorageMessage].filter(Boolean).join(' ');
  return message ? `<div class="storage-warning"><p>${e(message)}</p><div class="toolbar"><button data-action="save-recovery">Save recovery JSON</button><button data-action="recover-storage">Review browser recovery</button></div></div>` : '';
}
function recoveryCopiesView() {
  try {
    const copies=[];
    for(let i=0;i<localStorage.length;i++) {
      const key=localStorage.key(i);
      if(key?.startsWith('railclear.recovery.')) {
        let savedAt='Unknown date';
        try {savedAt=JSON.parse(localStorage.getItem(key)).savedAt || savedAt;} catch {}
        copies.push({key,savedAt});
      }
    }
    copies.sort((a,b)=>b.savedAt.localeCompare(a.savedAt));
    return copies.length ? `<details class="panel recovery-copies"><summary>Earlier browser data · ${copies.length} saved ${copies.length===1?'copy':'copies'}</summary><p class="note">These copies retain the exact browser strings before recovery. Download them for inspection; they may include damaged or unfinished data.</p><ul>${copies.map(copy=>`<li><span>${e(copy.savedAt)}</span><button data-recovery-copy="${e(copy.key)}">Download saved copy</button></li>`).join('')}</ul></details>` : '';
  } catch { return ''; }
}
function saveRecovery() {
  let browserSnapshot = null, browserReadError = null;
  try { browserSnapshot = readBrowserSnapshot(localStorage); } catch { browserReadError = 'Browser storage could not be read.'; }
  validateWorkspace(workspace);
  download('railclear-recovery.json',JSON.stringify({kind:'railclear-recovery',schemaVersion:1,workspace,drafts:currentDrafts(),browserSnapshot,browserReadError},null,2),'application/json');
}
function openBrowserRecovery() {
  editorEpoch++;
  const snapshot = readBrowserSnapshot(localStorage);
  const dialog = document.createElement('dialog');dialog.className='section-drawer recovery-dialog';dialog.setAttribute('aria-labelledby','recovery-title');
  dialog.innerHTML=`<div class="section-edit-form"><header class="drawer-header"><h2 id="recovery-title">Recover browser saving</h2></header><div class="drawer-body"><p>Use <strong>${e(workspace.name)}</strong> as this browser’s saved workspace. The existing browser data will be kept as a downloadable copy in Study.</p><p>Recovery JSON also saves unfinished alignment and curve drafts so you can reopen them later. Earlier browser data remains available in the file for inspection.</p><button data-recovery-download>Save recovery JSON</button><p class="drawer-form-error" role="alert" tabindex="-1" hidden></p></div><footer class="drawer-footer"><div class="drawer-actions"><button class="primary" data-recovery-apply>Use current session in browser</button><button data-recovery-cancel>Cancel</button></div></footer></div>`;
  dialog.querySelector('[data-recovery-download]').onclick=saveRecovery;
  dialog.querySelector('[data-recovery-cancel]').onclick=()=>dialog.close();
  dialog.querySelector('[data-recovery-apply]').onclick=()=>{
    try {
      validateWorkspace(workspace);
      recoverBrowserSaving(localStorage,snapshot,workspace,currentDrafts(),`railclear.recovery.${newId('snapshot')}`);
      storageExpected=localStorage.getItem(WORKSPACE_KEY);draftsExpected=localStorage.getItem(DRAFTS_KEY);
      storageBlocked=false;draftsBlocked=false;storageMessage='';draftStorageMessage='';
      progress="Browser saving recovered. Earlier browser data is available in Study.";shell();dialog.close();
    } catch(ex) {
      // Keep the original expected values/blocked state. A partial replacement
      // retains its backup; subsequent automatic writes still check both keys.
      const message=dialog.querySelector('.drawer-form-error');message.hidden=false;
      message.textContent=`Browser saving was not recovered: ${ex.message} Current inputs are still in this session. Save recovery JSON before closing.`;message.focus();
    }
  };
  dialog.addEventListener('close',()=>{dialog.remove();$('[data-action="recover-storage"]')?.focus();},{once:true});
  document.body.append(dialog);dialog.showModal();dialog.querySelector('[data-recovery-download]').focus();
}

async function run() {
  if (busy) return;
  let token;
  try {
    assertNoDrafts();
    planWorkspace(workspace);
    error = "";
    busy = true;
    progress = "Preparing study…";
    token = ++generation;
    const snapshot = structuredClone(workspace);
    worker?.terminate();
    worker = null;
    shell();

    if (token !== generation) return;
    worker = new Worker(new URL("./worker.mjs", import.meta.url), {
      type: "module",
    });
    worker.onmessage = ({ data }) => {
      if (token !== generation) return;
      if (data.type === "progress") {
        progress = `Computing ${data.alternative || "fleet"} · case ${data.done} of ${data.total}…`;
        $("#progress").textContent = progress;
      }
      if (data.type === "result") {
        fleetResult = data.result;
        result =
          fleetResult.members.find((m) => m.id === workspace.activeStudyId)
            ?.result || null;
        busy = false;
        stale = false;
        progress = "";
        worker.terminate();
        worker = null;
        tab="results";resultView="allocations";history.replaceState(null,"","#results");
        shell();
      }
      if (data.type === "error") {
        busy = false;
        worker.terminate();
        worker = null;
        progress = "";
        error = data.message;
        shell();
      }
    };
    worker.onerror = () => {
      if (token !== generation) return;
      busy = false;
      worker?.terminate();
      worker = null;
      progress = "";
      error =
        "Calculation worker failed. Inputs preserved; retry or save project JSON.";
      shell();
    };
    worker.postMessage(snapshot);
  } catch (ex) {
    if (token !== undefined && token !== generation) return;
    busy = false;
    progress = "";
    error = ex.message;
    shell();
  }
}
function exportResult(id) {
  if (stale || !result || busy) return;
  if (["svg", "trace-csv"].includes(id) && !result.governing) return;
  const stem = "railclear-" + id;
  const svg = trajectorySVG(result.governing);
  if (id === "results-csv")
    download(stem + ".csv", resultCSV(result), "text/csv");
  if (id === "trace-csv") download(stem + ".csv", traceCSV(result), "text/csv");
  if (id === "study-json")
    download(
      stem + ".json",
      JSON.stringify(portableWorkspaceResult(fleetResult), null, 2),
      "application/json",
    );
  if (id === "report-html")
    download(
      stem + ".html",
      reportHTML(
        {
          ...result,
          alternative: ((m) => ({
            id: m.id,
            name: m.name,
            vehicleId: m.vehicleId,
            routeId: m.routeId,
            profileId: m.profileId,
          }))(
            fleetResult.members.find((m) => m.id === workspace.activeStudyId),
          ),
          workspace: {
            ...fleetResult.workspace,
            activeStudyId: workspace.activeStudyId,
          },
        },
        svg,
      ),
      "text/html",
    );
  if (id === "svg") download(stem + ".svg", svg, "image/svg+xml");
}
function selectAlternative(id, { navigate = false } = {}) {
  assertNoDrafts();
  validateWorkspace(workspace);
  workspace.activeStudyId = id;
  p = resolveProject(workspace);
  result = stale
    ? null
    : fleetResult?.members.find((m) => m.id === id)?.result || null;
  if (navigate) tab = "study";
  persist();
  shell();
  if (navigate) {
    if (location.hash !== "#study") history.pushState(null, "", "#study");
    window.scrollTo(0, 0);
    $("#workspace-title").focus({ preventScroll: true });
  }
}
function changeWorkspace(fn, { structural = false } = {}) {
  assertNoDrafts();
  if (structural) {
    const candidate = structuredClone(workspace);
    syncActive(candidate, p);
    fn(candidate);
    validateWorkspace(candidate);
    undoWorkspace = structuredClone(workspace);
    mutate(() => {
      workspace = candidate;
      p = resolveProject(workspace);
    });
  } else
    mutate(() => {
      syncActive(workspace, p);
      fn(workspace);
      p = resolveProject(workspace);
    });
}
function fleetAction(id) {
  try {
    const a = workspace.alternatives.find(
      (x) => x.id === workspace.activeStudyId,
    );
    if (id === "preflight") {
      assertNoDrafts();
      const plan = planWorkspace(workspace);
      progress = `Input check passed: ${plan.members.length} enabled alternatives, ${plan.groupCount} comparison groups, ${plan.candidateCount.toLocaleString()} candidate cases. Stopping coverage and numerical checks occur during the run. ${plan.warnings.join(" ")}`;
      shell();
      return;
    }
    if (id === "add-alternative") {
      changeWorkspace(
        (w) =>
          w.alternatives.push({
            ...structuredClone(a),
            id: newId("case"),
            name: a.name + " · copy",
            enabled: true,
          }),
        { structural: true },
      );
      shell();
    }
    if (id === "add-allocation") {
      editAllocation(null);
      return;
    }
    if (id === "add-starters") {
      changeWorkspace((w) => addSyntheticFleet(w), { structural: true });
      shell();
    }
    if (id === "prune-unused") {
      changeWorkspace(
        (w) => {
          const used = (key) => new Set(w.alternatives.map((a) => a[key]));
          const vehicles = used("vehicleId"),
            profiles = used("profileId"),
            routes = used("routeId");
          for (const s of w.allocations) routes.add(s.routeId);
          w.vehicles = w.vehicles.filter((x) => vehicles.has(x.id));
          w.profiles = w.profiles.filter((x) => profiles.has(x.id));
          w.routes = w.routes.filter((x) => routes.has(x.id));
        },
        { structural: true },
      );
      shell();
    }
    if (id === "clone-vehicle") {
      changeWorkspace(
        (w) => {
          const old = w.vehicles.find((x) => x.id === a.vehicleId),
            copy = structuredClone(old);
          copy.id = newId("vehicle");
          copy.spec.name += " · copy";
          copy.spec.status = "User modified — unverified";
          w.vehicles.push(copy);
          w.alternatives.find((x) => x.id === w.activeStudyId).vehicleId =
            copy.id;
        },
        { structural: true },
      );
      shell();
    }
    if (id === "clone-profile") {
      changeWorkspace(
        (w) => {
          const copy = structuredClone(
            w.profiles.find((x) => x.id === a.profileId),
          );
          copy.id = newId("profile");
          copy.name += " · copy";
          w.profiles.push(copy);
          w.alternatives.find((x) => x.id === w.activeStudyId).profileId =
            copy.id;
        },
        { structural: true },
      );
      shell();
    }
    if (id === "clone-route") {
      changeWorkspace(
        (w) => {
          const oldId = a.routeId,
            copy = structuredClone(w.routes.find((x) => x.id === oldId));
          copy.id = newId("route");
          copy.name += " · variant";
          w.routes.push(copy);
          for (const section of w.allocations.filter(
            (x) => x.routeId === oldId,
          ))
            w.allocations.push({
              ...structuredClone(section),
              id: newId("section"),
              routeId: copy.id,
            });
          w.alternatives.find((x) => x.id === w.activeStudyId).routeId =
            copy.id;
        },
        { structural: true },
      );
      shell();
    }
    if (id === "undo") {
      assertNoDrafts();
      if (!undoWorkspace)
        throw Error("No structural change is available to undo.");
      const restore = undoWorkspace;
      undoWorkspace = null;
      mutate(() => {
        workspace = restore;
        p = resolveProject(workspace);
      });
      shell();
    }
    if (id === "section-template")
      download(
        "railclear-allocation-sections.csv",
        sectionsCSV(workspace),
        "text/csv",
      );
    if (id === "import-sections") $("#sections-file").click();
    if (id === "import-library") $("#library-file").click();
    if (id === "export-library") {
      assertNoDrafts();
      validateWorkspace(workspace);
      download(
        "railclear-input-libraries.json",
        JSON.stringify(
          {
            kind: "railclear-library",
            schemaVersion: 1,
            vehicles: workspace.vehicles,
            routes: workspace.routes,
            profiles: workspace.profiles,
            allocations: workspace.allocations,
          },
          null,
          2,
        ),
        "application/json",
      );
    }
  } catch (ex) {
    showError(ex.message);
  }
}
function editAllocation(id) {
  try {
    assertNoDrafts();
    validateWorkspace(workspace);
    const source = workspace.allocations.find(section => section.id === (id || allocationEditId)) || workspace.allocations[0];
    const section = id ? structuredClone(source) : { ...structuredClone(source), id: newId("section"), name: "", referenceId: "", fromM: null, toM: null, protectedPointM: null, enabled: true };
    allocationEditId = id;
    editorEpoch++;
    openSectionEditor({
      getWorkspace: () => workspace,
      section,
      create: !id,
      onApply: (updated, create) => {
        changeWorkspace(candidate => {
          if (create) candidate.allocations.push(updated);
          else candidate.allocations[candidate.allocations.findIndex(item => item.id === updated.id)] = updated;
        }, { structural: true });
        allocationEditId = updated.id;
        progress = `${updated.name} ${create ? "added" : "updated"}. Run the workspace to refresh results.`;
        shell();
      },
      returnFocus: () => $(`[data-edit-allocation="${section.id}"]`) || $('[data-fleet-action="add-allocation"]'),
    });
  } catch (error) { showError(error.message); }
}
function refreshAllocationRows() {
  if (!$("#allocation-rows")) return;
  const rendered = allocationRows(workspace, fleetResult, { stale, query: allocationQuery, routeId: allocationRoute, activeId: allocationEditId });
  $("#allocation-rows").innerHTML = rendered.html;
  $("#section-match-count").textContent = `${rendered.count} of ${workspace.allocations.length} sections`;
  for (const item of document.querySelectorAll("[data-enabled-count]")) {
    item.textContent = `${workspace[item.dataset.enabledCount].filter(record => record.enabled).length} in run`;
  }
  bindAllocationRows();
}
function bindAllocationRows() {
  for (const control of document.querySelectorAll("[data-allocation-enable]")) control.onchange = () => {
    try {
      const id = control.dataset.allocationEnable;
      changeWorkspace(candidate => { candidate.allocations.find(section => section.id === id).enabled = control.checked; });
      shell();
      $(`[data-allocation-enable="${id}"]`)?.focus({ preventScroll: true });
    } catch (error) { showError(error.message); }
  };
  for (const button of document.querySelectorAll("[data-edit-allocation]")) button.onclick = () => editAllocation(button.dataset.editAllocation);
  for (const button of document.querySelectorAll("[data-clear-section-filters]")) button.onclick = () => {
    allocationQuery = ""; allocationRoute = "";
    $("#section-search").value = ""; $("#section-route-filter").value = "";
    refreshAllocationRows(); $("#section-search").focus();
  };
}
function bindFleet() {
  $("[data-active-study]")?.addEventListener("change", (ev) => {
    try {
      selectAlternative(ev.target.value);
    } catch (ex) {
      ev.target.value = workspace.activeStudyId;
      showError(ex.message);
    }
  });
  document
    .querySelectorAll("[data-fleet-action]")
    .forEach((el) => (el.onclick = () => fleetAction(el.dataset.fleetAction)));
  document.querySelectorAll("[data-edit-alternative]").forEach(
    (el) =>
      (el.onclick = () => {
        try {
          selectAlternative(el.dataset.editAlternative, { navigate: true });
        } catch (ex) {
          showError(ex.message);
        }
      }),
  );
  document.querySelectorAll("[data-remove-alternative]").forEach(
    (el) =>
      (el.onclick = () => {
        try {
          changeWorkspace(
            (w) => {
              w.alternatives = w.alternatives.filter(
                (x) => x.id !== el.dataset.removeAlternative,
              );
              if (!w.alternatives.some((x) => x.id === w.activeStudyId))
                w.activeStudyId = w.alternatives[0].id;
            },
            { structural: true },
          );
          shell();
        } catch (ex) {
          showError(ex.message);
        }
      }),
  );
  document.querySelectorAll("[data-alternative-enable]").forEach(
    (el) =>
      (el.onchange = () => {
        try {
          changeWorkspace(
            (w) =>
              (w.alternatives.find(
                (x) => x.id === el.dataset.alternativeEnable,
              ).enabled = el.checked),
          );
          shell();
          $(`[data-alternative-enable="${el.dataset.alternativeEnable}"]`)?.focus({ preventScroll: true });
        } catch (ex) {
          showError(ex.message);
        }
      }),
  );
  document.querySelectorAll("[data-alternative-field]").forEach(
    (el) =>
      (el["onchange"] = () => {
        try {
          changeWorkspace(
            (w) =>
              (w.alternatives.find((x) => x.id === el.dataset.alternativeId)[
                el.dataset.alternativeField
              ] = el.value),
            { structural: true },
          );
          shell();
        } catch (ex) {
          el.value = workspace.alternatives.find(x => x.id === el.dataset.alternativeId)?.[el.dataset.alternativeField] ?? "";
          showError(ex.message);
        }
      }),
  );
  bindAllocationRows();
  $("#section-search")?.addEventListener("input", event => {
    allocationQuery = event.target.value;
    refreshAllocationRows();
  });
  $("#section-route-filter")?.addEventListener("change", event => {
    allocationRoute = event.target.value;
    refreshAllocationRows();
  });
  document.querySelectorAll("[data-library-field]").forEach(
    (el) =>
      (el.oninput = () => {
        try {
          changeWorkspace((w) => {
            const a = w.alternatives.find((x) => x.id === w.activeStudyId);
            if (el.dataset.libraryField === "profileName")
              w.profiles.find((x) => x.id === a.profileId).name = el.value;
            else
              w.routes.find((x) => x.id === a.routeId)[
                el.dataset.libraryField === "datum" ? "datum" : "name"
              ] = el.value;
          });
        } catch (ex) {
          showError(ex.message);
        }
      }),
  );
  document.querySelectorAll("[data-workspace-field]").forEach(
    (el) =>
      (el.oninput = () => {
        try {
          changeWorkspace((w) => {
            const k = el.dataset.workspaceField;
            if (k === "speedsKph")
              w.study.speedsKph = el.value
                .split(",")
                .map((x) => (x.trim() === "" ? NaN : Number(x)));
            else if (k === "spacingM")
              w.study.spacingM = el.value === "" ? NaN : Number(el.value);
            else
              w.probe[k === "probeStartM" ? "startM" : "speedKph"] =
                el.value === "" ? NaN : Number(el.value);
          });
        } catch (ex) {
          showError(ex.message);
        }
      }),
  );
  $("#fleet-group")?.addEventListener("change", (ev) => {
    fleetGroupId = ev.target.value;
    shell();
  });
  $("#fleet-metric")?.addEventListener("change", (ev) => {
    fleetMetric = ev.target.value;
    shell();
  });
  document
    .querySelectorAll("[data-fleet-export]")
    .forEach((el) => (el.onclick = () => fleetExport(el.dataset.fleetExport)));
  $("#sections-file").onchange = async (ev) => {
    const read = captureFileRead();
    try {
      assertNoDrafts();
      const file = ev.target.files[0];
      if (!file) return;
      if (file.size > 8e6) throw Error("Section CSV is limited to 8 MB.");
      const text = await file.text();
      if (!checkFileRead(read)) return;
      const next = parseSectionsCSV(text, workspace);
      changeWorkspace((w) => (w.allocations = next), { structural: true });
      allocationEditId = next[0].id;
      shell();
    } catch (ex) {
      if (read.token === alignmentImport) showError("Allocation sections not replaced: " + ex.message);
    } finally {
      if (read.token === alignmentImport) ev.target.value = "";
    }
  };
  $("#library-file").onchange = async (ev) => {
    const read = captureFileRead();
    try {
      assertNoDrafts();
      const file = ev.target.files[0];
      if (!file) return;
      if (file.size > 32e6) throw Error("Library JSON is limited to 32 MB.");
      const text = await file.text();
      if (!checkFileRead(read)) return;
      const data = JSON.parse(text),
        candidate = mergeLibrary(workspace, data);
      validateWorkspace(candidate);
      undoWorkspace = structuredClone(workspace);
      mutate(() => {
        workspace = candidate;
        p = resolveProject(workspace);
      });
      error = "";
      shell();
    } catch (ex) {
      if (read.token === alignmentImport) showError("Library not imported: " + ex.message);
    } finally {
      if (read.token === alignmentImport) ev.target.value = "";
    }
  };
}
function fleetExport(id) {
  try {
    if (stale || busy || !fleetResult) return;
    const r = fleetResult,
      g = r.groups.find((x) => x.id === fleetGroupId) || r.groups[0];
    if (id === "study-pack") downloadStudyPack(r);
    if (id === "allocation-csv")
      download(
        "railclear-section-allocations.csv",
        allocationCSV(r),
        "text/csv",
      );
    if (id === "bound-csv")
      download(
        "railclear-continuous-bounds.csv",
        continuousBoundsCSV(r),
        "text/csv",
      );
    if (id === "fleet-report")
      download(
        "railclear-fleet-report.html",
        workspaceReportHTML(r),
        "text/html",
      );
    if (id === "fleet-csv")
      download(
        "railclear-fleet-cases.csv",
        workspaceRegisterCSV(r),
        "text/csv",
      );
    if (id === "envelope-csv")
      download("railclear-fleet-envelope.csv", envelopeCSV(r), "text/csv");
    if (id === "overlay-csv")
      download(
        "railclear-common-entry-traces.csv",
        overlayTraceCSV(r),
        "text/csv",
      );
    if (id === "fleet-json")
      download(
        "railclear-fleet-study.json",
        JSON.stringify(portableWorkspaceResult(r), null, 2),
        "application/json",
      );
    if (id === "overlay-svg")
      download(
        "railclear-fleet-overlay.svg",
        trajectoryOverlaySVG(r, g),
        "image/svg+xml",
      );
    if (id === "envelope-svg")
      download(
        "railclear-fleet-envelope.svg",
        envelopeSVG(r, g, fleetMetric),
        "image/svg+xml",
      );
  } catch (ex) {
    showError(ex.message);
  }
}

function downloadStudyPack(r) {
 const token=generation;
 packWorker?.terminate();
 const current=new Worker(new URL('./pack-worker.mjs',import.meta.url),{type:'module'});packWorker=current;
 $('#progress').textContent='Preparing study pack…';
 current.onmessage=({data})=>{
  current.terminate();if(packWorker===current)packWorker=null;
  if(token!==generation||stale||busy||fleetResult!==r)return;
  $('#progress').textContent='';
  if(data.error)return showError('Study pack was not created: '+data.error);
  download('railclear-study-pack.zip',new Uint8Array(data.bytes),'application/zip');
 };
 current.onerror=()=>{current.terminate();if(packWorker===current)packWorker=null;if(token===generation){$('#progress').textContent='';showError('Study pack could not be created. Inputs and results remain available; use the separate exports.');}};
 current.postMessage(r);
}

function inspectSectionSample(button) {
 assertNoDrafts();if(stale||busy||!fleetResult)return;
 const token=generation,m=fleetResult.members.find(m=>m.id===button.dataset.inspectMember);
 const trace=calculateCase(m.project,Number(button.dataset.inspectStart),Number(button.dataset.inspectSpeed),{record:true});
 const dialog=document.createElement('dialog');dialog.className='case-inspector';dialog.setAttribute('aria-labelledby','sample-title');
 dialog.innerHTML=`<header><div><h2 id="sample-title">${e(m.name)}</h2><p>${ch(trace.startM)} · ${n(trace.speedKph)} km/h commanded · ${e(algorithmName(m.project))}</p></div><button data-close-sample aria-label="Close sample inspector">Close</button></header><dl class="input-facts"><div><dt>Raw first arrest</dt><dd>${n(trace.distanceM,3)} m</dd></div><div><dt>Protected distance</dt><dd>${n(trace.protectedM,3)} m</dd></div><div><dt>Margin beyond service</dt><dd>${n(trace.signedMarginM,3)} m</dd></div><div><dt>First arrest time</dt><dd>${n(trace.timeS,3)} s</dd></div></dl><div class="figure-scroll" tabindex="0" role="region" aria-label="Inspected section sample trajectory">${drawTrajectory(trace,m.project)}</div><p class="note">Sampled governing case. The continuous bound has a separate comparison model and governor.</p><div class="toolbar"><button data-sample-trace>Sample trace · CSV</button><button data-sample-figure>Trajectory figure · SVG</button><button data-open-alternative>Alternative details</button></div>`;
 const fresh=()=>token===generation&&!stale&&!busy;
 dialog.querySelector('[data-close-sample]').onclick=()=>dialog.close();
 dialog.querySelector('[data-sample-trace]').onclick=()=>{if(fresh())download('railclear-inspected-sample.csv',traceCSV({project:m.project,inputDigest:m.inputDigest,governing:trace}),'text/csv');};
 dialog.querySelector('[data-sample-figure]').onclick=()=>{if(fresh())download('railclear-inspected-sample.svg',drawTrajectory(trace,m.project),'image/svg+xml');};
 dialog.querySelector('[data-open-alternative]').onclick=()=>{dialog.close();selectAlternative(m.id,{navigate:true});};
 dialog.addEventListener('close',()=>{dialog.remove();if(button.isConnected)button.focus();},{once:true});
 document.body.append(dialog);dialog.showModal();dialog.querySelector('[data-close-sample]').focus();
}

shell();
