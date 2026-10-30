# Calculation verification methods

26 October 2026, America/Vancouver. These checks concern software and the declared continuous comparison model. They do not establish accepted physical fleet performance, compliance with a train-control standard or project approval.

## Current automated and independent evidence

`npm run verify`: **106 passing tests, zero failures**, plus all-module syntax checks. Of these, 27 target the continuous comparison, exact arithmetic, shifted geometry, failure/identity/export behavior and independently derived counterexamples. A seeded check covers 96 shifted trajectories across speed, curve/timeline and both travel directions; it is regression evidence, not the continuous-domain proof.

`python3 scripts/benchmark-oracle.py --check` reconstructs the retained fixtures with 60-digit Decimal arithmetic and no application imports. Its spatial-energy/trapezoidal work method is independent of the RK time integrator and is explicitly restricted to scalar established braking, covered footprints and strictly decreasing kinetic energy. Six finite-train transition cases cover offsets -F, 0 and +F in both directions. A separate logarithmic energy integral gives 800*(1-ln(2)) = 245.48225555204375… m for a continuous linear brake-speed curve.

The adverse-transition fixture gives nominal travel 232.230426… m. Adding F=75 m gives 307.230426… m nominal reach, while the allowed +75 m shifted entry reaches 355.576066… m from the nominal reference: a 48.345640… m understatement. Both mirrored directions are checked. The continuous comparison encloses that shifted reach. Every figure is synthetic.

Independent analytic fixtures include 200 m level stopping; 103.5 m guaranteed-cutoff overlap bound above the 92 1/3 m nominal trajectory; a 4 m service-margin maximum at an interior 14.4 km/h; concave/convex/equal-curvature variants; 344.5 m speed-curve bound; exact 5.500000000000001 / 1.1 upward selection; slower-fleet caps; signed downstream-edge residuals; missing initial/forward tails; gap/curve/time refusals; partial-fleet null values and exact governing identities. Presentation tests retain outward digits and exact original domain caps.

The bound uses exact decimal-rational formulas and a first-exit self-containing-corridor argument, described in CONTINUOUS-BOUND.md. It does not use observed RK convergence differences as numerical error bounds. Exact fractions, source extrema, input identity, available/required corridors, limits and per-member refusals travel with the result.

## Current browser evidence

The real in-app browser/module worker evaluated the nine-alternative/two-route synthetic workspace: 936 candidate cases, six section/group records. A short-route control computed both nominal samples but refused the continuous bound because the uncertain corridor needed more route tail. The matching extended-route control established a 225 m protected upper allocation and 65 m residual lower bound. Its refusal CSV was actually downloaded and inspected. These are synthetic workflow checks, not project values.

The continuous register and method disclosure were inspected on desktop and at a 375 px phone viewport. The page remained contained; wide registers scroll internally. The viewport override was reset and the affected browser warning/error log was empty. The final 936-case run was repeated after the review repairs; all six bounds were established, and the desktop register and regenerated report limits were inspected. The report now distinguishes the nominal additive-clearance limitation from the continuous geometry bound. PDF print pagination and all-platform conformance remain unqualified.

## Portable-candidate check

The committed candidate was archived with `git archive`, extracted into a fresh directory containing spaces and run independently of the developer checkout. All 106 tests, module syntax checks and the independent Python oracle passed there. Its 312-case batch completed with three established section bounds, zero unavailable bounds and 11 output files using `--require-bounds`. A separate loopback server on port 4174 executed the real module worker in the in-app browser: all 720 candidates in the loaded nine-alternative workspace completed, all six continuous bounds were established and the browser warning/error log was empty. The inherited alignment-import race fix from PR #5 remains intact, including all nine handler regressions. An actual in-app-browser file chooser imported the five-row alignment template and invalidated the previous result. Delayed-read race scenarios are covered by the deterministic handler tests, not claimed as a timed browser reproduction. This tests the portable source distribution under the available macOS/Node/browser environment; it does not establish every browser/platform or PDF print pagination.

## External challenge scope

GPT Pro and Gemini Argon High challenged the method, then inspected the complete 12-file candidate-A source packet. A 14-file repaired packet B included complete pure dependencies, 27 bound tests, three batch tests and the independent oracle. Gemini inspected B statically, explicitly did not run Node/Python, closed the consequential findings and retained one nonblocking tie-label observation, subsequently aligned locally. Pro completed packet C with all 27 bound tests and the oracle passing, and verified the prior domain/HTML/oracle reproductions. Its batch suite returned two passes and one environment EPERM launch failure; the equivalent direct CLI refusal and its output assertions passed. RESEARCH.md records this scope explicitly, including the final locally tested negative-zero and launch-error assertion repairs. Neither review grants engineering acceptance of a real project or certifies the final release.

The remaining project acceptance work is specified in PROJECT-QUALIFICATION.md: governing method/edition, physical data and timing guarantees, uncertainty reference and magnitude, route/datum conversion, independent project benchmarks and accountable disposition. The implementation offers a sufficient, sometimes pessimistic bound. Refusal is never evidence of actual nonstopping.

---

