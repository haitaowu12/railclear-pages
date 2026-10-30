import {algorithmId,algorithmIdentity} from './algorithms.mjs';
import { ENGINE } from "./engine.mjs";
export const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const numeric = (x) =>
  x === null || x === undefined ? "" : Number.isFinite(x) ? String(x) : "";
export function canonical(v) {
  if (typeof v === "number" && !Number.isFinite(v))
    throw Error("Non-finite number cannot identify a calculation.");
  if (Array.isArray(v))
    return "[" + v.map((x) => canonical(x) ?? "null").join(",") + "]";
  if (v && typeof v === "object")
    return (
      "{" +
      Object.keys(v)
        .sort()
        .filter((k) => v[k] !== undefined)
        .map((k) => JSON.stringify(k) + ":" + canonical(v[k]))
        .join(",") +
      "}"
    );
  return JSON.stringify(v);
}
export async function digest(p) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical(p)),
  );
  return [...new Uint8Array(hash)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
export function download(name, content, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
const comment = (x) => String(x ?? "").replace(/[,\r\n]/g, " ");
const cell = (x) =>
  '"' +
  (typeof x === "number"
    ? String(x)
    : String(x ?? "").replace(/^(\s*[=+@-]|[\t\r])/u, "'$&")
  ).replaceAll('"', '""') +
  '"';
export function resultCSV(r) {
  const cols = [
    "startM",
    "speedKph",
    "distanceM",
    "serviceM",
    "allowanceM",
    "protectedM",
    "signedMarginM",
    "marginM",
    "selectedM",
    "peakKph",
    "timeS",
    "numericalDeltaM",
    "usedStepS",
    "availableM",
    "residualM",
    "firstStopBeforeFull",
    "caseStatus",
    "error",
  ];
  const units = [
    "entry_nose_m",
    "commanded_speed_kph",
    "raw_first_arrest_m",
    "ideal_service_reference_m",
    "additive_allowance_m",
    "protected_distance_m",
    "signed_margin_beyond_service_m",
    "nonnegative_margin_m",
    "sample_selected_margin_m",
    "sampled_peak_attained_kph",
    "first_arrest_time_s",
    "step_comparison_delta_m",
    "integration_step_s",
    "obstacle_available_m",
    "obstacle_residual_m",
    "early_arrest_review",
    "case_status",
    "error",
  ];
  return [
    `# RailClear ${ENGINE}`,
    `# project=${comment(r.project.name)} revision=${comment(r.project.revision)}`,
    `# calculation_algorithm=${algorithmId(r.project)}; algorithm_identity=${algorithmIdentity(r.project)}`,
    `# input_sha256=${r.inputDigest}`,
    `# generated_utc=${r.generatedAt}`,
    `# direction=${r.project.scenario.direction}; raw distance datum=actual leading end at failure start`,
    `# full_inputs=companion RailClear study JSON; failed cases are retained below`,
    `# status=${r.status}; vehicle_basis=${comment(r.project.vehicle.status)}`,
    `# SAMPLE STUDY — INDEPENDENT ENGINEERING REVIEW REQUIRED; ${r.caseCount} candidate cases; ${r.failures.length} failures`,
    units.join(","),
    ...r.results.map((row) =>
      cols
        .map((k) =>
          cell(
            k === "caseStatus"
              ? row.firstStopBeforeFull
                ? "review-required"
                : "computed"
              : row[k],
          ),
        )
        .join(","),
    ),
    ...r.failures.map((row) =>
      cols
        .map((k) =>
          cell(
            k === "caseStatus"
              ? "failed"
              : k === "error"
                ? row.message
                : row[k],
          ),
        )
        .join(","),
    ),
  ].join("\n");
}
export function traceCSV(r) {
  return (
    "# " +
    ENGINE +
    " input_sha256=" +
    r.inputDigest +
    " algorithm=" + algorithmIdentity(r.project) +
    "\nt_s,distance_from_start_m,front_chainage_m,speed_kph,phase\n" +
    (r.governing?.points || [])
      .map((x) => [x.t, x.d, x.frontM, x.v, x.phase].map(cell).join(","))
      .join("\n")
  );
}
export function reportHTML(r, svg) {
  const p = r.project,
    fmt = (n) =>
      typeof n === "number"
        ? n !== 0 && Math.abs(n) < 0.001
          ? n.toExponential(3)
          : n.toFixed(3)
        : esc(n),
    kv = (o) =>
      "<table><tbody>" +
      Object.entries(o)
        .map(
          ([k, v]) =>
            "<tr><th>" +
            esc(k) +
            "</th><td>" +
            esc(typeof v === "object" ? JSON.stringify(v) : v) +
            "</td></tr>",
        )
        .join("") +
      "</tbody></table>";
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>${esc(p.name)} — RailClear calculation report</title><style>body{font:14px system-ui;color:#163b35;max-width:1100px;margin:40px auto;padding:24px}h1{font-size:32px}h2{border-bottom:1px solid #ccd6d2;padding-bottom:10px;margin-top:36px}.notice{padding:16px;background:#fff3d6;border-left:4px solid #a66c0a}table{border-collapse:collapse;width:100%;font-size:11px;margin:12px 0}th,td{text-align:left;border-bottom:1px solid #dce3e0;padding:7px;vertical-align:top;overflow-wrap:anywhere}svg{width:100%;height:auto}code{overflow-wrap:anywhere}@media print{body{margin:0;max-width:none}thead{display:table-header-group}tr{break-inside:avoid}h2{break-after:avoid}.notice{border:2px solid #a66c0a}button{display:none}@page{size:A4 landscape;margin:15mm}}</style><body><p>RAILCLEAR · CALCULATION RECORD · ${ENGINE}</p><h1>${esc(p.name)}</h1>${r.alternative ? `<p>Alternative: <strong>${esc(r.alternative.name)}</strong> (${esc(r.alternative.id)}) · vehicle ${esc(r.alternative.vehicleId)} · operating profile ${esc(r.alternative.profileId)} · route ${esc(r.alternative.routeId)}</p>` : ""}<p>Revision ${esc(p.revision)} · Prepared by ${esc(p.author || "Not specified")} · ${esc(r.generatedAt)}</p><div class="notice"><strong>ENGINEERING STUDY — INDEPENDENT REVIEW REQUIRED</strong><br>${esc(p.vehicle.status)}. Result status: ${esc(r.status)}. ${r.failures.length} failed cases. This is not a certified signalling output or an approved vehicle model.</div><p>Input SHA-256: <code>${esc(r.inputDigest)}</code></p><p>Basis: ${esc(p.basis)}</p><h2>Result and interpretation</h2><p>Maximum selected margin across sampled cases: <strong>${r.selectedMarginM === null ? "Unavailable" : fmt(r.selectedMarginM) + " m"}</strong>. This is an upward selection of sampled nonnegative margin plus step-comparison difference. It is not a continuous global envelope. Service reference and raw stopping distance have different meanings.</p><p>Figure: solid green = failure trajectory; dashed blue = ideal service reference; amber band = additional position and clearance allowances. Distances share the failure-start datum.</p>${svg}<h2>Model limitations</h2><ul>${r.warnings.map((x) => "<li>" + esc(x) + "</li>").join("")}</ul><h2>Vehicle sheet</h2>${kv(p.vehicle)}<h2>Scenario and numerical settings</h2>${kv(p.scenario)}<h2>Sampling settings</h2>${kv(p.study)}<h2>Alignment inputs</h2><table><thead><tr><th>From m</th><th>To m</th><th>Gradient ‰</th><th>Speed km/h</th></tr></thead><tbody>${p.alignment.map((x) => "<tr>" + [x.fromM, x.toM, x.gradientPermille, x.speedKph].map((v) => "<td>" + fmt(v) + "</td>").join("") + "</tr>").join("")}</tbody></table><h2>Sampled results</h2><table><thead><tr><th>Entry m</th><th>Speed km/h</th><th>Raw arrest m</th><th>Service reference m</th><th>Protected m</th><th>Signed margin m</th><th>Selected m</th><th>Peak km/h</th><th>Δ step m</th><th>Obstacle available m</th><th>Obstacle residual m</th><th>Early arrest review</th></tr></thead><tbody>${r.results.map((x) => "<tr>" + [x.startM, x.speedKph, x.distanceM, x.serviceM, x.protectedM, x.signedMarginM, x.selectedM, x.peakKph, x.numericalDeltaM, x.availableM, x.residualM, x.firstStopBeforeFull].map((v) => "<td>" + fmt(v) + "</td>").join("") + "</tr>").join("")}</tbody></table><h2>Failed cases</h2>${r.failures.length ? "<table><thead><tr><th>Entry m</th><th>Speed km/h</th><th>Failure reason</th></tr></thead><tbody>" + r.failures.map((f) => "<tr><td>" + fmt(f.startM) + "</td><td>" + fmt(f.speedKph) + "</td><td>" + esc(f.message) + "</td></tr>").join("") + "</tbody></table>" : "<p>None in this sampled run.</p>"}<h2>Governing trace</h2><p>Selected by greatest rounded sample selection, then greatest unrounded nonnegative margin to resolve ties. Full time/distance/speed points are in the embedded study JSON.</p><h2>Independent review</h2><p>Reviewer: ____________________ Date: __________ Disposition: ____________________</p><p>Scope, input authority, failure combinations, numerical resolution, continuous coverage and implementation acceptance remain reviewer responsibilities.</p><h2>Embedded reproducible study data</h2><p>The JSON below includes complete inputs, outputs, limitations and trace. Open the standalone study JSON to restore its inputs, then run again to independently recompute the outputs. Imported outputs are not accepted as current calculations.</p><details><summary>Full input/output JSON</summary><pre>${esc(JSON.stringify(r, null, 2))}</pre></details></body></html>`;
}
export { cell as csvCell };
