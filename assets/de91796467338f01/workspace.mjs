import {algorithmId} from './algorithms.mjs';
import { boundAllocations } from "./bounds.mjs";
import { DEFAULT, VEHICLES } from "./data.mjs";
import {
  validateProject,
  validateAlignment,
  compactAlignment,
  calculateCase,
  compareCase,
  studyCases,
  entryLimit,
  runStudy,
  ENGINE,
  InputError,
} from "./engine.mjs";
export const WORKSPACE_VERSION = 2;
export const LIMITS = {
  alternatives: 30,
  vehicles: 30,
  routes: 12,
  profiles: 30,
  casesPerAlternative: 2000,
  totalCases: 12000,
  allocations: 2000,
};
const need = (ok, message) => {
  if (!ok) throw new InputError(message);
};
const finite = (x, lo, hi, label) =>
  need(
    typeof x === "number" && Number.isFinite(x) && x >= lo && x <= hi,
    `${label} must be between ${lo} and ${hi}.`,
  );
const text = (s, label, max = 200) =>
  need(
    typeof s === "string" && s.trim().length > 0 && s.length <= max,
    `${label} must contain 1–${max} characters.`,
  );
export function newId(prefix) {
  return prefix + "-" + crypto.randomUUID().slice(0, 12);
}
export function fromProject(project, { templates = false } = {}) {
  validateProject(project);
  const w = {
    schemaVersion: 2,
    id: newId("workspace"),
    name: project.name,
    revision: project.revision || "",
    author: project.author || "",
    basis: project.basis || "",
    activeStudyId: "case-1",
    vehicles: [
      {
        id: "vehicle-1",
        spec: {
          ...structuredClone(project.vehicle),
          name:
            typeof project.vehicle.name === "string" &&
            project.vehicle.name.trim()
              ? project.vehicle.name
              : "Imported vehicle",
          status:
            typeof project.vehicle.status === "string" &&
            project.vehicle.status.trim()
              ? project.vehicle.status
              : "Unverified — imported legacy inputs",
          evidence:
            typeof project.vehicle.evidence === "string"
              ? project.vehicle.evidence
              : "Not provided in legacy project.",
        },
      },
    ],
    routes: [
      {
        id: "route-1",
        name: "Base alignment",
        datum: "Project chainage — confirm datum",
        alignment: structuredClone(project.alignment),
      },
    ],
    profiles: [
      {
        id: "profile-1",
        name: "Base failure profile",
        scenario: structuredClone(project.scenario),
      },
    ],
    allocations: [
      {
        id: "allocation-1",
        name: "Imported study section",
        routeId: "route-1",
        direction: project.scenario.direction,
        enabled: true,
        fromM: project.study.fromM,
        toM: project.study.toM,
        referenceKind: "engineering",
        referenceId: "",
        protectedPointM: null,
        metric: "selectedMarginM",
        roundM: project.scenario.roundM,
      },
    ],
    alternatives: [
      {
        id: "case-1",
        name: project.vehicle.name || "Base vehicle",
        vehicleId: "vehicle-1",
        routeId: "route-1",
        profileId: "profile-1",
        enabled: true,
      },
    ],
    study: structuredClone(project.study),
    probe: {
      startM: project.study.fromM,
      speedKph: Math.max(...project.study.speedsKph),
    },
  };
  if (templates)
    for (const v of VEHICLES)
      if (v.id !== project.vehicle.id) {
        const id = "vehicle-" + (w.vehicles.length + 1);
        w.vehicles.push({ id, spec: structuredClone(v) });
        w.alternatives.push({
          id: "case-" + (w.alternatives.length + 1),
          name: v.name,
          vehicleId: id,
          routeId: "route-1",
          profileId: "profile-1",
          enabled: true,
        });
      }
  return w;
}
export function defaultWorkspace() {
  const w = fromProject(DEFAULT, { templates: true });
  w.id = "synthetic-workspace";
  w.allocations = [
    [1000, 4000],
    [4000, 6500],
    [6500, 9000],
  ].map(([fromM, toM], i) => ({
    ...w.allocations[0],
    id: "allocation-" + (i + 1),
    name: "Track section " + (i + 1),
    fromM,
    toM,
    referenceKind: "track-section",
    referenceId: "SYN-TC-" + (i + 1),
  }));
  return w;
}
export function importWorkspace(data) {
  const source = data?.workspace || data?.project || data;
  const w =
    source?.schemaVersion === 2 ? structuredClone(source) : fromProject(source);
  validateWorkspace(w);
  return w;
}
export function workspaceInput(w) {
  const { activeStudyId, ...inputs } = w;
  return inputs;
}
export function resolveProject(w, id = w.activeStudyId) {
  const a = w.alternatives.find((x) => x.id === id);
  need(a, "Unknown alternative: " + id);
  const v = w.vehicles.find((x) => x.id === a.vehicleId),
    r = w.routes.find((x) => x.id === a.routeId),
    s = w.profiles.find((x) => x.id === a.profileId);
  need(v && r && s, "Alternative has a missing library reference: " + a.name);
  return {
    schemaVersion: 1,
    name: w.name,
    revision: w.revision,
    author: w.author,
    basis: w.basis,
    vehicle: structuredClone(v.spec),
    alignment: r.alignment,
    scenario: structuredClone(s.scenario),
    study: {
      ...structuredClone(w.study),
      ...allocationExtent(w, a.routeId, s.scenario.direction),
    },
  };
}
export function allocationExtent(w, routeId, direction) {
  const sections = w.allocations.filter(
    (x) => x.enabled && x.routeId === routeId && x.direction === direction,
  );
  return sections.length
    ? {
        fromM: Math.min(...sections.map((x) => x.fromM)),
        toM: Math.max(...sections.map((x) => x.toM)),
      }
    : { fromM: w.study.fromM, toM: w.study.toM };
}
export function syncActive(w, p) {
  const a = w.alternatives.find((x) => x.id === w.activeStudyId);
  need(a, "Active alternative is missing.");
  for (const k of ["name", "revision", "author", "basis"]) w[k] = p[k] ?? "";
  w.vehicles.find((x) => x.id === a.vehicleId).spec = structuredClone(
    p.vehicle,
  );
  w.routes.find((x) => x.id === a.routeId).alignment = structuredClone(
    p.alignment,
  );
  w.profiles.find((x) => x.id === a.profileId).scenario = structuredClone(
    p.scenario,
  );
  w.study.spacingM = p.study.spacingM;
  w.study.speedsKph = structuredClone(p.study.speedsKph);
  return w;
}
export function validateWorkspace(w) {
  need(
    w?.schemaVersion === 2,
    "Unsupported workspace schema; expected version 2.",
  );
  need(
    typeof w.id === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(w.id),
    "Workspace identifier is required.",
  );
  text(w.name, "Workspace name");
  for (const key of ["revision", "author", "basis"])
    need(
      typeof w[key] === "string" && w[key].length <= 10000,
      key + " must be text, at most 10,000 characters.",
    );
  for (const key of [
    "vehicles",
    "routes",
    "profiles",
    "alternatives",
    "allocations",
  ]) {
    need(
      Array.isArray(w[key]) &&
        w[key].length > 0 &&
        w[key].length <= LIMITS[key],
      `${key}: expected 1–${LIMITS[key]} entries.`,
    );
    const ids = new Set();
    for (const x of w[key]) {
      need(
        x && typeof x.id === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(x.id),
        "Invalid library identifier.",
      );
      need(!ids.has(x.id), "Duplicate " + key + " identifier: " + x.id);
      ids.add(x.id);
    }
  }
  for (const r of w.routes) {
    text(r.name, "Route name");
    text(r.datum, "Route chainage datum", 1000);
    validateAlignment(r.alignment);
  }
  const q = w.study;
  need(q, "Study range is required.");
  finite(q.fromM, -1e8, 1e8, "Study start");
  finite(q.toM, q.fromM, 1e8, "Study end");
  finite(q.spacingM, 1, 100000, "Spacing");
  need(
    Array.isArray(q.speedsKph) &&
      q.speedsKph.length > 0 &&
      q.speedsKph.length <= 40,
    "Specify 1–40 speed samples.",
  );
  for (const s of q.speedsKph) finite(s, 0, 400, "Speed sample");
  need(w.probe, "Common overlay entry is required.");
  finite(w.probe.startM, -1e8, 1e8, "Overlay chainage");
  finite(w.probe.speedKph, 0, 400, "Overlay speed");
  // Validate every library asset, including unused assets, without turning a
  // route/study coverage mismatch into an unrecorded portfolio-wide rejection.
  const dummy = structuredClone(DEFAULT);
  dummy.name = w.name;
  dummy.revision = w.revision;
  dummy.author = w.author;
  dummy.basis = w.basis;
  dummy.study = { fromM: 1000, toM: 1000, spacingM: 1, speedsKph: [1] };
  for (const v of w.vehicles) {
    text(v.spec?.name, "Vehicle name");
    need(
      typeof v.spec.evidence === "string" && v.spec.evidence.length <= 10000,
      "Vehicle evidence must be text.",
    );
    text(v.spec.status, "Vehicle status", 1000);
    validateProject({
      ...dummy,
      vehicle: v.spec,
      study: { ...dummy.study, speedsKph: [Math.min(1, v.spec.maxSpeedKph)] },
    });
  }
  for (const s of w.profiles) {
    text(s.name, "Profile name");
    validateProject({ ...dummy, scenario: s.scenario });
  }
  for (const a of w.allocations) {
    text(a.name, "Allocation section name");
    need(
      w.routes.some((r) => r.id === a.routeId),
      "Allocation route is missing.",
    );
    need(
      a.direction === 1 || a.direction === -1,
      "Allocation direction must be +1 or -1.",
    );
    need(
      typeof a.enabled === "boolean",
      "Allocation enabled flag must be boolean.",
    );
    finite(a.fromM, -1e8, 1e8, "Allocation start");
    finite(a.toM, a.fromM, 1e8, "Allocation end");
    need(
      ["signal", "track-section", "engineering"].includes(a.referenceKind),
      "Invalid allocation reference type.",
    );
    need(
      typeof a.referenceId === "string" && a.referenceId.length <= 200,
      "Signal/track-section reference must be text.",
    );
    if (a.protectedPointM !== null)
      finite(a.protectedPointM, -1e8, 1e8, "Protected point chainage");
    need(
      ["selectedMarginM", "protectedM"].includes(a.metric),
      "Choose an explicit allocation quantity.",
    );
    finite(a.roundM, 0.001, 100, "Allocation selection increment");
  }
  for (const a of w.alternatives) {
    text(a.name, "Alternative name");
    need(
      typeof a.enabled === "boolean",
      "Alternative enabled flag must be boolean.",
    );
    resolveProject(w, a.id);
  }
  need(
    w.alternatives.some((x) => x.id === w.activeStudyId),
    "Active alternative is missing.",
  );
  return w;
}
export function groupKey(a, p) {
  return `${a.routeId}/${p.scenario.direction}/${p.scenario.method}${algorithmId(p)==='rk4'?'':'/'+algorithmId(p)}`;
}
function commonStarts(w, group) {
  const first = group[0],
    sections = w.allocations.filter(
      (x) =>
        x.enabled &&
        x.routeId === first.routeId &&
        x.direction === first.project.scenario.direction,
    );
  need(
    sections.length > 0,
    `No enabled allocation sections for ${w.routes.find((r) => r.id === first.routeId).name}, direction ${first.project.scenario.direction}. Add or enable a matching section.`,
  );
  const intervals = [];
  for (const s of [...sections].sort((a, b) => a.fromM - b.fromM)) {
    const last = intervals.at(-1);
    if (last && s.fromM <= last[1]) last[1] = Math.max(last[1], s.toM);
    else intervals.push([s.fromM, s.toM]);
  }
  const inside = (x) => {
    let lo = 0,
      hi = intervals.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (intervals[mid][0] <= x) lo = mid + 1;
      else hi = mid;
    }
    return lo > 0 && x <= intervals[lo - 1][1];
  };
  const starts = new Set();
  for (const section of sections) {
    starts.add(section.fromM);
    starts.add(section.toM);
    for (let x = section.fromM; x < section.toM; x += w.study.spacingM) {
      starts.add(x);
      need(
        starts.size <= 2001,
        "Allocation grid exceeds 2,000 chainages; increase spacing or run fewer sections.",
      );
    }
  }
  const effectiveAlignment = compactAlignment(group[0].project.alignment);
  for (const m of group) {
    const p = m.project;
    for (const r of effectiveAlignment)
      for (const x of [
        r.fromM,
        r.toM,
        r.fromM + p.scenario.direction * p.vehicle.lengthM,
        r.toM + p.scenario.direction * p.vehicle.lengthM,
      ])
        if (inside(x)) starts.add(x);
  }
  need(
    starts.size <= 2001,
    "Vehicle and section boundaries exceed the common grid budget.",
  );
  return [...starts].sort((a, b) => a - b);
}
function reason(p, start, speed) {
  if (start < p.alignment[0].fromM || start > p.alignment.at(-1).toM)
    return {
      status: "failed",
      message: "Entry chainage is outside this route profile.",
    };
  if (speed > p.vehicle.maxSpeedKph)
    return {
      status: "not-applicable",
      message: "Above vehicle maximum commanded speed.",
    };
  if (speed > entryLimit(p.alignment, start))
    return {
      status: "not-applicable",
      message: "Above local entry civil speed.",
    };
  return null;
}
export function planWorkspace(w) {
  validateWorkspace(w);
  const enabled = w.alternatives.filter((x) => x.enabled);
  need(enabled.length > 0, "Enable at least one alternative.");
  const members = enabled.map((a) => ({
      ...a,
      project: resolveProject(w, a.id),
    })),
    groups = new Map();
  for (const m of members) {
    const key = groupKey(m, m.project);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }
  let candidateCount = 0;
  for (const [key, group] of groups) {
    const starts = commonStarts(w, group);
    const requestedMax = Math.max(...w.study.speedsKph);
    const commonCases = starts.flatMap((start) => {
      const speeds = new Set(w.study.speedsKph);
      for (const m of group)
        if (
          start >= m.project.alignment[0].fromM &&
          start <= m.project.alignment.at(-1).toM
        ) {
          const limit = Math.min(
            requestedMax,
            m.project.vehicle.maxSpeedKph,
            entryLimit(m.project.alignment, start),
          );
          if (limit > 0) speeds.add(limit);
        }
      return [...speeds].sort((a, b) => a - b).map((speed) => [start, speed]);
    });
    for (const m of group) {
      m.groupId = key;
      m.samples = commonCases.map(([start, speed]) => ({
        startM: start,
        speedKph: speed,
        ...(reason(m.project, start, speed) || { status: "pending" }),
      }));
      need(
        m.samples.length <= LIMITS.casesPerAlternative,
        `Alternative ${m.name} exceeds ${LIMITS.casesPerAlternative} common cases.`,
      );
      candidateCount += m.samples.length;
    }
  }
  need(
    candidateCount <= LIMITS.totalCases,
    `Workspace exceeds ${LIMITS.totalCases.toLocaleString()} candidate cases. Reduce alternatives, speeds or chainage density.`,
  );
  return {
    members,
    candidateCount,
    groupCount: groups.size,
    warnings: members.some((m) =>
      w.study.speedsKph.some(
        (speed) =>
          speed +
            m.project.scenario.overspeedKph +
            m.project.scenario.speedErrorKph ===
          0,
      ),
    )
      ? [
          "Zero true-speed entries require an unsupported release/holding model and will be retained as failed applicable cases. Remove those samples only if outside the intended study domain.",
        ]
      : [],
  };
}
function maxBy(rows, key) {
  return rows.reduce(
    (best, x) => (!best || compareCase(x, best, key) > 0 ? x : best),
    null,
  );
}
export function runWorkspace(w, onProgress = () => {}) {
  w = structuredClone(w);
  const plan = planWorkspace(w),
    members = [];
  let done = 0;
  for (const m of plan.members) {
    const p = m.project,
      eligible = m.samples.filter((x) => x.status === "pending"),
      results = [],
      failures = [];
    let result = null;
    // runStudy accepts the explicit common grid, retaining independent per-case
    // failures. It does not derive a different grid for each vehicle.
    if (eligible.length) {
      const project = {
        ...p,
        study: {
          ...p.study,
          fromM: Math.min(...eligible.map((x) => x.startM)),
          toM: Math.max(...eligible.map((x) => x.startM)),
          speedsKph: [...new Set(eligible.map((x) => x.speedKph))],
        },
      };
      result = runStudy(
        project,
        (progress) =>
          onProgress({
            done: done + progress.done,
            total: plan.candidateCount,
            alternative: m.name,
          }),
        {
          cases: eligible.map((x) => [x.startM, x.speedKph]),
          snapshotProject: false,
        },
      );
      results.push(...result.results);
      failures.push(...result.failures);
      const knownFailures = m.samples.filter((x) => x.status === "failed");
      result.failures.push(...knownFailures);
      result.caseCount += knownFailures.length;
      if (knownFailures.length) result.status = "incomplete";
    }
    const found = new Map(results.map((x) => [`${x.startM}/${x.speedKph}`, x])),
      failed = new Map(failures.map((x) => [`${x.startM}/${x.speedKph}`, x]));
    const rows = m.samples.map((s) => {
      if (s.status !== "pending") return s;
      const r = found.get(`${s.startM}/${s.speedKph}`);
      return r
        ? {
            ...r,
            status: r.firstStopBeforeFull ? "review-required" : "computed",
          }
        : {
            startM: s.startM,
            speedKph: s.speedKph,
            status: "failed",
            message:
              failed.get(`${s.startM}/${s.speedKph}`)?.message ||
              "No calculation returned.",
          };
    });
    const probeIssue = reason(p, w.probe.startM, w.probe.speedKph);
    let probe = probeIssue ? { ...w.probe, ...probeIssue } : null;
    if (!probe)
      try {
        probe = {
          ...calculateCase(p, w.probe.startM, w.probe.speedKph, {
            record: true,
          }),
          status: "computed",
        };
        if (probe.firstStopBeforeFull) probe.status = "review-required";
      } catch (ex) {
        probe = { ...w.probe, status: "failed", message: ex.message };
      }
    if (!result) {
      const known = m.samples.filter((x) => x.status === "failed");
      result = {
        engine: ENGINE,
        generatedAt: new Date().toISOString(),
        status: known.length ? "incomplete" : "no-applicable-cases",
        project: p,
        caseCount: known.length,
        results: [],
        failures: known,
        governing: null,
        selectedMarginM: null,
        warnings: [
          "No applicable trajectories were computed for this alternative. Inspect pre-check failures and exclusions in the full workspace record.",
          "The calculation profile is first forward arrest under explicit acceleration inputs; no project or fleet acceptance is established.",
        ],
      };
    }
    if (result)
      result.casePlan = m.samples.map((x) => ({
        startM: x.startM,
        speedKph: x.speedKph,
        status: x.status,
      }));
    const { samples, ...identity } = m;
    members.push({ ...identity, rows, result, probe });
    done += m.samples.length;
    onProgress({ done, total: plan.candidateCount, alternative: m.name });
  }
  const groups = [];
  for (const groupId of [...new Set(members.map((m) => m.groupId))]) {
    const ms = members.filter((m) => m.groupId === groupId),
      first = ms[0],
      route = w.routes.find((r) => r.id === first.routeId),
      rows = [];
    for (let i = 0; i < first.rows.length; i++) {
      const observations = ms.map((m) => ({
        ...m.rows[i],
        alternativeId: m.id,
      }));
      const valid = observations.filter((x) =>
          ["computed", "review-required"].includes(x.status),
        ),
        failures = observations.filter((x) => x.status === "failed"),
        excluded = observations.filter((x) => x.status === "not-applicable");
      const selectionBasis = maxBy(valid, "selectionBasisM"),
        selected = maxBy(valid, "selectedM"),
        protectedRow = maxBy(valid, "protectedM"),
        raw = maxBy(valid, "distanceM");
      const complete = failures.length === 0 && valid.length > 0;
      rows.push({
        startM: first.rows[i].startM,
        speedKph: first.rows[i].speedKph,
        status: failures.length
          ? "incomplete"
          : !valid.length
            ? "not-applicable"
            : valid.some((x) => x.status === "review-required")
              ? "review-required"
              : "computed",
        applicableCount: valid.length + failures.length,
        computedCount: valid.length,
        failedCount: failures.length,
        excludedCount: excluded.length,
        selectionBasisM: complete ? selectionBasis.selectionBasisM : null,
        selectionBasisBy: complete ? selectionBasis.alternativeId : null,
        partialSelectionBasisM: selectionBasis?.selectionBasisM ?? null,
        partialSelectionBasisBy: selectionBasis?.alternativeId ?? null,
        partialSelectedBy: selected?.alternativeId ?? null,
        partialProtectedBy: protectedRow?.alternativeId ?? null,
        partialRawBy: raw?.alternativeId ?? null,
        selectedMarginM: complete ? selected.selectedM : null,
        protectedM: complete ? protectedRow.protectedM : null,
        distanceM: complete ? raw.distanceM : null,
        partialSelectedMarginM: selected?.selectedM ?? null,
        partialProtectedM: protectedRow?.protectedM ?? null,
        partialDistanceM: raw?.distanceM ?? null,
        selectedBy: complete ? selected.alternativeId : null,
        protectedBy: complete ? protectedRow.alternativeId : null,
        rawBy: complete ? raw.alternativeId : null,
        failedAlternatives: failures.map((x) => x.alternativeId),
        excludedAlternatives: excluded.map((x) => x.alternativeId),
      });
    }
    groups.push({
      id: groupId,
      routeId: route.id,
      routeName: route.name,
      datum: route.datum,
      direction: first.project.scenario.direction,
      method: first.project.scenario.method,
      algorithm: algorithmId(first.project),
      alternativeIds: ms.map((x) => x.id),
      rows,
    });
  }
  const allocations = summarizeAllocations(w, groups, members);
  const continuousBounds = boundAllocations(w, members, allocations);
  const unavailableBoundCount = continuousBounds.filter(
    (x) => x.status !== "bounded",
  ).length;
  const unevaluatedAllocationCount = allocations.filter(
    (x) => x.status === "not-evaluated",
  ).length;
  const failedCount = members.reduce(
      (n, m) => n + m.rows.filter((r) => r.status === "failed").length,
      0,
    ),
    excludedCount = members.reduce(
      (n, m) => n + m.rows.filter((r) => r.status === "not-applicable").length,
      0,
    ),
    computedCount = plan.candidateCount - failedCount - excludedCount;
  const probeFailedCount = members.filter(
      (m) => m.probe.status === "failed",
    ).length,
    overlayStatus = probeFailedCount
      ? "incomplete"
      : members.some((m) => m.probe.status === "review-required")
        ? "review-required"
        : "computed";
  return {
    kind: "railclear-workspace-study",
    schemaVersion: 2,
    engine: ENGINE,
    generatedAt: new Date().toISOString(),
    status:
      failedCount || unevaluatedAllocationCount
        ? "incomplete"
        : !computedCount
          ? "no-applicable-cases"
          : overlayStatus !== "computed" ||
              members.some((m) =>
                m.rows.some((r) => r.status === "review-required"),
              )
            ? "review-required"
            : "computed",
    workspace: w,
    unevaluatedAllocationCount,
    probeFailedCount,
    overlayStatus,
    candidateCount: plan.candidateCount,
    computedCount,
    failedCount,
    excludedCount,
    members,
    groups,
    allocations,
    continuousBounds,
    continuousCoverageStatus: unavailableBoundCount ? "unavailable" : "bounded",
    unavailableBoundCount,
    warnings: [
      "Allocation sections define failure-entry domains, not limits of train motion. Trajectories may extend beyond section boundaries and require full route coverage. Boundaries belong to both neighboring sections. Only enabled sections are allocated.",
      "Envelopes are sampled maxima over applicable enabled alternatives on a common chainage/speed grid. They are not continuous guaranteed bounds.",
      "A failed applicable alternative makes the corresponding envelope unavailable. Partial maxima remain separately labeled in JSON and CSV.",
      "Route variants, direction and grade method are separate groups. A shared chainage datum does not prove that different route geometries are interchangeable.",
      "Common-entry trajectory overlays use the specified entry chainage and commanded speed, not each vehicle’s governing start. Different profiles may add different speed allowances.",
      "Mixed fleet means comparison of individual train first-arrest requirements. This version does not simulate two moving trains, fleet-pair headway, collisions or train-to-train separation.",
      "Built-in vehicles and examples are synthetic. Independent project/fleet/input/numerical review is required before design use.",
    ],
  };
}

export function summarizeAllocations(w, groups, members) {
  const output = [];
  for (const section of w.allocations.filter((x) => x.enabled)) {
    const matched = groups.filter(
      (g) => g.routeId === section.routeId && g.direction === section.direction,
    );
    if (!matched.length) {
      output.push({
        ...section,
        groupId: null,
        status: "not-evaluated",
        allocatedM: null,
        message:
          "No enabled vehicle/profile alternative matches this section route and direction.",
      });
      continue;
    }
    for (const g of matched) {
      const rows = g.rows.filter(
          (x) => x.startM >= section.fromM && x.startM <= section.toM,
        ),
        valueKey =
          section.metric === "selectedMarginM"
            ? "selectionBasisM"
            : "protectedM",
        partialKey =
          section.metric === "selectedMarginM"
            ? "partialSelectionBasisM"
            : "partialProtectedM",
        partialBy =
          section.metric === "selectedMarginM"
            ? "partialSelectionBasisBy"
            : "partialProtectedBy",
        valid = rows.filter((x) => Number.isFinite(x[valueKey])),
        failed = rows.filter((x) => x.status === "incomplete"),
        best = maxBy(valid, valueKey),
        partial = maxBy(
          rows.filter((x) => Number.isFinite(x[partialKey])),
          partialKey,
        ),
        complete = failed.length === 0 && valid.length > 0,
        key =
          section.metric === "selectedMarginM"
            ? "selectionBasisBy"
            : "protectedBy";
      const residuals =
        section.protectedPointM === null
          ? []
          : rows
              .filter((x) => Number.isFinite(x.protectedM))
              .map((x) => ({
                value:
                  section.direction * (section.protectedPointM - x.startM) -
                  x.protectedM,
                startM: x.startM,
                speedKph: x.speedKph,
                alternativeId: x.protectedBy,
              }));
      const residual = residuals.reduce(
        (m, x) => (!m || x.value < m.value ? x : m),
        null,
      );
      output.push({
        ...section,
        groupId: g.id,
        allocationKey: section.id + "/" + g.method + (g.algorithm==='rk4'?'':'/'+g.algorithm),
        method: g.method,
        algorithm: g.algorithm,
        status: failed.length
          ? "incomplete"
          : !valid.length
            ? "not-applicable"
            : rows.some((x) => x.status === "review-required")
              ? "review-required"
              : "computed",
        sampleCount: rows.length,
        failedSampleCount: failed.length,
        excludedCount: rows.reduce((n, x) => n + x.excludedCount, 0),
        allocatedM: complete
          ? Math.ceil(best[valueKey] / section.roundM - 1e-12) * section.roundM
          : null,
        observedMaxM: complete ? best[valueKey] : null,
        partialObservedMaxM: partial?.[partialKey] ?? null,
        partialGoverning: partial
          ? {
              startM: partial.startM,
              speedKph: partial.speedKph,
              alternativeId: partial[partialBy],
            }
          : null,
        governing: complete
          ? {
              startM: best.startM,
              speedKph: best.speedKph,
              alternativeId: best[key],
            }
          : null,
        minimumResidualM: complete && residual ? residual.value : null,
        residualCase: complete ? residual : null,
      });
    }
  }
  return output;
}

export function mergeLibrary(w, data) {
  const candidate = structuredClone(w);
  if (data?.kind === "railclear-library" && data.schemaVersion === 1) {
    const routeIds = new Map();
    for (const key of ["vehicles", "routes", "profiles"]) {
      need(
        Array.isArray(data[key]),
        "Library needs vehicles, routes and profiles arrays.",
      );
      const seen = new Set();
      for (const source of data[key]) {
        need(
          source && typeof source.id === "string" && !seen.has(source.id),
          "Library IDs must be present and unique within each asset type.",
        );
        seen.add(source.id);
        const copy = {
          ...structuredClone(source),
          id: newId(key.slice(0, -1)),
        };
        candidate[key].push(copy);
        if (key === "routes") routeIds.set(source.id, copy.id);
      }
    }
    if (data.allocations !== undefined) {
      need(
        Array.isArray(data.allocations),
        "Library allocations must be an array.",
      );
      for (const source of data.allocations) {
        need(
          routeIds.has(source.routeId),
          "Imported allocation references a route absent from its library.",
        );
        candidate.allocations.push({
          ...structuredClone(source),
          id: newId("section"),
          routeId: routeIds.get(source.routeId),
          enabled: false,
        });
      }
    }
  } else {
    const spec = data?.spec || data,
      vehicle = { id: newId("vehicle"), spec };
    candidate.vehicles.push(vehicle);
    candidate.alternatives.find(
      (x) => x.id === candidate.activeStudyId,
    ).vehicleId = vehicle.id;
  }
  validateWorkspace(candidate);
  return candidate;
}
export function addSyntheticFleet(w) {
  const active = w.alternatives.find((x) => x.id === w.activeStudyId);
  for (const spec of VEHICLES)
    if (!w.vehicles.some((x) => x.spec.id === spec.id)) {
      const vehicle = { id: newId("vehicle"), spec: structuredClone(spec) };
      w.vehicles.push(vehicle);
      w.alternatives.push({
        ...active,
        id: newId("case"),
        name: spec.name,
        vehicleId: vehicle.id,
        enabled: true,
      });
    }
  return w;
}

export function useVehicleTemplate(w, id) {
  const a = w.alternatives.find((x) => x.id === w.activeStudyId),
    old = w.vehicles.find((x) => x.id === a.vehicleId),
    template =
      id === "custom"
        ? {
            ...structuredClone(old.spec),
            id: "custom",
            name: old.spec.name + " / custom",
            status: "User modified — unverified",
          }
        : VEHICLES.find((x) => x.id === id);
  need(template, "Unknown vehicle template.");
  let entry =
    id === "custom"
      ? null
      : w.vehicles.find(
          (x) => JSON.stringify(x.spec) === JSON.stringify(template),
        );
  if (!entry) {
    entry = { id: newId("vehicle"), spec: structuredClone(template) };
    w.vehicles.push(entry);
  }
  a.vehicleId = entry.id;
  if (a.name === old.spec.name) a.name = entry.spec.name;
  validateWorkspace(w);
  return w;
}
