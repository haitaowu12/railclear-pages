import {
  ALGORITHMS,
  algorithmId,
  algorithmIdentity,
  classicTrajectory,
  energyTrajectory,
} from "./algorithms.mjs";
export const ENGINE = "railclear-point-mass/0.4.0";
const G = 9.80665;
export class InputError extends Error {
  constructor(message) {
    super(message);
    this.name = "InputError";
  }
}
const need = (ok, msg) => {
  if (!ok) throw new InputError(msg);
};
const num = (n, min, max, label) =>
  need(
    typeof n === "number" && Number.isFinite(n) && n >= min && n <= max,
    `${label} must be a finite number between ${min} and ${max}.`,
  );
export function chainage(s) {
  if (typeof s === "number") return s;
  const t = String(s).trim();
  if (/^[+-]?\d+\+\d+(\.\d+)?$/.test(t)) {
    const sign = t.startsWith("-") ? -1 : 1;
    const [km, m] = t.replace(/^[+-]/, "").split("+").map(Number);
    need(m < 1000, "Chainage metres after + must be below 1000.");
    return sign * (km * 1000 + m);
  }
  need(
    t !== "" && /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t),
    "Invalid chainage or numeric value: " + t,
  );
  return Number(t);
}
function strictNumber(s) {
  need(
    !String(s).includes("+") || /e\+/i.test(s),
    "Only chainage columns accept km+metres notation.",
  );
  return chainage(s);
}
export function parseCSVRows(text, { preserveQuotedWhitespace = false } = {}) {
  need(
    typeof text === "string" && text.length <= 8_000_000,
    "CSV must be smaller than 8 MB.",
  );
  const rows = [];
  let row = [],
    field = "",
    quoted = false,
    closed = false,
    wasQuoted = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i <= input.length; i++) {
    const c = input[i];
    if (c === '"') {
      if (quoted && input[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        need(
          !closed && (quoted || field.trim() === ""),
          `Unexpected quote on row ${rows.length + 1}.`,
        );
        if (!quoted) {
          wasQuoted = true;
          if (preserveQuotedWhitespace) field = "";
        }
        if (quoted) closed = true;
        quoted = !quoted;
      }
    } else if ((c === "," || c === "\n" || c === undefined) && !quoted) {
      row.push(
        preserveQuotedWhitespace && wasQuoted
          ? field
          : field.trim().replace(/\r$/, ""),
      );
      field = "";
      closed = false;
      wasQuoted = false;
      if (c !== ",") {
        if (row.some(Boolean)) rows.push(row);
        row = [];
      }
    } else if (c !== undefined) {
      need(
        !closed || /\s/.test(c),
        `Unexpected character after closing quote on row ${rows.length + 1}.`,
      );
      if (!closed) field += c;
    }
  }
  need(!quoted, "CSV has an unclosed quote.");
  need(rows.length <= 20001, "Maximum 20,000 data rows.");
  return rows;
}
export function parseCSV(text) {
  const rows = parseCSVRows(text);
  need(rows.length >= 2, "CSV needs headers and at least one segment.");
  const headers = rows.shift().map((x) => x.toLowerCase());
  const expected = ["from_m", "to_m", "gradient_permille", "speed_kph"];
  need(
    headers.length === 4 &&
      new Set(headers).size === 4 &&
      expected.every((x) => headers.includes(x)),
    "Expected headers: " + expected.join(", "),
  );
  const at = (k) => headers.indexOf(k);
  const result = rows.map((r, i) => {
    need(r.length === 4, `CSV row ${i + 2} must have 4 columns.`);
    const read = (key, parse) => {
      try {
        return parse(r[at(key)]);
      } catch (ex) {
        throw new InputError(`Segment ${i + 1}, ${key}: ${ex.message}`);
      }
    };
    return {
      fromM: read("from_m", chainage),
      toM: read("to_m", chainage),
      gradientPermille: read("gradient_permille", strictNumber),
      speedKph: read("speed_kph", strictNumber),
    };
  });
  validateAlignment(result);
  return result;
}
export function validateAlignment(a) {
  need(
    Array.isArray(a) && a.length > 0 && a.length <= 20000,
    "Alignment must have 1–20,000 segments.",
  );
  a.forEach((r, i) => {
    num(r.fromM, -1e8, 1e8, `Row ${i + 1} start`);
    num(r.toM, -1e8, 1e8, `Row ${i + 1} end`);
    num(r.gradientPermille, -100, 100, `Row ${i + 1} grade`);
    num(r.speedKph, 1, 400, `Row ${i + 1} speed`);
    need(r.toM > r.fromM, `Row ${i + 1} end must exceed start.`);
    if (i)
      need(
        Math.abs(r.fromM - a[i - 1].toM) < 1e-7,
        `Row ${i + 1}: alignment must be ordered and contiguous; gap/overlap detected.`,
      );
  });
  return a;
}
export function compactAlignment(alignment) {
  const result = [];
  for (const row of alignment) {
    const last = result.at(-1);
    if (
      last &&
      last.toM === row.fromM &&
      last.gradientPermille === row.gradientPermille &&
      last.speedKph === row.speedKph
    )
      last.toM = row.toM;
    else result.push({ ...row });
  }
  return result;
}
function validateCurve(curve, label, positive) {
  need(
    Array.isArray(curve) && curve.length <= 1000,
    label + " must be an array of at most 1,000 points.",
  );
  curve.forEach((p, i) => {
    need(
      Array.isArray(p) && p.length === 2,
      label + " requires [speed_kph, acceleration_mps2] pairs.",
    );
    num(p[0], 0, 500, label + " speed");
    num(p[1], positive ? 0.0001 : 0, 5, label + " acceleration");
    if (i)
      need(p[0] > curve[i - 1][0], label + " speeds must increase strictly.");
  });
}
export function validateProject(p, { maxSpeedSamples = 80 } = {}) {
  need(
    p && typeof p === "object" && p.schemaVersion === 1,
    "Unsupported project schema; expected schemaVersion 1.",
  );
  need(
    typeof p.name === "string" &&
      p.name.trim().length > 0 &&
      p.name.length <= 200,
    "Project name is required (maximum 200 characters).",
  );
  for (const key of ["revision", "author", "basis"])
    need(
      p[key] === undefined ||
        (typeof p[key] === "string" && p[key].length <= 10000),
      key + " must be text, at most 10,000 characters.",
    );
  validateAlignment(p.alignment);
  const v = p.vehicle,
    s = p.scenario,
    q = p.study;
  need(v && s && q, "Project needs vehicle, scenario and study.");
  num(v.lengthM, 1, 2000, "Train length");
  num(v.massT, 1, 30000, "Train mass");
  num(v.maxSpeedKph, 1, 400, "Vehicle maximum speed");
  num(v.tractionA, 0, 3, "Traction acceleration");
  num(v.brakeA, 0.01, 3, "Emergency brake deceleration");
  num(v.serviceA, 0.01, 3, "Service brake deceleration");
  validateCurve(
    v.brakeCurve === undefined ? [] : v.brakeCurve,
    "Brake curve",
    true,
  );
  validateCurve(
    v.tractionCurve === undefined ? [] : v.tractionCurve,
    "Traction curve",
    false,
  );
  need(
    Object.hasOwn(ALGORITHMS, algorithmId(p)),
    "Unsupported calculation algorithm.",
  );
  need(s.direction === 1 || s.direction === -1, "Direction must be +1 or -1.");
  need(
    ["trajectory", "constant"].includes(s.method),
    "Unsupported calculation method.",
  );
  ["reactionS", "tractionDisableS", "brakeDelayS", "buildUpS"].forEach((k) =>
    num(s[k], 0, 30, k),
  );
  ["overspeedKph", "speedErrorKph"].forEach((k) => num(s[k], 0, 30, k));
  ["frontErrorM", "rearErrorM", "rollbackM", "extraM"].forEach((k) =>
    num(s[k], 0, 1000, k),
  );
  num(s.roundM, 0.001, 100, "Selection increment");
  num(s.dtS, 0.01, 0.5, "Integration time step");
  num(s.toleranceM, 0.0001, 1, "Convergence tolerance");
  num(s.maxTimeS, 1, 1200, "Maximum stopping time");
  num(s.constantGradePermille, -100, 100, "Constant grade");
  if (s.obstacleM !== null) num(s.obstacleM, -1e8, 1e8, "Obstacle chainage");
  num(q.fromM, -1e8, 1e8, "Study start");
  num(q.toM, -1e8, 1e8, "Study end");
  need(q.toM >= q.fromM, "Study end must not precede start.");
  num(q.spacingM, 1, 100000, "Chainage spacing");
  need(
    Array.isArray(q.speedsKph) &&
      q.speedsKph.length > 0 &&
      q.speedsKph.length <= maxSpeedSamples,
    `Specify 1–${maxSpeedSamples} commanded speeds.`,
  );
  q.speedsKph.forEach((x) => num(x, 0, v.maxSpeedKph, "Commanded speed"));
  const low = p.alignment[0].fromM,
    high = p.alignment.at(-1).toM;
  need(
    q.fromM >= low && q.toM <= high,
    "Study start/end must lie inside the alignment.",
  );
  return p;
}
function segmentIndex(a, x) {
  let lo = 0,
    hi = a.length - 1;
  while (lo < hi) {
    let m = Math.floor((lo + hi) / 2);
    if (x >= a[m].toM) lo = m + 1;
    else hi = m;
  }
  return lo;
}
export function segmentAt(a, x) {
  return a[segmentIndex(a, x)];
}
export function meanGrade(a, front, length, direction, sine = false) {
  const rear = front - direction * length,
    lo = Math.min(front, rear),
    hi = Math.max(front, rear);
  need(
    lo >= a[0].fromM - 1e-6 && hi <= a.at(-1).toM + 1e-6,
    "Train footprint or stopping trajectory leaves supplied alignment coverage.",
  );
  let i = segmentIndex(a, lo),
    sum = 0;
  while (i < a.length && a[i].fromM < hi) {
    let r = a[i++];
    sum +=
      Math.max(0, Math.min(hi, r.toM) - Math.max(lo, r.fromM)) *
      (sine
        ? r.gradientPermille /
          1000 /
          Math.sqrt(1 + (r.gradientPermille / 1000) ** 2)
        : r.gradientPermille);
  }
  return sum / length;
}
export function interpolateCurve(points, v, fallback) {
  if (!points?.length) return fallback;
  need(
    v >= points[0][0] - 1e-8 && v <= points.at(-1)[0] + 1e-8,
    "Speed-dependent performance curve does not cover the attained speed; extrapolation is disabled.",
  );
  for (let i = 1; i < points.length; i++)
    if (v <= points[i][0]) {
      let [x0, y0] = points[i - 1],
        [x1, y1] = points[i];
      return y0 + ((y1 - y0) * (v - x0)) / (x1 - x0);
    }
  return points.at(-1)[1];
}
function acceleration(p, start, t, d, v, tractionOn, brakeOn) {
  const s = p.scenario,
    V = p.vehicle,
    front = start + s.direction * d;
  const slope =
    s.method === "constant"
      ? s.constantGradePermille /
        1000 /
        Math.sqrt(1 + (s.constantGradePermille / 1000) ** 2)
      : meanGrade(p.alignment, front, V.lengthM, s.direction, true);
  // grade is rise/run in canonical increasing chainage; physical uniform-mass approximation.
  const g = -s.direction * G * slope;
  const cut = s.reactionS + s.tractionDisableS,
    brakeStart = s.reactionS + s.brakeDelayS;
  const traction =
    (tractionOn ?? t < cut)
      ? interpolateCurve(V.tractionCurve, Math.max(v, 0) * 3.6, V.tractionA)
      : 0;
  const fraction = !(brakeOn ?? t >= brakeStart)
    ? 0
    : s.buildUpS === 0
      ? 1
      : Math.max(0, Math.min(1, (t - brakeStart) / s.buildUpS));
  const b =
    fraction === 0
      ? 0
      : interpolateCurve(V.brakeCurve, Math.max(v, 0) * 3.6, V.brakeA) *
        fraction;
  return traction - b + g;
}
function integrate(p, start, speed, dt, record = false, untilTime = null) {
  const S = p.scenario;
  let t = 0,
    d = 0,
    v = (speed + S.overspeedKph + S.speedErrorKph) / 3.6,
    peak = v;
  if (S.method === "trajectory")
    meanGrade(p.alignment, start, p.vehicle.lengthM, S.direction);
  const points = [{ t: 0, d: 0, v: v * 3.6, frontM: start, phase: "initial" }];
  const cut = S.reactionS + S.tractionDisableS,
    beg = S.reactionS + S.brakeDelayS,
    full = beg + S.buildUpS;
  const events = [S.reactionS, cut, beg, full]
    .filter((x) => x > 0)
    .sort((a, b) => a - b);
  const phase = (t) => {
    const brake = t < beg ? "" : t < full ? "brake build-up" : "braking";
    return (
      [t < cut ? "traction" : "", brake].filter(Boolean).join(" + ") ||
      (t < S.reactionS ? "reaction" : "coast")
    );
  };
  need(
    v > 0,
    "Stationary initial states require a release/holding model and are unsupported. Supply a positive initial true speed.",
  );
  const knots =
    S.method === "trajectory"
      ? [
          ...new Set(
            p.alignment
              .flatMap((r) => [
                r.fromM,
                r.toM,
                r.fromM + S.direction * p.vehicle.lengthM,
                r.toM + S.direction * p.vehicle.lengthM,
              ])
              .map((x) => S.direction * (x - start))
              .filter((x) => x > 1e-7),
          ),
        ].sort((a, b) => a - b)
      : [];
  let knotIndex = 0;
  const speedKnots = [
    ...new Set(
      [...(p.vehicle.brakeCurve || []), ...(p.vehicle.tractionCurve || [])].map(
        (x) => x[0] / 3.6,
      ),
    ),
  ].sort((a, b) => a - b);
  function advance(h, tt = t, dd = d, vv = v) {
    // Timed discontinuities are partitioned. Freeze active schedules over this
    // interval, so an endpoint rounding to the next event cannot switch its force.
    const acc = (tt, dd, vv) =>
      acceleration(p, start, tt, dd, vv, t + h / 2 < cut, t + h / 2 >= beg);
    const a1 = acc(tt, dd, vv),
      v2 = vv + (a1 * h) / 2,
      a2 = acc(tt + h / 2, dd + (vv * h) / 2, v2),
      v3 = vv + (a2 * h) / 2,
      a3 = acc(tt + h / 2, dd + (v2 * h) / 2, v3),
      v4 = vv + a3 * h,
      a4 = acc(tt + h, dd + v3 * h, v4);
    return {
      d: dd + (h * (vv + 2 * v2 + 2 * v3 + v4)) / 6,
      v: vv + (h * (a1 + 2 * a2 + 2 * a3 + a4)) / 6,
      stages: [vv, v2, v3, v4],
    };
  }
  function accurate(h) {
    const first = advance(h / 2),
      last = advance(h / 2, t + h / 2, first.d, first.v);
    last.stages.push(...first.stages);
    return last;
  }
  function resolved(h, coarse, fine) {
    const lo = Math.min(v, coarse.v, fine.v, ...coarse.stages, ...fine.stages),
      hi = Math.max(v, coarse.v, fine.v, ...coarse.stages, ...fine.stages);
    // A whole weak-performance feature can hide between RK samples. Never skip
    // two curve knots, and resolve the local force slope before accepting a step.
    if (speedKnots.filter((k) => k > lo + 1e-12 && k < hi - 1e-12).length > 1)
      return false;
    let slope = 0;
    for (const curve of [
      p.vehicle.brakeCurve || [],
      p.vehicle.tractionCurve || [],
    ]) {
      let max = 0;
      for (let i = 1; i < curve.length; i++)
        if (curve[i][0] / 3.6 >= lo && curve[i - 1][0] / 3.6 <= hi)
          max = Math.max(
            max,
            Math.abs(
              (curve[i][1] - curve[i - 1][1]) /
                ((curve[i][0] - curve[i - 1][0]) / 3.6),
            ),
          );
      slope += max;
    }
    return (
      h * slope <= 0.4 &&
      Math.abs(coarse.v - fine.v) <= 1e-9 + 1e-8 * Math.abs(v) &&
      Math.abs(coarse.d - fine.d) <= 1e-9 + S.toleranceM * 1e-3
    );
  }
  let count = 0;
  while (t < S.maxTimeS) {
    if (untilTime !== null && t >= untilTime - 1e-12) {
      if (record && points.at(-1).t !== t)
        points.push({
          t,
          d,
          v: v * 3.6,
          frontM: start + S.direction * d,
          phase: phase(t),
        });
      return {
        distanceM: d,
        timeS: t,
        speedMps: v,
        peakKph: peak * 3.6,
        points,
        stopped: false,
      };
    }
    need(++count <= 150000, "Calculation exceeded the integration step limit.");
    let h = Math.min(
      dt,
      S.maxTimeS - t,
      untilTime === null ? Infinity : untilTime - t,
    );
    for (const ev of events) if (ev > t) h = Math.min(h, ev - t);
    // An RK stage may exceed coverage before a valid stop/event. Reduce the trial,
    // never extend or clamp the supplied profile. Accepted states retain strict checks.
    let next;
    for (;;) {
      try {
        const coarse = advance(h);
        next = accurate(h);
        if (resolved(h, coarse, next)) break;
        need(
          h >= 1e-10,
          "Speed-curve feature cannot be resolved within numerical limits.",
        );
      } catch (ex) {
        if (!/coverage|curve does not cover/.test(ex.message) || h < 1e-10)
          throw ex;
      }
      h /= 2;
    }
    // Locate a first-stop event before deciding whether an earlier spatial event exists.
    if (next.v <= 0) {
      let lo = 0,
        hi = h;
      for (let i = 0; i < 38; i++) {
        const mid = (lo + hi) / 2;
        if (accurate(mid).v > 0) lo = mid;
        else hi = mid;
      }
      h = (lo + hi) / 2;
      next = accurate(h);
      next.v = 0;
    }
    while (knotIndex < knots.length && knots[knotIndex] <= d + 1e-7)
      knotIndex++;
    if (knotIndex < knots.length && next.d > knots[knotIndex] + 1e-8) {
      let lo = 0,
        hi = h;
      for (let k = 0; k < 35; k++) {
        let mid = (lo + hi) / 2;
        if (accurate(mid).d < knots[knotIndex]) lo = mid;
        else hi = mid;
      }
      h = (lo + hi) / 2;
      next = accurate(h);
    }

    d = next.d;
    v = next.v;
    t += h;
    peak = Math.max(peak, v);
    if (S.method === "trajectory")
      meanGrade(
        p.alignment,
        start + S.direction * d,
        p.vehicle.lengthM,
        S.direction,
      );
    if (
      record &&
      (count % 5 === 0 || v === 0 || events.some((e) => Math.abs(e - t) < 1e-7))
    )
      points.push({
        t,
        d,
        v: v * 3.6,
        frontM: start + S.direction * d,
        phase: phase(t),
      });
    if (v === 0)
      return {
        distanceM: d,
        timeS: t,
        peakKph: peak * 3.6,
        points,
        firstStopBeforeFull: t < full - 1e-7,
        stopped: true,
      };
  }
  throw new InputError(
    "No stop within the time limit. Check downgrade, braking performance and supplied alignment coverage.",
  );
}
function solveTrajectory(p, start, speed, step, record) {
  const s = p.scenario,
    algorithm = algorithmId(p);
  need(
    algorithm !== "etcs",
    "ETCS is a profile definition only. Specification baseline, correction inputs and independently checked benchmarks are required. No fallback calculation was performed.",
  );
  const coverage = (d) => {
    if (s.method === "trajectory")
      meanGrade(
        p.alignment,
        start + s.direction * d,
        p.vehicle.lengthM,
        s.direction,
      );
  };
  if (algorithm === "classic") {
    const slope =
      s.method === "constant"
        ? s.constantGradePermille /
          1000 /
          Math.sqrt(1 + (s.constantGradePermille / 1000) ** 2)
        : meanGrade(p.alignment, start, p.vehicle.lengthM, s.direction, true);
    return classicTrajectory(
      p,
      start,
      speed,
      record,
      () => -s.direction * G * slope,
      coverage,
    );
  }
  if (algorithm === "energy") {
    const established = Math.max(
      s.reactionS + s.tractionDisableS,
      s.reactionS + s.brakeDelayS + s.buildUpS,
    );
    const prefix = integrate(p, start, speed, step, record, established);
    return energyTrajectory(
      p,
      start,
      speed,
      step * 12.5,
      record,
      prefix,
      (t, d, v) => acceleration(p, start, t, d, v, false, true),
      coverage,
    );
  }
  return integrate(p, start, speed, step, record);
}
function calculateCaseInternal(p, startM, speedKph, { record = false } = {}) {
  let dt = p.scenario.dtS,
    fine,
    delta = 0;
  const refinement = [];
  if (algorithmId(p) === "classic") {
    fine = solveTrajectory(p, startM, speedKph, dt, record);
    refinement.push({
      method: "exact phase equations",
      distanceM: fine.distanceM,
    });
  } else {
    let coarse = solveTrajectory(p, startM, speedKph, dt, false),
      successive = 0;
    refinement.push({ stepS: dt, distanceM: coarse.distanceM });
    for (let i = 0; i < 4; i++) {
      fine = solveTrajectory(p, startM, speedKph, dt / 2, record);
      delta = Math.abs(fine.distanceM - coarse.distanceM);
      refinement.push({
        stepS: dt / 2,
        spatialStepM: algorithmId(p) === "energy" ? (dt / 2) * 12.5 : undefined,
        distanceM: fine.distanceM,
        deltaM: delta,
      });
      successive = delta <= p.scenario.toleranceM ? successive + 1 : 0;
      if (successive >= 2) break;
      coarse = fine;
      dt /= 2;
    }
    need(
      successive >= 2,
      "Two successive refinements did not meet the distance tolerance. Refine the model or the step.",
    );
  }
  const s = p.scenario,
    allowance = s.frontErrorM + s.rearErrorM + s.rollbackM + s.extraM;
  const serviceM = (speedKph / 3.6) ** 2 / (2 * p.vehicle.serviceA),
    protectedM = fine.distanceM + allowance;
  const signedMarginM = protectedM - serviceM,
    marginM = Math.max(0, signedMarginM);
  const selectedM = Math.ceil((marginM + delta) / s.roundM - 1e-12) * s.roundM;
  const availableM =
    s.obstacleM === null ? null : s.direction * (s.obstacleM - startM);
  return {
    startM,
    speedKph,
    algorithm: algorithmId(p),
    algorithmIdentity: algorithmIdentity(p),
    ...fine,
    serviceM,
    allowanceM: allowance,
    protectedM,
    signedMarginM,
    marginM,
    selectedM,
    selectionBasisM: marginM + delta,
    numericalDeltaM: delta,
    refinement,
    usedStepS: algorithmId(p) === "classic" ? null : dt / 2,
    availableM,
    residualM: availableM === null ? null : availableM - protectedM,
  };
}
export function calculateCase(p, startM, speedKph, options = {}) {
  validateProject({
    ...p,
    study: { fromM: startM, toM: startM, spacingM: 1, speedsKph: [speedKph] },
  });
  return calculateCaseInternal(
    { ...p, alignment: compactAlignment(p.alignment) },
    startM,
    speedKph,
    options,
  );
}
export function entryLimit(a, x) {
  let i = segmentIndex(a, x);
  return i > 0 && Math.abs(a[i].fromM - x) < 1e-7
    ? Math.min(a[i - 1].speedKph, a[i].speedKph)
    : a[i].speedKph;
}
export function studyCases(p) {
  validateProject(p);
  const q = p.study,
    starts = new Set([q.fromM, q.toM]);
  for (let x = q.fromM; x < q.toM; x += q.spacingM) {
    starts.add(x);
    need(
      starts.size <= 2001,
      "Study exceeds 2,000 chainage samples; increase spacing.",
    );
  }
  // Include front and rear encounters with profile boundaries; still a sampled study, not a proof of a global envelope.
  for (const r of compactAlignment(p.alignment))
    for (const x of [
      r.fromM,
      r.toM,
      r.fromM + p.scenario.direction * p.vehicle.lengthM,
      r.toM + p.scenario.direction * p.vehicle.lengthM,
    ])
      if (x >= q.fromM && x <= q.toM) starts.add(x);
  const cases = [];
  for (const x of [...starts].sort((a, b) => a - b))
    for (const speed of [...new Set(q.speedsKph)].sort((a, b) => a - b))
      if (speed <= entryLimit(p.alignment, x)) cases.push([x, speed]);
  need(cases.length > 0, "No speed samples are within the local speed limits.");
  need(
    cases.length <= 2000,
    "Study exceeds 2,000 cases. Increase spacing or reduce speed samples.",
  );
  return cases;
}
// Shared diagnostic ordering; allocation quantities may legitimately differ.
export function compareCase(a, b, key = "selectedM") {
  for (const field of [
    key,
    "selectionBasisM",
    "signedMarginM",
    "protectedM",
    "distanceM",
    "speedKph",
  ]) {
    const x = a[field] ?? -Infinity,
      y = b[field] ?? -Infinity;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}
export function runStudy(p, onProgress = () => {}, options = {}) {
  validateProject(p, { maxSpeedSamples: options.cases ? 2000 : 80 });
  if (options.cases) {
    need(
      Array.isArray(options.cases) &&
        options.cases.length > 0 &&
        options.cases.length <= 2000,
      "Explicit study grid must have 1–2,000 cases.",
    );
    const seen = new Set();
    for (const c of options.cases) {
      need(
        Array.isArray(c) && c.length === 2,
        "Explicit cases require [chainage_m, speed_kph].",
      );
      num(c[0], p.study.fromM, p.study.toM, "Explicit entry chainage");
      num(c[1], 0, p.vehicle.maxSpeedKph, "Explicit commanded speed");
      need(
        c[1] <= entryLimit(p.alignment, c[0]),
        "Explicit case exceeds local entry speed.",
      );
      const key = c.join("/");
      need(!seen.has(key), "Duplicate explicit study case.");
      seen.add(key);
    }
  }
  const calculationProject = { ...p, alignment: compactAlignment(p.alignment) };
  const cases = options.cases || studyCases(p),
    results = [],
    failures = [];
  let governing = null;
  for (let i = 0; i < cases.length; i++) {
    let [start, speed] = cases[i];
    try {
      const r = calculateCaseInternal(calculationProject, start, speed);
      delete r.points;
      results.push(r);
      if (!governing || compareCase(r, governing) > 0) governing = r;
    } catch (e) {
      failures.push({ startM: start, speedKph: speed, message: e.message });
    }
    if (i % 5 === 0) onProgress({ done: i + 1, total: cases.length });
  }
  const trace = governing
    ? calculateCaseInternal(
        calculationProject,
        governing.startM,
        governing.speedKph,
        {
          record: true,
        },
      )
    : null;
  const selection = results.length
    ? results.reduce((m, x) => Math.max(m, x.selectedM), 0)
    : null;
  return {
    engine: ENGINE,
    generatedAt: new Date().toISOString(),
    status: failures.length
      ? "incomplete"
      : results.some((x) => x.firstStopBeforeFull)
        ? "review-required"
        : "computed",
    project: options.snapshotProject === false ? p : structuredClone(p),
    caseCount: cases.length,
    alignmentCompilation: {
      inputSegments: p.alignment.length,
      effectiveSegments: calculationProject.alignment.length,
    },
    results,
    failures,
    governing: trace,
    selectedMarginM: selection,
    warnings: [
      "Sampled engineering study. Not a certified ATP/ETCS algorithm or approved fleet model.",
      "All outputs describe first forward arrest; continued holding and rollback after that arrest are not simulated. Early arrest is flagged for review.",
      "Uniform mass over train length; gradient gravity only. No curvature, resistance, wheel slip dynamics, separate track brakes, BAM or jerk-limited service curve.",
      `Algorithm: ${algorithmIdentity(p)}. Classic uses exact phase equations under constant-rate/uniform-grade restrictions. Work–energy uses a timed RK4 prefix and spatial specific-energy propagation after full brake and traction removal. Numerical refinements are sensitivity evidence, not rigorous error bounds. No continuous maximum is asserted by a sampled solver.`,
      "Ideal service-target distance is a reference at the commanded speed and specified constant service deceleration; it is not a service-control simulation.",
      "Peak speed is the sampled maximum attained speed, not an authorised or permitted speed. Civil limits are used only to filter entry samples; intermediate speed-limit compliance is not evaluated.",
      "Location allowances are additive clearances; uncertainty is not propagated through changing gradient or speed profiles. Check applicability near discontinuities.",
    ],
  };
}
