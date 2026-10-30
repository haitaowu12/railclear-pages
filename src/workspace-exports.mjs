import {algorithmId, algorithmName, algorithmIdentity} from './algorithms.mjs';
import { digest, esc, csvCell } from "./exports.mjs";
import { workspaceInput } from "./workspace.mjs";
import {
  trajectoryOverlaySVG,
  envelopeSVG,
  PALETTE,
  compatibleRouteGroups,
  routeVariantSVG,
} from "./workspace-charts.mjs";
export async function stampWorkspaceResult(r) {
  r.inputDigest = await digest(workspaceInput(r.workspace));
  for (const m of r.members) {
    m.inputDigest = await digest({
      project: m.project,
      cases: m.rows.map((x) => [x.startM, x.speedKph]),
      probe: r.workspace.probe,
    });
    if (m.result)
      m.result.inputDigest = await digest({
        project: m.result.project,
        casePlan: m.result.casePlan,
      });
  }
  return r;
}
const rowsCSV = (r, rows) =>
  [
    ["engine_id", "generated_utc", ...rows[0]],
    ...rows.slice(1).map((row) => [r.engine, r.generatedAt, ...row]),
  ]
    .map((row) => row.map(csvCell).join(","))
    .join("\n");
export function workspaceRegisterCSV(r) {
  const header = [
    "workspace_input_sha256",
    "alternative_id",
    "alternative_name",
    "vehicle_id",
    "route_id",
    "profile_id",
    "direction",
    "grade_method",
    "calculation_algorithm",
    "member_input_sha256",
    "entry_nose_m",
    "commanded_speed_kph",
    "case_status",
    "error_or_exclusion",
    "raw_first_arrest_m",
    "protected_distance_m",
    "ideal_service_reference_m",
    "signed_margin_m",
    "selected_sample_margin_m",
    "unrounded_margin_basis_m",
    "step_difference_m",
    "arrest_time_s",
    "peak_attained_kph",
    "obstacle_residual_m",
    "early_arrest_review",
  ];
  return rowsCSV(r, [
    header,
    ...r.members.flatMap((m) =>
      m.rows.map((x) => [
        r.inputDigest,
        m.id,
        m.name,
        m.vehicleId,
        m.routeId,
        m.profileId,
        m.project.scenario.direction,
        m.project.scenario.method,
        algorithmId(m.project),
        m.inputDigest,
        x.startM,
        x.speedKph,
        x.status,
        x.message,
        x.distanceM,
        x.protectedM,
        x.serviceM,
        x.signedMarginM,
        x.selectedM,
        x.selectionBasisM,
        x.numericalDeltaM,
        x.timeS,
        x.peakKph,
        x.residualM,
        x.firstStopBeforeFull,
      ]),
    ),
  ]);
}
export function envelopeCSV(r) {
  return rowsCSV(r, [
    [
      "workspace_input_sha256",
      "group_id",
      "route_id",
      "route_name",
      "chainage_datum",
      "direction",
      "grade_method",
    "calculation_algorithm",
      "entry_nose_m",
      "commanded_speed_kph",
      "envelope_status",
      "applicable_count",
      "computed_count",
      "failed_count",
      "excluded_count",
      "selected_margin_m",
      "unrounded_margin_basis_m",
      "margin_basis_by",
      "selected_by",
      "protected_distance_m",
      "protected_by",
      "raw_first_arrest_m",
      "raw_by",
      "partial_selected_margin_m",
      "partial_unrounded_margin_basis_m",
      "partial_margin_basis_by",
      "partial_protected_distance_m",
      "partial_raw_first_arrest_m",
      "failed_alternatives",
      "excluded_alternatives",
    ],
    ...r.groups.flatMap((g) =>
      g.rows.map((x) => [
        r.inputDigest,
        g.id,
        g.routeId,
        g.routeName,
        g.datum,
        g.direction,
        g.method,
        g.algorithm??"rk4",
        x.startM,
        x.speedKph,
        x.status,
        x.applicableCount,
        x.computedCount,
        x.failedCount,
        x.excludedCount,
        x.selectedMarginM,
        x.selectionBasisM,
        x.selectionBasisBy,
        x.selectedBy,
        x.protectedM,
        x.protectedBy,
        x.distanceM,
        x.rawBy,
        x.partialSelectedMarginM,
        x.partialSelectionBasisM,
        x.partialSelectionBasisBy,
        x.partialProtectedM,
        x.partialDistanceM,
        x.failedAlternatives.join(";"),
        x.excludedAlternatives.join(";"),
      ]),
    ),
  ]);
}
export function overlayTraceCSV(r) {
  return rowsCSV(r, [
    [
      "workspace_input_sha256",
      "alternative_id",
      "alternative_name",
      "route_id",
      "profile_id",
      "calculation_algorithm",
      "probe_entry_m",
      "probe_commanded_kph",
      "probe_status",
      "error_or_exclusion",
      "time_s",
      "nose_travel_m",
      "nose_chainage_m",
      "attained_kph",
      "phase",
    ],
    ...r.members.flatMap((m) =>
      m.probe.points
        ? m.probe.points.map((p) => [
            r.inputDigest,
            m.id,
            m.name,
            m.routeId,
            m.profileId,
            algorithmId(m.project),
            r.workspace.probe.startM,
            r.workspace.probe.speedKph,
            m.probe.status,
            "",
            p.t,
            p.d,
            p.frontM,
            p.v,
            p.phase,
          ])
        : [
            [
              r.inputDigest,
              m.id,
              m.name,
              m.routeId,
              m.profileId,
              algorithmId(m.project),
              r.workspace.probe.startM,
              r.workspace.probe.speedKph,
              m.probe.status,
              m.probe.message,
              "",
              "",
              "",
              "",
              "",
            ],
          ],
    ),
  ]);
}
const fmt = (x) =>
  x === null || x === undefined
    ? "Unavailable"
    : typeof x === "number"
      ? x !== 0 && Math.abs(x) < 0.001
        ? x.toExponential(3)
        : x.toFixed(3)
      : esc(x);
const table = (headers, rows) =>
  `<div class="table"><table><thead><tr>${headers.map((x) => `<th>${esc(x)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((x) => `<td class="${typeof x === "number" || x === "Unavailable" ? "nowrap" : ["computed", "incomplete", "review-required", "not-applicable", "not-evaluated"].includes(x) ? "status-cell" : ""}">${fmt(x)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
export function workspaceReportHTML(r) {
  const w = r.workspace,
    names = new Map(r.members.map((m) => [m.id, m.name]));
  const groups = r.groups
    .map((g) => {
      return `<section><h2>${esc(g.routeName)} · ${g.direction === 1 ? "increasing" : "decreasing"} chainage · ${esc(g.method)} · ${esc(algorithmName({scenario:{algorithm:g.algorithm}}))}</h2><p>Datum: ${esc(g.datum)}. Common overlay entry: ${fmt(w.probe.startM)} m / ${fmt(w.probe.speedKph)} km/h commanded. Different operating profiles may add different speed allowances.</p>${trajectoryOverlaySVG(r, g)}<h3>Margin basis before section rounding</h3>${envelopeSVG(r, g)}<h3>Protected first-arrest envelope</h3>${envelopeSVG(r, g, "protectedM")}<p>Black markers: maximum unrounded margin basis across applicable alternatives and speed samples at each sampled chainage. Gaps indicate incomplete results. Connecting lines guide the eye; intermediate chainage and speed values are not established.</p>${table(
        [
          "Entry m",
          "Speed km/h",
          "Status",
          "Applicable / computed / failed / excluded",
          "Margin basis m",
          "Margin governor",
          "Protected m",
          "Protected governor",
          "Raw arrest m",
          "Raw governor",
        ],
        g.rows.map((x) => [
          x.startM,
          x.speedKph,
          x.status,
          `${x.applicableCount} / ${x.computedCount} / ${x.failedCount} / ${x.excludedCount}`,
          x.selectionBasisM,
          names.get(x.selectionBasisBy) || "Unavailable",
          x.protectedM,
          names.get(x.protectedBy) || "Unavailable",
          x.distanceM,
          names.get(x.rawBy) || "Unavailable",
        ]),
      )}</section>`;
    })
    .join("");
  const seen = new Set(),
    routeComparisons = r.groups
      .map((g) => {
        const key = JSON.stringify([g.datum, g.direction, g.method,g.algorithm??"rk4"]);
        if (seen.has(key)) return "";
        seen.add(key);
        const compatible = compatibleRouteGroups(r, g);
        if (compatible.length < 2) return "";
        return `<h2>Route-variant comparison · ${g.direction === 1 ? "increasing" : "decreasing"} chainage</h2><p>Shared declared datum: ${esc(g.datum)}. Confirm coordinate comparability. Each route retains its own allocations; this figure does not create a merged route value.</p><div class="legend">${compatible.map((x, i) => `<span style="border-left:4px solid ${PALETTE[i % PALETTE.length]};padding-left:8px">${esc(x.routeName)}</span>`).join("")}</div>${routeVariantSVG(r, compatible)}`;
      })
      .join("");
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(w.name)} — RailClear mixed-fleet study</title><style>body{font:14px/1.6 system-ui;color:#1c3c31;max-width:1100px;margin:32px auto;padding:24px}h1{font-size:32px;line-height:1.2}h2{border-bottom:1px solid #cad7ce;padding-bottom:10px;margin-top:40px}.notice{border-left:4px solid #a66c0a;background:#fff3d6;padding:16px}table{border-collapse:collapse;width:100%;font-size:11px}th,td{text-align:left;padding:8px;border-bottom:1px solid #dce3df;overflow-wrap:anywhere;vertical-align:top}th{overflow-wrap:normal;word-break:normal}.nowrap{white-space:nowrap;overflow-wrap:normal}.status-cell{overflow-wrap:normal;word-break:normal}svg{width:100%;height:auto}.table{overflow:auto}.legend{display:flex;flex-wrap:wrap;gap:12px;font-size:11px}code,pre{white-space:pre-wrap;overflow-wrap:anywhere}details{margin:16px 0}@media print{body{max-width:none;margin:0;padding:0}thead{display:table-header-group}tr{break-inside:avoid}h2,h3{break-after:avoid}.table{overflow:visible}@page{size:A4 landscape;margin:15mm}}</style><body><p>RAILCLEAR · MIXED-FLEET CALCULATION RECORD · ${esc(r.engine)}</p><h1>${esc(w.name)}</h1><p>Revision ${esc(w.revision)} · ${esc(w.author || "Prepared by not specified")} · ${esc(r.generatedAt)}</p><div class="notice"><strong>ENGINEERING STUDY — INDEPENDENT REVIEW REQUIRED</strong><br>Status ${esc(r.status)}. ${r.computedCount} computed / ${r.candidateCount} candidate cases; ${r.failedCount} failed and ${r.excludedCount} inapplicable. Unavailable fleet values are never replaced with partial maxima.</div><p>Workspace input SHA-256: <code>${esc(r.inputDigest)}</code></p><p>Basis: ${esc(w.basis)}</p><section><h2>Calculation algorithms</h2><ul>${r.members.map(m=>`<li>${esc(m.name)}: ${esc(algorithmName(m.project))} · ${esc(algorithmIdentity(m.project))} · grade ${esc(m.project.scenario.method)}</li>`).join('')}</ul><p>Algorithms are compared in separate groups. Work–energy uses the acceleration-input model; no force/inertia, curvature, component-brake or ETCS equivalence is implied.</p></section>${continuousBoundsHTML(r)}<h2>Sampled section allocation register</h2>${table(
    [
      "Section / reference",
      "Route / direction / method",
      "Entry domain m",
      "Allocated quantity",
      "Status",
      "Allocated m",
      "Governing vehicle/profile alternative",
      "Entry m / speed km/h",
      "Protected-point residual m",
      "Residual governor (alternative / entry m / speed km/h)",
    ],
    r.allocations.map((a) => [
      a.name +
        " / " +
        a.referenceKind +
        " / " +
        a.referenceId +
        (a.protectedPointM === null
          ? ""
          : " / protected point " + a.protectedPointM + " m"),
      a.routeId + " / " + a.direction + " / " + a.method + " / " + (a.algorithm??"rk4"),
      a.fromM + "–" + a.toM,
      (a.metric === "selectedMarginM"
        ? "Margin beyond ideal service target"
        : "Protected first-arrest distance") +
        "; increment " +
        a.roundM +
        " m",
      a.status,
      a.allocatedM,
      a.governing ? names.get(a.governing.alternativeId) : "Unavailable",
      a.governing
        ? a.governing.startM + " / " + a.governing.speedKph
        : "Unavailable",
      a.minimumResidualM,
      a.residualCase
        ? `${names.get(a.residualCase.alternativeId) || a.residualCase.alternativeId} / ${a.residualCase.startM} / ${a.residualCase.speedKph}`
        : "Unavailable",
    ]),
  )}<h2>Compared alternatives</h2>${table(
    [
      "ID / alternative",
      "Vehicle",
      "Route",
      "Operating profile",
      "Computed / failed / inapplicable",
      "Input SHA-256",
    ],
    r.members.map((m) => [
      m.id + " / " + m.name,
      m.project.vehicle.name,
      w.routes.find((x) => x.id === m.routeId).name,
      w.profiles.find((x) => x.id === m.profileId).name,
      `${m.rows.filter((x) => x.status === "computed" || x.status === "review-required").length} / ${m.rows.filter((x) => x.status === "failed").length} / ${m.rows.filter((x) => x.status === "not-applicable").length}`,
      m.inputDigest,
    ]),
  )}${groups}${routeComparisons}<h2>Model and interpretation limits</h2><ul>${[...r.warnings, "Acceleration inputs already represent the chosen load/failure condition. Mass is record-only; uniform train-length gravity is used. No force/load scaling, rotational inertia, separate track brakes/BAM, dynamic adhesion/WSP, curvature, resistance, wind, service-controller dynamics or holding/restart is modeled.", "Nominal RK trajectories use additive position clearances. The separate continuous comparison bound covers the declared initial footprint interval through changing geometry. Step comparison remains numerical sensitivity, not a proven numerical error bound.", "An excluded speed is outside the specified vehicle/civil entry operating domain; it is not a successful stopping calculation. Civil limits along the failure path are not supervised."].map((x) => `<li>${esc(x)}</li>`).join("")}</ul><h2>Input libraries</h2>${w.vehicles
    .map(
      (v) =>
        `<h3>${esc(v.spec.name)} (${esc(v.id)})</h3>${table(
          ["Parameter", "Value"],
          Object.entries(v.spec).map(([k, v]) => [
            k,
            typeof v === "object" ? JSON.stringify(v) : v,
          ]),
        )}`,
    )
    .join(
      "",
    )}${w.profiles.map((p) => `<h3>${esc(p.name)} (${esc(p.id)})</h3>${table(["Parameter", "Value"], Object.entries(p.scenario))}`).join("")}<h3>Route profiles</h3>${table(
    [
      "ID / name",
      "Chainage datum",
      "Coverage from m",
      "Coverage to m",
      "Segments",
    ],
    w.routes.map((x) => [
      x.id + " / " + x.name,
      x.datum,
      x.alignment[0].fromM,
      x.alignment.at(-1).toM,
      x.alignment.length,
    ]),
  )}<p>Full ordered alignment segments, shared sampling settings, complete case registers, failures, exclusions, refinement histories and overlay trajectories are retained in the embedded JSON and standalone workspace-study JSON export.</p><h2>Independent review</h2><p>Reviewer: ____________________ Date: __________ Disposition: ____________________</p><details><summary>Full reproducible workspace and result JSON</summary><pre>${esc(JSON.stringify(portableWorkspaceResult(r), null, 2))}</pre></details></body></html>`;
}

export function portableWorkspaceResult(r) {
  return {
    ...r,
    members: r.members.map(({ project, result, ...m }) => ({
      ...m,
      calculationStudy: result?.project.study ?? null,
      result: result ? { ...result, project: undefined } : null,
    })),
  };
}
export function allocationCSV(r) {
  return rowsCSV(r, [
    [
      "workspace_input_sha256",
      "section_id",
      "section_name",
      "reference_kind",
      "reference_id",
      "route_id",
      "direction",
      "grade_method",
    "calculation_algorithm",
      "entry_domain_from_m",
      "entry_domain_to_m",
      "quantity",
      "round_increment_m",
      "status",
      "allocated_m",
      "observed_max_m",
      "governing_alternative_id",
      "governing_entry_m",
      "governing_speed_kph",
      "sample_count",
      "failed_sample_count",
      "excluded_count",
      "protected_point_m",
      "minimum_residual_m",
      "partial_observed_max_m",
      "allocation_result_id",
      "residual_alternative_id",
      "residual_entry_m",
      "residual_speed_kph",
      "partial_governing_alternative_id",
      "partial_governing_entry_m",
      "partial_governing_speed_kph",
    ],
    ...r.allocations.map((a) => [
      r.inputDigest,
      a.id,
      a.name,
      a.referenceKind,
      a.referenceId,
      a.routeId,
      a.direction,
      a.method,
      a.algorithm??"rk4",
      a.fromM,
      a.toM,
      a.metric,
      a.roundM,
      a.status,
      a.allocatedM,
      a.observedMaxM,
      a.governing?.alternativeId,
      a.governing?.startM,
      a.governing?.speedKph,
      a.sampleCount,
      a.failedSampleCount,
      a.excludedCount,
      a.protectedPointM,
      a.minimumResidualM,
      a.partialObservedMaxM,
      a.allocationKey,
      a.residualCase?.alternativeId,
      a.residualCase?.startM,
      a.residualCase?.speedKph,
      a.partialGoverning?.alternativeId,
      a.partialGoverning?.startM,
      a.partialGoverning?.speedKph,
    ]),
  ]);
}

export function continuousBoundsCSV(r) {
  return rowsCSV(r, [
    [
      "workspace_input_sha256",
      "section_id",
      "group_id",
      "route_id",
      "direction",
      "quantity",
      "bound_method",
      "input_algorithm",
      "fleet_bound_status",
      "fleet_allocated_upper_m",
      "fleet_bound_by",
      "partial_allocated_upper_m",
      "partial_bound_by",
      "fleet_protected_upper_m",
      "fleet_protected_bound_by",
      "fleet_margin_upper_m",
      "fleet_margin_bound_by",
      "fleet_residual_lower_m",
      "fleet_residual_bound_by",
      "alternative_id",
      "vehicle_id",
      "profile_id",
      "member_status",
      "member_allocated_upper_m",
      "member_protected_upper_m",
      "member_margin_upper_m",
      "member_residual_lower_m",
      "commanded_max_inclusive_kph",
      "position_error_min_m",
      "position_error_max_m",
      "reason_or_scope",
      "evidence_json",
    ],
    ...(r.continuousBounds || []).flatMap((b) =>
      (b.memberBounds.length ? b.memberBounds : [{}]).map((m) => [
        r.inputDigest,
        b.sectionId,
        b.groupId,
        b.routeId,
        b.direction,
        b.metric,
        b.method,
        r.groups.find(g=>g.id===b.groupId)?.algorithm??"rk4",
        b.status,
        b.allocatedUpperM,
        b.boundBy,
        b.partialAllocatedUpperM,
        b.partialBoundBy,
        b.protectedUpperM,
        b.protectedBoundBy,
        b.marginUpperM,
        b.marginBoundBy,
        b.residualLowerM,
        b.residualBoundBy,
        m.alternativeId,
        m.vehicleId,
        m.profileId,
        m.status,
        m.allocatedM,
        m.protectedUpperM,
        m.marginUpperM,
        m.residualLowerM,
        m.domain?.commandedMaxInclusiveKph,
        m.domain?.positionErrorMinM,
        m.domain?.positionErrorMaxM,
        m.message || b.message,
        JSON.stringify(m.evidence || null),
      ]),
    ),
  ]);
}
export function continuousBoundsHTML(r) {
  const names = new Map(r.workspace.alternatives.map((a) => [a.id, a.name]));
  return `<div class="continuous-bounds"><h2>Continuous section bounds · position uncertainty</h2><p>Bounds cover every section entry, initial physical-nose error ±front error, and all positive commanded speeds through each vehicle’s cap or the highest requested speed, whichever is lower. Civil entry filters are ignored. Every enabled alternative must establish a bound; zero-speed release and holding are excluded. Project input acceptance remains required.</p>${table(
    [
      "Section / route / direction",
      "Quantity",
      "Coverage",
      "Allocated upper m",
      "Bounding alternative",
      "Partial upper m / alternative",
      "Residual lower m / alternative",
      "Scope or refusal",
    ],
    (r.continuousBounds || []).map((b) => [
      `${r.workspace.allocations.find((s) => s.id === b.sectionId)?.name || b.sectionId} · ${r.workspace.routes.find((route) => route.id === b.routeId)?.name || b.routeId} · ${b.direction === 1 ? "increasing" : "decreasing"} · ${b.groupId?.split("/").at(-1) || "unassigned"}`,
      b.metric === "protectedM"
        ? "Protected first arrest"
        : "Margin beyond service",
      b.status === "bounded" ? "Bound established" : "Unavailable",
      b.allocatedUpperM === null ? null : String(b.allocatedUpperM),
      names.get(b.boundBy) || "Unavailable",
      b.status !== "bounded" && b.partialAllocatedUpperM !== null
        ? `${b.partialAllocatedUpperM} / ${names.get(b.partialBoundBy) || b.partialBoundBy}`
        : "—",
      b.residualLowerM === null
        ? "—"
        : `${b.residualLowerM} / ${names.get(b.residualBoundBy)}`,
      b.status === "bounded"
        ? `${b.memberBounds.length}/${b.memberBounds.length} alternatives; per-alternative speed/error domains and proof below.`
        : b.memberBounds
            .filter((m) => m.status !== "bounded")
            .map((m) => `${names.get(m.alternativeId)}: ${m.message}`)
            .join(" · ") || b.message,
    ]),
  )}<details><summary>Method, applicability and per-alternative evidence</summary><p>A self-containing corridor bounds adverse gravity. Minimum supplied brake and maximum traction apply, with traction removed at its specified cut. No brake credit until both full brake and traction cut. Exact decimal-rational calculation and section selection. These sufficient conditions can be pessimistic; an unavailable bound does not prove a train cannot stop. The bound covers the mathematical model and does not approve physical inputs or the project method.</p><pre>${esc(JSON.stringify(r.continuousBounds || [], null, 2))}</pre></details></div>`;
}
