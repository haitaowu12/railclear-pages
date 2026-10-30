# Calculation methods — 0.4 candidate

An algorithm solves a declared physical model. A standards or vehicle profile defines that model and its input guarantees. An infrastructure policy converts its outputs into implemented sections/transitions. These are separate identities. Selecting an algorithm does not qualify a vehicle model or establish IEEE/ETCS/vendor equivalence.

## Implemented acceleration-input profile

All three implemented solvers use the existing effective traction/brake acceleration inputs, event origins, signed finite-train gradient, initial true-speed allowances and first-arrest convention. Mass is recorded; there is no force/mass rescaling, rotating inertia, separate disc/track brake, BAM, wind or curvature resistance. Curvature receives no beneficial resistance credit. The service reference remains the ideal constant-rate reference. See CALCULATION-CONTRACT.md for quantities, coverage and exclusions.

`scenario.algorithm` is optional on legacy inputs and defaults to `rk4`. Unknown values are rejected. Shared operating profiles share this selection. Algorithm IDs and versions accompany results and exports; route/direction/grade/algorithm groups and allocation keys remain separate. Algorithms are not merged into one fleet envelope. To compare algorithms, duplicate the operating profile, assign a different algorithm and add alternatives using the same vehicle/route.

### Time integration — `railclear-rk4/1.0.0`

The established event-partitioned fourth-order RK solver, with local checks, full/two-half steps, front/rear geometry events and repeated maximum-step refinements. Supports continuously interpolated speed curves and changing alignment gradients. Numerical sensitivity is not a rigorous error bound.

### Classic analytical — `railclear-classic/1.0.0`

Requires constant traction/brake rates and uniform grade (or explicitly selected constant-grade reference). It refuses speed curves and changing alignment grades. It retains the existing timing schedule, including overlap of traction and braking, and linear brake build-up. On each event interval, acceleration is `a0 − j t`, so velocity and distance are evaluated as quadratic/cubic polynomials. First arrest is localized on that phase; peak speed includes an internal acceleration-zero point. Complete alignment coverage is checked in alignment mode. No-stop/time-limit cases are refused.

Distance equations are analytical; root finding and floating-point arithmetic are not exact real arithmetic. A zero step-comparison allowance means no numerical stepping comparison applies; it is not a claim of zero arithmetic error or safety certification.

### Work–energy — `railclear-energy/1.0.0`

A hybrid solver for the same acceleration-input profile. The event-partitioned time solver runs until both full brake and traction removal, or first arrest if earlier. Established braking then propagates specific kinetic energy `q = v²/2` along distance: `dq/dx = −b(sqrt(2q)) + a_grade(x)`. The finite-train gradient is evaluated along the route. This is not a force/inertia reproduction of a project energy model.

Spatial RK4 uses full/two-half-step checks and partitions front/rear gradient boundaries. It checks speed-curve knot resolution, stops at first zero energy, preserves coverage refusal and retains both prefix and energy-stage trace points. Interval time uses `2 dx / (v_start + v_end)`; it is exact for constant acceleration and approximate on variable-force intervals. Time limits remain enforced. A physical stop exactly at the time limit can require additional resolution in a varying-force case.

The maximum spatial step is `12.5 × scenario.dtS` metres (default 1 m for 0.08 s). Each global refinement halves the timed and spatial steps. Two consecutive distance differences must satisfy the supplied distance tolerance. Step histories state both units. This is numerical sensitivity, not a rigorous error bound. The continuous comparison profile separately bounds the declared model, independent of the sampled solver; unsupported classic and ETCS profiles receive no bound.

## ETCS — definition only

No governing project baseline has been selected. `etcs` is retained as a visible profile definition and returns an explicit refusal, never an RK/energy substitution. It cannot produce a sampled allocation or continuous ETCS bound.

Resolve these elements before implementing an ETCS profile:

1. SUBSET-026 edition, baseline/system version, applicable national values and target scope.
2. Gamma/lambda brake-model applicability and configuration-specific emergency/service brake data by speed.
3. Dry/wet correction factors and their confidence basis, adhesion limits, rotating-mass/gradient treatment and ownership of corrections already included in supplied data.
4. Equivalent build-up and traction-removal timing, speed-estimation uncertainty, position confidence and release-speed assumptions.
5. Gradient aggregation, speed targets, movement-authority/end-of-authority/danger-point datums and target speed.
6. Explicit scope of EBD/SBD and EBI/SBI/warning/indication calculations. An EBD function alone is not full ETCS supervision.
7. Independently checked baseline-specific cases, intermediate states, curve transitions and refusal/boundary tests. Reconcile to the official reference tool and selected specification, including any known limitations.

Primary starting point: [ERA braking curves](https://www.era.europa.eu/domains/european-rail-traffic-management-system/braking-curves), its introductory material and reference tool. This definition is an implementation brief, not a complete normative input specification or a compliance claim.

## Verification and qualification

Synthetic independent checks include constant-grade equations, reaction/traction timing, ramp polynomial and arrest within the ramp, both directions, finite-train gradient work integral, logarithmic variable-braking integral, curve/coverage/non-stop refusals, mixed-method separation and ETCS refusal. Cross-method agreement alone is not independent proof; checks use separately derived expected values. The previous private report replay remains unresolved; none of these solver additions qualifies a source-specific railway model.

### First-arrest regression retained

During this implementation, an independently constructed synthetic grade-transition case exposed a spatial step that crossed a narrow zero-energy dip and ended positive after downhill recovery. Endpoint-only energy checks missed the first arrest and the case later failed for coverage. The energy solver now rejects a positive-endpoint trial with nonpositive internal energy stages and reduces the step until first arrest is bracketed. The independent quadratic-work root is retained as a regression. Numerical refinement agreement alone did not reveal this event-handling defect.
