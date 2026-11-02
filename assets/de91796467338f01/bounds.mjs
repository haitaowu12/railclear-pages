import { validateProject, InputError } from "./engine.mjs";
import * as R from "./rational.mjs";
export const BOUND_METHOD = "railclear-continuous-decimal/1.0.0";
const Q = R.decimal,
  Z = Q(0),
  TWO = Q(2),
  KPH = Q(3.6),
  G = Q(9.80665);
const need = (x, message) => {
  if (!x) throw new InputError(message);
};
const fraction = (a, direction = 1) => ({
  value: R.outward(a, direction),
  ...R.exact(a),
});

// Independent comparison system. No RK force, interpolation, stepping or sampling
// helper is reused. Bounds the declared decimal mathematical acceleration model.
export function boundSection(project, section, requestedMaximumKph) {
  const result = {
    method: BOUND_METHOD,
    status: "unavailable",
    message: null,
    allocatedM: null,
    protectedUpperM: null,
    marginUpperM: null,
    residualLowerM: null,
    domain: {
      fromM: section.fromM,
      toM: section.toM,
      direction: section.direction,
      commandedMinExclusiveKph: 0,
      commandedMaxInclusiveKph: null,
      positionErrorMinM:
        project.scenario.frontErrorM === 0 ? 0 : -project.scenario.frontErrorM,
      positionErrorMaxM: project.scenario.frontErrorM,
      reference:
        "nominal physical leading end; positive error is ahead along travel",
    },
  };
  try {
    need(
      section &&
        Number.isFinite(section.fromM) &&
        Number.isFinite(section.toM) &&
        section.toM >= section.fromM,
      "Invalid closed section domain.",
    );
    need(
      ["protectedM", "selectedMarginM"].includes(section.metric),
      "Unknown allocation quantity.",
    );
    need(
      Number.isFinite(section.roundM) &&
        section.roundM >= 0.001 &&
        section.roundM <= 100,
      "Invalid section selection increment.",
    );
    need(
      section.protectedPointM === null ||
        Number.isFinite(section.protectedPointM),
      "Invalid protected-point chainage.",
    );
    validateProject({
      ...project,
      study: {
        fromM: section.fromM,
        toM: section.toM,
        spacingM: 1,
        speedsKph: [Math.min(requestedMaximumKph, project.vehicle.maxSpeedKph)],
      },
    });
    need(
      project.scenario.method === "trajectory",
      "Continuous geometry bound requires the alignment trajectory method; constant-grade references retain sampled results only.",
    );
    need(
      section.direction === project.scenario.direction,
      "Section and operating-profile directions differ.",
    );
    need(
      Number.isFinite(requestedMaximumKph) && requestedMaximumKph > 0,
      "A positive maximum commanded speed is required for the open positive-speed domain.",
    );
    need((project.scenario.algorithm??"rk4")!=="etcs", "ETCS profile has no implemented calculation or continuous bound.");
    if(project.scenario.algorithm==="classic")need(!project.vehicle.brakeCurve?.length&&!project.vehicle.tractionCurve?.length&&project.alignment.every(r=>r.gradientPermille===project.alignment[0].gradientPermille),"Classic profile requires constant rates and uniform alignment grade; no bound is issued for an unsupported classic model.");
    const v = project.vehicle,
      s = project.scenario,
      d = s.direction,
      a = Q(section.fromM),
      b = Q(section.toM),
      F = Q(s.frontErrorM),
      L = Q(v.lengthM);
    const U = R.min(Q(requestedMaximumKph), Q(v.maxSpeedKph));
    result.domain.commandedMaxInclusiveKph = Math.min(
      requestedMaximumKph,
      v.maxSpeedKph,
    );
    const traction = R.max(
      ...(v.tractionCurve?.length
        ? v.tractionCurve.map((x) => Q(x[1]))
        : [Q(v.tractionA)]),
    );
    const brake = R.min(
      ...(v.brakeCurve?.length
        ? v.brakeCurve.map((x) => Q(x[1]))
        : [Q(v.brakeA)]),
    );
    const cut = R.add(Q(s.reactionS), Q(s.tractionDisableS));
    const full = R.add(R.add(Q(s.reactionS), Q(s.brakeDelayS)), Q(s.buildUpS));
    const T = R.max(cut, full),
      error = R.add(Q(s.overspeedKph), Q(s.speedErrorKph));
    const initial = R.div(R.add(U, error), KPH);
    const rows = project.alignment.map((row) => ({
      from: Q(row.fromM),
      to: Q(row.toM),
      grade: R.div(Q(-d * row.gradientPermille), Q(1000)),
    }));
    for (let i = 1; i < rows.length; i++)
      need(
        R.cmp(rows[i].from, rows[i - 1].to) === 0,
        "Continuous bounds require exactly contiguous decimal alignment rows; tolerated numeric gaps/overlaps cannot establish geometry coverage.",
      );
    const corridor = (travel) => ({
      lo: d === 1 ? R.sub(R.sub(a, F), L) : R.sub(R.sub(a, F), travel),
      hi: d === 1 ? R.add(R.add(b, F), travel) : R.add(R.add(b, F), L),
    });
    const covered = (c) =>
      R.cmp(c.lo, rows[0].from) >= 0 && R.cmp(c.hi, rows.at(-1).to) <= 0;
    const gainFor = (g) => R.add(R.mul(traction, cut), R.mul(g, T));
    // No brake credit through T, but traction is removed at its specified cut.
    const preFor = (u, g) =>
      R.add(
        R.mul(R.div(R.add(u, error), KPH), T),
        R.add(
          R.div(R.mul(traction, R.mul(cut, R.sub(R.mul(TWO, T), cut))), TWO),
          R.div(R.mul(g, R.square(T)), TWO),
        ),
      );
    const distanceFor = (u, g, r) =>
      R.add(
        preFor(u, g),
        R.div(
          R.square(R.add(R.div(R.add(u, error), KPH), gainFor(g))),
          R.mul(TWO, r),
        ),
      );
    let H = Z,
      g,
      r,
      D,
      speed,
      time,
      lo,
      hi,
      closed = false;
    const construction = [];
    // Monotonically expand a candidate corridor. A candidate is evidence only
    // once D(H)<=H; until then it is NOT an established bound. No ODE sampling.
    for (let iteration = 0; iteration < 64; iteration++) {
      const c = corridor(H);
      need(
        covered(c),
        "Supplied route does not cover every uncertain initial footprint and the full conservative stopping corridor.",
      );
      let grade = Z;
      for (const row of rows)
        if (R.cmp(row.from, c.hi) <= 0 && R.cmp(row.to, c.lo) >= 0)
          grade = R.max(grade, row.grade);
      g = R.mul(G, grade);
      r = R.sub(brake, g);
      need(
        R.cmp(r, Z) > 0,
        "No positive uniform net retardation established by minimum braking and corridor adverse gravity. This does not prove the actual train cannot stop.",
      );
      D = distanceFor(U, g, r);
      speed = R.add(initial, gainFor(g));
      time = R.add(T, R.div(speed, r));
      construction.push({
        candidateTravelM: fraction(H),
        gravityUpperMps2: fraction(g),
        requiredTravelM: fraction(D),
      });
      if (R.cmp(D, H) <= 0) {
        closed = true;
        lo = c.lo;
        hi = c.hi;
        break;
      }
      H = D;
    }
    need(
      closed,
      "Conservative corridor did not close within 64 expansions; no bound established. Subdivide the section or review the supplied profile.",
    );
    const distance = (u) => distanceFor(u, g, r);
    need(
      R.cmp(time, Q(s.maxTimeS)) <= 0,
      "Conservative first-arrest time exceeds the declared maximum stopping time.",
    );
    // Require every supplied curve on the whole comparison speed interval, including zero.
    for (const [name, curve] of [
      ["Brake", v.brakeCurve],
      ["Traction", v.tractionCurve],
    ])
      if (curve?.length) {
        need(
          Q(curve[0][0]).n === 0n &&
            R.cmp(Q(curve.at(-1)[0]), R.mul(speed, KPH)) >= 0,
          name +
            " curve does not cover the complete conservative attained-speed interval from zero; no extrapolation or endpoint clipping.",
        );
      }
    const clearance = R.add(
      F,
      R.add(Q(s.rearErrorM), R.add(Q(s.rollbackM), Q(s.extraM))),
    );
    const protectedValue = R.add(D, clearance);
    // D(u) minus ideal service reference is quadratic. Check both endpoints
    // and the exact concave vertex; do not infer margin monotonicity from D.
    const c2 = R.div(
      R.sub(R.div(Q(1), r), R.div(Q(1), Q(v.serviceA))),
      R.mul(TWO, R.square(KPH)),
    );
    const c1 = R.add(
      R.div(T, KPH),
      R.div(R.add(R.div(error, KPH), gainFor(g)), R.mul(r, KPH)),
    );
    const candidates = [Z, U];
    if (R.cmp(c2, Z) < 0) {
      const vertex = R.div(R.neg(c1), R.mul(TWO, c2));
      if (R.cmp(vertex, Z) > 0 && R.cmp(vertex, U) < 0) candidates.push(vertex);
    }
    const marginAt = (u) =>
      R.max(
        Z,
        R.sub(
          R.add(distance(u), clearance),
          R.div(R.square(R.div(u, KPH)), R.mul(TWO, Q(v.serviceA))),
        ),
      );
    let margin = marginAt(U),
      marginSpeed = U;
    for (const u of candidates)
      if (R.cmp(marginAt(u), margin) > 0) {
        margin = marginAt(u);
        marginSpeed = u;
      }
    const demand = section.metric === "protectedM" ? protectedValue : margin;
    const selected = R.ceilTo(demand, Q(section.roundM));
    let residual = null;
    if (section.protectedPointM !== null) {
      const downstreamEdge = d === 1 ? b : a;
      residual = R.sub(
        R.mul(Q(d), R.sub(Q(section.protectedPointM), downstreamEdge)),
        protectedValue,
      );
    }
    const curveSource = (curve, scalar, extremum) => {
      if (!curve?.length) return { field: scalar };
      const index = curve.findIndex(
        (point) => R.cmp(Q(point[1]), extremum) === 0,
      );
      return {
        field: scalar === "brakeA" ? "brakeCurve" : "tractionCurve",
        pointIndex: index,
        speedKph: curve[index][0],
        accelerationMps2: curve[index][1],
      };
    };
    const gravitySourceIndex = rows.findIndex(
      (row) =>
        R.cmp(row.from, hi) <= 0 &&
        R.cmp(row.to, lo) >= 0 &&
        R.cmp(R.mul(G, R.max(Z, row.grade)), g) === 0,
    );
    Object.assign(result, {
      status: "bounded",
      allocatedM: R.outward(selected),
      protectedUpperM: R.outward(protectedValue),
      marginUpperM: R.outward(margin),
      residualLowerM: residual === null ? null : R.outward(residual, -1),
      evidence: {
        arithmetic:
          "Exact rational operations on canonical JSON decimal inputs; SI constants 9.80665 and 3.6 are exact within this contract. Presentation is outward rounded; section selection uses the exact fraction.",
        extremaSources: {
          traction: curveSource(v.tractionCurve, "tractionA", traction),
          braking: curveSource(v.brakeCurve, "brakeA", brake),
          gravity: {
            rowIndex: gravitySourceIndex,
            ...project.alignment[gravitySourceIndex],
            noUphillCredit: g.n === 0n,
          },
        },
        gravityUpperMps2: fraction(g),
        tractionUpperMps2: fraction(traction),
        brakeLowerMps2: fraction(brake, -1),
        netRetardationLowerMps2: fraction(r, -1),
        noBrakeCreditUntilS: fraction(T),
        attainedSpeedUpperKph: fraction(R.mul(speed, KPH)),
        firstArrestTimeUpperS: fraction(time),
        rawTravelUpperM: fraction(D),
        clearanceM: fraction(clearance),
        protectedUpperM: fraction(protectedValue),
        marginUpperM: fraction(margin),
        selectedM: fraction(selected),
        marginBoundExtremumKph: fraction(marginSpeed),
        marginExtremumKind:
          marginSpeed.n === 0n
            ? "positive-speed-limit"
            : "in-domain-bound-extremum",
        corridorConstruction: construction,
        tractionRemovedAtS: fraction(cut),
        requiredCorridorExact: { fromM: R.exact(lo), toM: R.exact(hi) },
        availableRoute: {
          fromM: project.alignment[0].fromM,
          toM: project.alignment.at(-1).toM,
        },
        requiredCorridor: { fromM: R.outward(lo, -1), toM: R.outward(hi) },
        residualLowerM:
          residual === null
            ? null
            : { value: R.outward(residual, -1), ...R.exact(residual) },
      },
      message:
        "Continuous mathematical bound; physical inputs, position-error interpretation and project applicability require engineering acceptance. Civil entry filters are deliberately ignored; stationary release/holding and post-arrest behavior are excluded. The bound extremum is not a simulated governing case.",
    });
  } catch (e) {
    result.message = e.message;
  }
  return result;
}
export function boundAllocations(workspace, members, allocations) {
  return allocations.map((section) => {
    const relevant = members.filter((m) => m.groupId === section.groupId);
    const memberBounds = relevant.map((m) => ({
      alternativeId: m.id,
      vehicleId: m.vehicleId,
      profileId: m.profileId,
      ...boundSection(
        m.project,
        section,
        Math.max(...workspace.study.speedsKph),
      ),
    }));
    const valid = memberBounds.filter((x) => x.status === "bounded");
    const complete =
      memberBounds.length > 0 && valid.length === memberBounds.length;
    const exactField = (x, key) =>
      R.ratio(
        BigInt(x.evidence[key].numerator),
        BigInt(x.evidence[key].denominator),
      );
    const compare = (x, b, keys) => {
      if (!b) return 1;
      for (const key of keys) {
        const comparison = R.cmp(exactField(x, key), exactField(b, key));
        if (comparison) return comparison;
      }
      return 0;
    };
    const demandKey =
      section.metric === "protectedM" ? "protectedUpperM" : "marginUpperM";
    const best = valid.reduce(
      (b, x) =>
        compare(x, b, [
          "selectedM",
          demandKey,
          "protectedUpperM",
          "rawTravelUpperM",
        ]) > 0
          ? x
          : b,
      null,
    );
    const protectedBest = valid.reduce(
      (b, x) => (compare(x, b, ["protectedUpperM"]) > 0 ? x : b),
      null,
    );
    const marginBest = valid.reduce(
      (b, x) =>
        compare(x, b, ["marginUpperM", "protectedUpperM", "rawTravelUpperM"]) >
        0
          ? x
          : b,
      null,
    );
    const residualBest =
      section.protectedPointM === null
        ? null
        : valid.reduce(
            (b, x) => (!b || compare(x, b, ["residualLowerM"]) < 0 ? x : b),
            null,
          );
    return {
      allocationKey: section.allocationKey || section.id,
      sectionId: section.id,
      groupId: section.groupId,
      routeId: section.routeId,
      direction: section.direction,
      metric: section.metric,
      method: BOUND_METHOD,
      status: complete ? "bounded" : "unavailable",
      allocatedUpperM: complete ? best.allocatedM : null,
      partialAllocatedUpperM: best?.allocatedM ?? null,
      partialBoundBy: best?.alternativeId ?? null,
      protectedUpperM: complete ? protectedBest.protectedUpperM : null,
      protectedBoundBy: complete ? protectedBest.alternativeId : null,
      marginUpperM: complete ? marginBest.marginUpperM : null,
      marginBoundBy: complete ? marginBest.alternativeId : null,
      boundBy: complete ? best.alternativeId : null,
      residualLowerM: complete ? (residualBest?.residualLowerM ?? null) : null,
      residualBoundBy: complete ? (residualBest?.alternativeId ?? null) : null,
      memberBounds,
      message: memberBounds.length
        ? null
        : "No enabled alternative matches this section group.",
    };
  });
}
