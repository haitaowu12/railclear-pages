// Numerical algorithm is separate from the grade and vehicle/failure model.
export const ALGORITHMS = {
  rk4: {
    name: "Time integration",
    detail:
      "RK4 trajectory with event timing, speed curves and finite-train gradient.",
    status: "implemented",
  },
  classic: {
    name: "Classic analytical",
    detail:
      "Exact phase equations. Constant rates and uniform gradient only; unsupported cases are refused.",
    status: "implemented",
  },
  energy: {
    name: "Work–energy",
    detail:
      "Timed trajectory to full brake and traction removal, then spatial integration of specific kinetic energy along the alignment.",
    status: "implemented",
  },
  etcs: {
    name: "ETCS braking curves",
    detail:
      "Profile definition only. Specification baseline, correction data and benchmark cases are required before implementation.",
    status: "definition",
  },
};
export const algorithmId = (p) => p.scenario.algorithm ?? "rk4";
export const algorithmName = (p) =>
  ALGORITHMS[algorithmId(p)]?.name ?? algorithmId(p);
export const algorithmIdentity = (p) => `railclear-${algorithmId(p)}/1.0.0`;
const insist = (ok, message) => {
  if (!ok) throw Error(message);
};
export function classicTrajectory(
  p,
  start,
  speed,
  record,
  gravity,
  checkCoverage,
) {
  const s = p.scenario,
    V = p.vehicle;
  insist(
    !V.brakeCurve?.length && !V.tractionCurve?.length,
    "Classic analytical requires constant brake and traction rates; choose time integration or work–energy for speed curves.",
  );
  insist(
    s.method === "constant" ||
      p.alignment.every(
        (r) => r.gradientPermille === p.alignment[0].gradientPermille,
      ),
    "Classic analytical requires a uniform gradient; choose time integration or work–energy for a changing alignment.",
  );
  const cut = s.reactionS + s.tractionDisableS,
    beg = s.reactionS + s.brakeDelayS,
    full = beg + s.buildUpS;
  let t = 0,
    d = 0,
    v = (speed + s.overspeedKph + s.speedErrorKph) / 3.6,
    peak = v;
  insist(
    v > 0,
    "Stationary initial states require a release/holding model and are unsupported.",
  );
  checkCoverage(0);
  const points = [{ t, d, v: v * 3.6, frontM: start, phase: "initial" }];
  const events = [
      ...new Set(
        [0, s.reactionS, cut, beg, full, s.maxTimeS].filter(
          (x) => x >= 0 && x <= s.maxTimeS,
        ),
      ),
    ].sort((a, b) => a - b),
    g = gravity();
  for (let i = 0; i < events.length - 1; i++) {
    const end = events[i + 1],
      h = end - t,
      mid = t + h / 2,
      rate = mid < beg ? 0 : mid < full ? V.brakeA / s.buildUpS : 0;
    const brakeAtStart =
        mid < beg ? 0 : mid < full ? rate * (t - beg) : V.brakeA,
      a = (mid < cut ? V.tractionA : 0) - brakeAtStart + g;
    const velocity = (u) => v + a * u - (rate * u * u) / 2,
      distance = (u) => d + v * u + (a * u * u) / 2 - (rate * u * u * u) / 6;
    const stop = velocity(h) <= 0;
    let used = h;
    if (stop) {
      let lo = 0,
        hi = h;
      for (let j = 0; j < 55; j++) {
        const m = (lo + hi) / 2;
        if (velocity(m) > 0) lo = m;
        else hi = m;
      }
      used = (lo + hi) / 2;
    }
    const peakAt =
      rate > 0 ? Math.max(0, Math.min(used, a / rate)) : a > 0 ? used : 0;
    peak = Math.max(peak, velocity(peakAt));
    if (record)
      for (let j = 1; j <= 8; j++) {
        const u = (used * j) / 8;
        points.push({
          t: t + u,
          d: distance(u),
          v: Math.max(0, velocity(u)) * 3.6,
          frontM: start + s.direction * distance(u),
          phase:
            mid < beg
              ? "reaction / traction"
              : mid < full
                ? "brake build-up"
                : "braking",
        });
      }
    d = distance(used);
    v = stop ? 0 : velocity(used);
    t += used;
    checkCoverage(d);
    if (stop) {
      if (record) points.at(-1).v = 0;
      return {
        distanceM: d,
        timeS: t,
        peakKph: peak * 3.6,
        points,
        firstStopBeforeFull: t < full - 1e-7,
      };
    }
  }
  throw Error(
    "No stop within the time limit. Check downgrade and braking performance.",
  );
}
export function energyTrajectory(
  p,
  start,
  speed,
  stepM,
  record,
  prefix,
  acc,
  checkCoverage,
) {
  const s = p.scenario;
  if (prefix.stopped) return prefix;
  let d = prefix.distanceM,
    t = prefix.timeS,
    q = prefix.speedMps ** 2 / 2,
    peak = prefix.peakKph;
  const points = prefix.points,
    knots =
      s.method === "trajectory"
        ? [
            ...new Set(
              p.alignment
                .flatMap((r) => [
                  r.fromM,
                  r.toM,
                  r.fromM + s.direction * p.vehicle.lengthM,
                  r.toM + s.direction * p.vehicle.lengthM,
                ])
                .map((x) => s.direction * (x - start))
                .filter((x) => x > d),
            ),
          ].sort((a, b) => a - b)
        : [];
  const speedKnots = (p.vehicle.brakeCurve || []).map(([v]) => v / 3.6);
  let ki = 0,
    count = 0;
  const force = (dd, qq) => acc(t, dd, Math.sqrt(Math.max(0, 2 * qq)));
  const advance = (dd, qq, h) => {
    const a = force(dd, qq),
      b = force(dd + h / 2, qq + (h * a) / 2),
      c = force(dd + h / 2, qq + (h * b) / 2),
      e = force(dd + h, qq + h * c);
    return {
      q: qq + (h * (a + 2 * b + 2 * c + e)) / 6,
      stages: [qq, qq + (h * a) / 2, qq + (h * b) / 2, qq + h * c],
    };
  };
  while (t < s.maxTimeS) {
    insist(
      ++count <= 150000,
      "Work–energy calculation exceeded the spatial step limit.",
    );
    while (ki < knots.length && knots[ki] <= d + 1e-8) ki++;
    let h = Math.min(stepM, ki < knots.length ? knots[ki] - d : stepM),
      next;
    for (;;) {
      try {
        const coarse = advance(d, q, h),
          first = advance(d, q, h / 2),
          last = advance(d + h / 2, first.q, h / 2);
        const speeds = [
            q,
            coarse.q,
            first.q,
            last.q,
            ...coarse.stages,
            ...first.stages,
            ...last.stages,
          ].map((x) => Math.sqrt(Math.max(0, 2 * x))),
          lo = Math.min(...speeds),
          hi = Math.max(...speeds);
        // A positive endpoint must not hide a zero-energy excursion and
        // downhill recovery inside the interval. Reduce until the first arrest
        // is bracketed, or all sampled stages retain positive energy.
        const hiddenArrest =
          last.q > 0 &&
          [
            coarse.q,
            first.q,
            ...coarse.stages,
            ...first.stages,
            ...last.stages,
          ].some((x) => x <= 0);
        if (
          !hiddenArrest &&
          speedKnots.filter((v) => v > lo + 1e-12 && v < hi - 1e-12).length <=
            1 &&
          Math.abs(coarse.q - last.q) < 1e-9 + Math.abs(q) * 1e-9
        ) {
          next = last;
          break;
        }
      } catch (ex) {
        if (!/coverage|curve does not cover/.test(ex.message)) throw ex;
      }
      h /= 2;
      insist(
        h > 1e-10,
        "Work–energy step could not be resolved within supplied coverage / performance curves.",
      );
    }
    if (next.q <= 0) {
      let lo = 0,
        hi = h;
      for (let j = 0; j < 45; j++) {
        const m = (lo + hi) / 2,
          f = advance(d, q, m / 2),
          l = advance(d + m / 2, f.q, m / 2);
        if (l.q > 0) lo = m;
        else hi = m;
      }
      h = (lo + hi) / 2;
      next.q = 0;
    }
    const v = Math.sqrt(2 * q),
      vn = Math.sqrt(Math.max(0, 2 * next.q)),
      elapsed = (2 * h) / (v + vn);
    insist(
      Number.isFinite(elapsed) && elapsed > 0,
      "Work–energy could not determine a positive travel time.",
    );
    insist(t + elapsed <= s.maxTimeS + 1e-9, "No stop within the time limit.");
    d += h;
    t += elapsed;
    q = Math.max(0, next.q);
    peak = Math.max(peak, vn * 3.6);
    checkCoverage(d);
    if (record && (count % 5 === 0 || q === 0))
      points.push({
        t,
        d,
        v: vn * 3.6,
        frontM: start + s.direction * d,
        phase: "established braking · energy",
      });
    if (q === 0)
      return {
        distanceM: d,
        timeS: t,
        peakKph: peak,
        points,
        firstStopBeforeFull: false,
      };
  }
  throw Error("No stop within the time limit.");
}
