# Calculation contract — 0.3.0

## Purpose and references

Calculate first forward arrest after a defined initiating event, and compare this travel with an ideal service-target reference and optional fixed obstacle. The calculation is model-specific research software. Public ERA material informs the distinctions; no ETCS or proprietary ATP model is implemented.

## Coordinates and units

Alignment chainage is along track. Each segment has start/end metres, a rise/run gradient in per mille defined in **increasing** chainage, and a civil speed in km/h. Travel direction is +1 or −1; nose chainage is `entry + direction × traveled_distance`, rear is `nose − direction × length`. Static mass is recorded but does not rescale acceleration inputs. Uniform mass/length distribution is assumed; rotating inertia is not modeled.

In alignment mode, grade acceleration is `−direction × 9.80665 × mean(sin(arctan(grade/1000)))`, weighted by the track lengths under the train. This physical averaging is **not** an ETCS conservative gradient rule. Constant mode uses the supplied single grade throughout and does not derive dynamics or coverage from the alignment. Its label and result project preserve that distinction.

## Initial conditions and time origin

At t=0, true speed is `(commanded_speed + overspeed_allowance + speed_measurement_error)/3.6`. Distance is zero at the actual modeled nose location. A zero initial true speed is rejected: release, holding and rollback from an initially stationary state need a separate model. In the nominal RK study, position error is allocated to clearance after motion; it is not a shifted-trajectory sweep. This sampled result alone is insufficient near grade transitions. The separate continuous comparison bound covers the shifted initial physical-nose interval and full finite-train geometry; see CONTINUOUS-BOUND.md.

The emergency command occurs at `reactionS`. Propulsion remains at the specified runaway acceleration until `reactionS + tractionDisableS`. Braking starts at `reactionS + brakeDelayS`, then increases linearly from zero to the level-track emergency deceleration over `buildUpS`. Build-up and propulsion disable may overlap; they are not implicitly sequential. With a zero build time, brake application is a step. The timeline is retained in exports.

Rates are positive magnitudes in m/s². Optional speed curves contain strictly increasing km/h breakpoints and continuous linear interpolation of positive braking / nonnegative traction acceleration. Curve extrapolation is rejected. Supplied rates must already represent the selected loading, adhesion and degraded-equipment state; the app does not apply a second correction or assert that those conditions are adequate.

## Numerical implementation

Fourth-order Runge–Kutta integrates traveled distance and nonnegative scalar speed. Time steps are partitioned at command, traction-cut, brake-start and brake-full times. Front/rear encounters with alignment knots are root-localized. Trial steps that overrun supported coverage are reduced before accepting a state; no missing profile is extrapolated. Event left limits never precede the current step start. First zero velocity is located by bisection; integration ends there. Continuing holding, restart and rollback are not simulated. Arrest before full brake raises a review flag.

Distance at step h is compared with h/2 and h/4, requiring two successive comparisons within tolerance, with up to four comparisons/refinements. The step/distance/difference history is retained per case. Failure to meet the selected absolute distance tolerance rejects the case. The difference is **not a rigorous error bound**; it is not a universal numerical safety factor. Selected sample margin includes the observed difference as an explicit numerical allowance, without asserting that it bounds the true solution. Speed-curve knots are continuous interpolation derivative changes, not discontinuous bands. Trials may not span more than one curve knot; a local force-slope stability limit and RK4 full-step/two-half-step comparisons control the curve resolution. Accepted states use two half steps. Distance and speed local checks supplement the independent maximum-step refinement comparisons; neither establishes a rigorous bound. Extremely stiff curves can exhaust the step budget and return a failed case.

Default maximum step is 0.08 s, distance comparison tolerance 0.05 m. Step limit 150,000 and maximum time 1,200 s prevent an unbounded computation. A case without a stop returns an error, never the last computed distance as a stop. A temporary local net brake deficit does not by itself prove infinite stopping distance on a changing alignment; only bounded integration failure is reported.

## Output definitions

- `distanceM`: integrated first-arrest nose travel.
- `serviceM`: `commanded_speed_mps² / (2 × supplied_constant_service_deceleration)`. An ideal reference, not a grade/jerk-aware service-control simulation.
- `allowanceM`: following-front error + leading-rear error + leading rollback allowance + additional stand-off. No delay term is duplicated here.
- `protectedM`: raw first-arrest travel + allowance.
- `signedMarginM`: protected distance minus ideal service reference. Negative values are retained.
- `marginM`: max(0, signed margin).
- `selectedM`: upward selection of `(margin + observed_step_difference)` to `roundM`.
- `peakKph`: maximum sampled attained speed in the failure simulation, not authorised speed or a guaranteed continuous peak.
- `residualM`: signed available nose-to-obstacle distance minus protected distance, if a fixed obstacle chainage is supplied. No “safe” pass stamp is generated.

## Study coverage

Candidate entries include range endpoints, fixed chainage spacing and front/rear alignment-boundary positions inside the range. At an exact segment boundary, the lower of the two adjacent civil limits filters entry speeds in both directions. Each candidate is evaluated at the supplied commanded speeds that meet the local entry civil speed and vehicle maximum commanded speed. Civil restrictions along the subsequent failure path are not supervised. Speed is never clipped during a failure.

The selected study value is the greatest selected **sample**. The governing trace is selected by rounded sample selection, then unrounded margin basis, signed margin, protected distance, raw distance and speed to resolve ties consistently with the section diagnostics. Neither it nor a plotted staircase establishes a continuous global or approved envelope. Failed cases are retained, mark the study incomplete and prevent interpretation of the remaining maximum as a complete result. Early arrests mark review required. Every run retains all input data, engine identity, timestamp and limitations. The browser adds a SHA-256 input digest; engine identity is a separate exported field.

## Exclusions and extension points

No certification, automatic project acceptance, ETCS supervision, train-control software, validated vehicle guarantee, force-based mass scaling, rotational equivalent mass, curve resistance, wind, train slack, wheel-slip dynamics, brake thermal effects, separate track brakes, BAM, service jerk control, probabilistic assurance. The nominal RK study alone establishes no continuous-parameter bound; the separate comparison profile below has its own proof, domain and refusal conditions. Future profiles must define their own assumptions and independently checked cases. Public geometry or marketing data cannot supply guaranteed braking performance.


## Section allocations and mixed fleet (workspace schema 2)

Allocations are defined for signal segments, CBTC track sections or named engineering sections. Each has a canonical increasing-chainage entry range, a route ID, travel direction, reference identifier, allocated quantity and upward selection increment. An optional protected point is a separate fixed-hazard coordinate; a signal identifier alone does not set that coordinate. `selectedMarginM` allocates margin beyond the ideal service reference; `protectedM` allocates first-arrest travel plus explicit allowances. These quantities are not interchangeable.

Only enabled sections define calculation domains. A stopping trajectory is never clipped at an allocation boundary. It uses the route gradient through the complete footprint and onward to first arrest; insufficient route tails fail. Endpoints are sampled explicitly and shared boundary entries belong to both adjacent sections. Gaps between sections remain unassigned. Overlapping sections intentionally share their overlapping samples; unique chainage cases are not calculated twice within the same comparison group.

Each enabled alternative references a vehicle sheet, operating/failure profile and route profile. The common chainage grid includes the union of section endpoints, spacing samples and all compared vehicle front/rear grade-transition entries. Common speed samples include requested speeds and each vehicle/civil entry-speed limit up to the maximum requested speed. Every alternative is evaluated against the same group grid. Above-limit cases are retained as inapplicable, not silently dropped or treated as successful stops. This remains sampling, not a continuous speed maximum.

Envelopes are grouped by route ID, direction and grade method. Distinct route variants or directions never supply one merged allocation. At each entry/speed, any failed applicable alternative makes the full fleet values unavailable. Partial maxima are stored separately for investigation. Maxima of margin, protected distance and raw arrest carry their own governing alternative IDs. A section with any incomplete applicable sample cannot receive a numeric allocation. An enabled section with no matching enabled alternative is not evaluated and makes the workspace incomplete.

The common-entry trajectory overlay uses one specified entry chainage and commanded speed for all shown alternatives. It does not overlay independent governing starts and imply that those starts were comparable. Differing operating profiles may add different true-speed allowances. Fleet comparison describes individual train requirements; pairwise moving-train separation, collision behavior and operational headway are outside this profile.

The complete workspace JSON retains input libraries once. Compact study records reference those library IDs and retain the exact calculation sampling subset and explicit case plan; member digests bind both inputs and grid. The workspace digest excludes `activeStudyId`, a display/editor selection, while including all calculation configuration and allocation/probe inputs. Imported output records restore inputs and must be recomputed. Hashes identify records; they do not approve the method or input authority.


### Allocation selection, identity and recovery refinements

For margin allocation, the unrounded demand is `max(0, signedMarginM) + numericalDeltaM`. The section rounds the largest of those demands once to its own `roundM`. Operating-profile rounded `selectedM` remains a diagnostic single-study output and is not rounded again to manufacture the section allocation. Protected-distance allocation rounds the greatest `protectedM` once. Ties retain the larger unrounded demand, signed margin and protected distance before a deterministic first-equivalent-case choice. Full and partial maxima have separate quantities and governing identities.

Allocation maxima and minimum protected-point residuals can occur at different entry locations. Their identities are exported separately. Each section/method record has an `allocationKey`; a constant-grade reference and alignment trajectory are never silently presented as one governing record.

The common-entry overlay is an additional diagnostic. Its failure marks overlay review required and is retained in `overlayStatus` / `probeFailedCount`; it does not erase an independently complete section calculation. Workspace/member identities include the common probe configuration. Calculation identities also include the explicit case plan. Unsupported zero true-speed samples remain failed applicable cases, with a preflight warning; they are never silently removed to obtain a numeric allocation.

Dense input rows with exactly equal adjacent gradient and civil speed and exactly contiguous endpoints are compiled into one equivalent calculation segment. Original input rows remain intact in the workspace/report. Input and effective segment counts are retained in each member result. No tolerance-based smoothing, grade change removal or source-data replacement is performed.

Curve/alignment drafts bind to their workspace, alternative and library target. Apply validates that target; Undo, workspace switching and structural changes refuse pending drafts. Whole-workspace import clears prior structural history. Missing legacy vehicle text metadata is labeled unknown/unverified on migration, rather than being interpreted as a vehicle guarantee. Choosing a vehicle preset assigns a sheet without overwriting a sheet shared by another alternative.

Section CSV input preserves quoted text and uses the optional `text_encoding=railclear-apostrophe-v1` column for reversible formula-leading/literal-apostrophe handling. Plain user-authored CSV without that marker remains supported. Preserve the marker when reimporting exported CSV. JSON is the authoritative portable input record; external spreadsheet type conversions are not qualified by the parser tests. Direction and rounding fields require numeric notation; only chainage fields accept `km+metres`.


## Continuous comparison profile in 0.3

`continuousBounds` is separate from sampled `allocations`; `continuousCoverageStatus` does not overwrite the sampled run status. Read [the complete derivation and arithmetic contract](CONTINUOUS-BOUND.md). Each bound covers closed section entry intervals, initial physical-nose errors ±frontErrorM and 0 < commanded speed <= min(max requested speed, vehicle cap), deliberately ignoring civil entry filters. A local corridor must contain its own conservative first-arrest travel, every uncertain footprint and the supplied performance/time domains. Exact decimal-rational formulas, one exact section selection, complete member refusal records, protected and service-margin bounds and signed downstream-edge residuals accompany exports. The model does not assert an actual governing offset or entry when separate extrema supply the bound. A missing bound is not proof of nonstopping. Physical and project acceptance remain separate.

## 0.4 algorithm selection

`scenario.method` continues to select the grade model. `scenario.algorithm` separately selects `rk4` (legacy default), `classic`, `energy`, or `etcs` (definition only, explicit refusal). The [method contracts](CALCULATION-METHODS.md) define domains, equations, numerical behavior, identities and ETCS requirements. Different algorithms retain separate groups and allocations. The three implemented algorithms solve the acceleration-input profile; none introduces force/inertia, curvature or component-brake dynamics. The RK numerical description above applies to the time solver and energy prefix; classic uses phase equations and energy uses spatial propagation after its prefix.
