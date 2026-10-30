# Continuous section bound — comparison profile 1.0.0

This is a sufficient bound of a declared mathematical model, not a validation of physical fleet data or an ATP/IEEE/ETCS implementation. The nominal RK trajectories remain a separately labeled sampled study. No numerical agreement of RK step sizes is used to establish this bound.

## Domain and references

For each enabled section [a,b], travel direction d = +1 or -1, nominal **physical leading-end** entry x ranges over the complete closed interval. True entry is x+d*e, with e in [-F,+F] along travel and F = frontErrorM. The leading end must already be the selected operating end: convert antenna/cab/centre reference before importing the along-track alignment. The caller must accept that F bounds initial physical-nose error, with no probability or confidence interpretation invented by this software. Rear error, rollback and additional stand-off remain independent supplied clearance magnitudes. F enters the geometry domain and is added once to the nominal endpoint bound; it is not added a second time to clearance.

The commanded-speed domain is **0 < u <= U km/h**, U = min(greatest requested sample speed, vehicle maximum commanded speed). It deliberately includes speeds between and below samples and ignores civil entry filters, creating a superset. The true initial speed is (u+overspeedKph+speedErrorKph)/3.6. Zero-speed release/holding is excluded even when zero appears in the sampled plan; sampled failures remain intact. A positive U is required. No speed is clipped during failure.

Only the alignment trajectory method receives a continuous geometry bound. Constant-grade reference groups are refused explicitly. Every enabled alternative in a route/direction/method group must establish its own bound. Different routes never combine. Results are independent of sample spacing and interior sample choices with the same U.

## Comparison system

All quantities below use SI; w = u/3.6. Let δ = (overspeedKph+speedErrorKph)/3.6, c = reactionS+tractionDisableS, f = reactionS+brakeDelayS+buildUpS and T = max(c,f). Let aMax be the largest supplied traction-curve ordinate, or scalar tractionA. Let bMin be the smallest supplied brake-curve ordinate, or scalar brakeA. Curves interpolate continuously and linearly, so extrema over their complete declared domains bound every supported intermediate speed. No force, load, inertia or adhesion correction is inferred.

Within a candidate full-footprint corridor let

    gPlus = 9.80665 * max(0, max(-d * gradientPermille / 1000))
    r = bMin - gPlus > 0
    K = aMax*c + gPlus*T
    V1(u) = w + δ + K
    Dpre(u) = (w+δ)*T + aMax*c*(2*T-c)/2 + gPlus*T*T/2
    D(u) = Dpre(u) + V1(u)^2/(2*r)
    timeUpper(u) = T + V1(u)/r

For a downgrade, rise/run q >= 0 obeys q/sqrt(1+q*q) <= q; for an uphill the positive-gravity bound is zero. Thus gPlus bounds gravity pointwise and every uniform finite-train length average. Before T, actual acceleration is at most aMax while traction is active plus gPlus; we credit no braking. Traction is removed at c. After T, actual acceleration is at most -r until first arrest. Integrating these inequalities bounds speed and displacement until actual first arrest; an earlier arrest only shortens the travel. The comparison speed is nondecreasing before T and decreases afterward. D(U), V1(U) and timeUpper(U) therefore cover all positive commanded speeds up to U.

Both supplied curves must cover the complete comparison interval [0,3.6*V1(U)]. This is intentionally a sufficient, sometimes pessimistic, condition, including a traction curve even if inactive. Curves are never extrapolated. If a curve or the time horizon cannot support the bound, the result is unavailable. Nonpositive r means this method has not established a bound, not that the actual changing-grade train cannot stop.

## Closing the geometry domain

For candidate travel H >= 0 the union of every uncertain initial and moving footprint is

    d=+1: I(H) = [a-F-L, b+F+H]
    d=-1: I(H) = [a-F-H, b+F+L]

Require I(H) within exactly contiguous supplied decimal alignment rows; the numerical solver's small adjacency tolerance does not establish this condition. Start at H=0, calculate gPlus from every row intersecting I(H), then compute D(U). When D(U)>H replace H with D(U) and repeat. A candidate is not a bound until **D(U)<=H**. At that point, a first-exit argument establishes the invariant corridor: before any possible exit, the acceleration inequalities apply and imply first arrest within D(U)<=H. Include both sides at a boundary. Reject missing tails, nonpositive r, unsupported performance coverage, a time upper bound greater than maxTimeS, or failure to close within 64 expansions. Partial construction records are never presented as finite fleet bounds. The final construction ledger is retained with exact fractions.

This local corridor avoids unrelated grades kilometres behind or beyond every bounded stopping position. It is conservative over pointwise grades and does not seek the tight maximum finite-train average. A more pessimistic envelope may fail even when an individual sampled trajectory stops successfully. Subdivision or a separately verified tighter model can resolve such cases; never reinterpret them as zeros.

## Quantities and selection

Let C = F + rearErrorM + rollbackM + extraM. Protected first-arrest reach from the nominal nose is at most D(U)+C. For the margin beyond ideal service reference, maximize

    M(w) = D(3.6*w) + C - w*w/(2*serviceA)

on the closed interval [0,U/3.6] (its zero endpoint covers the positive-domain limit). This is quadratic with coefficient (1/r-1/serviceA)/2 and linear coefficient T+(δ+K)/r. Check both endpoints and, only when the quadratic is concave and its vertex is inside the interval, the vertex. Clamp the greatest value at zero. This is a bound extremum, **not an actual simulated governing vehicle entry/offset/speed**. Margin and protected upper bounds can be supplied by different alternatives. Rounded allocations take the largest member's bound after one exact upward selection to the section increment.

For protected point P, the residual lower bound is

    d*(P-xExit) - (D(U)+C), xExit=b for d=+1, a for d=-1.

Always use the downstream edge, even if P is inside or behind the section. Never choose the geometrically nearest edge. Fleet residual lower bounds and their source alternative are retained separately from allocated-quantity maxima.

## Arithmetic and output contract

The comparison kernel uses normalized BigInt rational arithmetic on the canonical JSON decimal spelling of each input. The contract takes 9.80665 and 3.6 as exact SI constants. This removes arithmetic rounding, cancellation and ceiling-boundary ambiguity from the formulas and selection; it does not remove physical input uncertainty. It does not claim bitwise enclosure of the approximate RK solver's implementation or a hardware-validated safety processor.

Exact numerator/denominator pairs accompany the evidence. Human/CSV numeric upper bounds are rounded outward to at least micrometre resolution; lower bounds are rounded down. Brake/net-retardation lower evidence is rounded down. Exact section selection uses the fractions, not displayed rounded values. The bound has its own method identity. Study JSON, dedicated continuous-bounds CSV, HTML and the live section view retain the status, scope, per-alternative refusal and evidence. Existing sampled allocations are labeled separately and remain unavailable on their original applicable failures. No fallback promotes a partial bound to a fleet value.

## Independent evidence and remaining acceptance

`tests/fixtures/independent-benchmarks.json` is generated by `scripts/benchmark-oracle.py` using Python Decimal at 60 digits and spatial work integration. It imports no app source and uses no RK time integrator. Six shifted grade-transition cases include both travel directions and offsets -F, 0 and +F. A separate logarithmic work integral checks continuous speed-dependent braking. `python3 scripts/benchmark-oracle.py --check` reproduces the retained figures. JavaScript tests use retained values; normal app execution and Node verification do not require Python.

Analytic bound tests independently cover flat stopping, phase overlap/cut, exact rounding, an interior service-margin maximum, both-direction footprints/residuals, speed-curve and route-tail failures and fleet partial failure. Model reviews challenge these arguments but do not supply project acceptance. Real use still needs the accepted governing method and edition, configuration-specific guaranteed performance, timing/error evidence, route/reference mapping, independent project benchmark reconciliation and accountable engineering disposition. Moving train-pair separation, adhesion/WSP dynamics, force/inertia models and post-arrest holding remain excluded.
