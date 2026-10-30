# Public research and model consultations

Date: 25 October 2026. Scope: generic webapp design, public engineering knowledge, independently authored code and synthetic examples. No private project source, proprietary fleet parameters, workbook or previous app implementation was supplied or used to populate the app.

## Directly checked primary material

- [ERA — Braking curves](https://www.era.europa.eu/domains/european-rail-traffic-management-system/braking-curves), read in the in-app browser. Describes braking prediction from train dynamics and track characteristics; links the introduction, simulation tools and handbooks. Supports treating performance, track data and braking-distance displays as connected but distinct. Its ETCS implementation is not silently transferred here.
- [ERA — Introduction to ETCS braking curves](https://www.era.europa.eu/system/files/2022-11/Introduction%20to%20ETCS%20braking%20curves.pdf), downloaded through the browser and text inspected. Braking build-up, speed-dependent deceleration, gradient and correction-factor discussions were used as public conceptual references. This app does not implement its complete supervision or reliability model.

## Requested model participation

**ChatGPT Pro**: visibly selected Pro in a fresh conversation. [Research conversation](https://chatgpt.com/c/6ade7e7f-8068-83ea-a0f1-5b2dd585e563). A public-only prompt requests primary-source research, comparison of analytic/trajectory/work-energy methods, synthetic tests, schemas and hazards. Research response and implementation review status are recorded below when actually received; progress messages are not final acceptance.

**Gemini Argon High**: visibly selected Argon High. [Design/review conversation](https://gemini.google.com/app/bd2232b761d4ec14). Completed a no-web reasoning critique of the generic product and numerical concept. It did not initially inspect local code or execute a solver. It suggested event-based integration, finite-length grade treatment, first-stop detection, stale-result invalidation, reproducible exports and negative-case testing. Its suggested four-phase synthetic polynomial case was independently checked by derivation and used as a regression; the engine initially failed it, exposing a timed-discontinuity endpoint bug, which was corrected and retested.

## Method disposition

| Candidate | Decision in first version | Reason / limitation |
|---|---|---|
| Analytic constant-grade multiphase formulas | Independent test oracle; constant-grade numerical reference available | Hand-checkable special cases expose timing/sign errors. No universal closed-form formula is asserted for variable grade and speed curves. |
| Event-partitioned trajectory integration | Implemented with RK4 and step refinement | Supports time-based failure events and finite-train alignment effects. Local RK4 step doubling, curve-knot/slope resolution and two successive maximum-step refinements; no rigorous error bound or RK45 claim. |
| Work/energy method | Used to derive the finite-train transition test; full independent runtime solver deferred | Useful independent check where forces and geometry permit closed-form integration. A same-code second integration is not independent evidence. |
| ETCS braking/supervision algorithms | Reference only | Gradient, equivalent-time and reliability conventions are model-specific; no automatic ETCS/CBTC equivalence. |
| Public vehicle facts | No real fleet preset in this version | Geometry/mass facts alone do not establish degraded braking, failure timing or load/failure conditions. All supplied preset values are explicitly synthetic. |

## Advisory points not adopted as authority

Argon used “MAS” for maximum authorised speed. This project uses **peak attained speed** for the simulated failure maximum and does not implement authorised-speed inversion. Its assertion that any local full-brake deficit proves infinite distance is not generally valid on changing grades; the engine reports lack of a stop within its bounded domain/time instead. Its suggested fixed tolerances and automatic approval/provenance rules are advisory, not standard requirements. Hashes identify inputs; they do not verify physical assumptions or acceptance.

## Implementation review and local repairs

The user explicitly authorized sending the new source and synthetic tests to **both** requested models after an initial automatic-review rejection. A later 66,918-byte, eight-section packet was uploaded through each actual file chooser, its filename chip confirmed, and sent in the conversations above. It contains the engine, worker, exports, synthetic data, app controller, two test files and calculation contract at the 0.1.0 review snapshot. No private project source or values were included.

Argon confirmed all eight sections were read and stated its code review was static, without execution. The retrieved response identified stationary-state, trial-step coverage and time/event-boundary concerns. The original 72 km/h / 5 mm boundary example did **not** reproduce locally; other speeds with 0.1 mm remaining coverage did reproduce the underlying false-error class. These are kept distinct.

Locally reproduced and repaired in **0.1.1**:

- Stationary downhill/traction-curve starts could return a false zero distance. Stationary release/hold is now explicitly unsupported and returns a failed case; positive-speed first-arrest behavior remains supported.
- RK trial stages could exceed alignment coverage before the true in-domain stop was located. Trials are now reduced without extending the profile; near-boundary analytic regressions pass.
- Fixed absolute time subtraction could evaluate before a step start. Left-limit evaluation is now relative and never earlier than the current time; timed events are not skipped by an arbitrary 1e-8 s exclusion.
- Spatial-event selection is made after localizing a first-stop event, preserving earlier spatial partitioning.
- Browser input changes originally relied on change/blur; they now invalidate results on input immediately. Browser rechecks confirmed export blocking.
- Register CSV now retains failed cases with explicit status and reason, rather than only a failure count and successful rows.

Pro's completed research response compared analytical, time-domain and work/energy methods; emphasized correction ownership, whole-train grade, distinct endpoint definitions and failed sweep retention. Its completed implementation review confirmed all eight sections were inspected. Pro reported executing all 21 supplied snapshot tests and independent probes in Node v24.22.1, including a stubbed DOM/Worker state harness; it explicitly did not test a real browser or native worker. Those executions are the reviewer's reported evidence, separate from the local runs recorded here.

Further reproduced findings and dispositions in 0.1.1:

| Finding | Disposition and local evidence |
|---|---|
| Speed-dependent equilibrium could generate a false first arrest with near-zero refinement difference | Added internal accuracy, knot-crossing and force-slope checks. The supplied fixture now arrests after traction cut at 31.005221 s and 3.112960 m, matching the independent exponential/constant-force solution. |
| Both grids could skip a narrow weak-braking feature | Accepted steps cannot skip two curve knots. The independent work-integral fixture now returns 400.384398 m and 40.014423 s instead of about 200 m / 20 s. Regression tolerance 0.1 mm / 0.1 ms. |
| Speculative speed-curve overrun of a true in-domain asymptote | Rejected trials shrink. Independent asymptotic fixture matches 69.899778 m / 11.999977 s. Actual extrapolation remains blocked. |
| Present false/0/empty-string/null curve fields silently selected scalar rates | Present-invalid types now rejected; arrays or omitted optional curves are the schema contract. |
| Curve drafts disappeared after navigation | Both drafts are retained in app state; Run and Save refuse unapplied drafts from every tab. Apply and Discard controls are explicit. Verified in the actual browser. |
| Invalid edits could poison local storage | Only validated snapshots replace the saved workspace; invalid edits remain visible and Save refuses them. Clearing a required numeric field and reloading recovered the prior valid value in the browser. |
| Imported alignment key order changed human-readable report columns | Explicit ordered fields, with reordered-key/extra-property regression. |
| Empty maximum became zero; failed cases missing from CSV | Unavailable maximum is null; CSV carries failed case identity/status/reason and blank unavailable results. Browser verifies failed-only state and disabled SVG/trace export. |
| CSV metadata could inject records/cells; malformed quote geometry accepted | Metadata comments cannot contain commas/newlines; text cells are quoted and formula-leading text neutralized. Closing-quote parser state now rejects malformed geometry. Regression coverage included. Spreadsheet application execution was not tested. |
| Phase labels hid traction/brake overlap | Trace labels now explicitly show traction plus braking/build-up. Component-force channels remain a future extension. |
| Exact horizon/timed-boundary behavior | Interval schedules remain fixed across their partitioned event. Supplied exact-horizon and overlap regressions pass. |
| Workflows and report completeness | Hash preparation locks Run immediately; error cleanup restores it. Discard controls, custom-sheet status, failure-preview disclosure, obstacle/early-arrest report columns and failed-case table added. SVG/trace export requires a governing trajectory. |
| Boundary civil speed and trace selection identity | Lower adjacent entry limit at exact boundaries applies in both directions. Governing trace follows maximum rounded sample selection, then unrounded margin. |
| Optional undefined fields changed canonical JSON identity on save/reopen | Canonicalization omits undefined object fields and uses null for undefined array entries, matching JSON round trips; nonfinite values rejected. |

Study JSON reopens **inputs** and requires recomputation; saved outputs are retained in the original exported file but are not trusted as current execution. Vehicle-preset edits are marked user modified. Metadata edits currently require rerunning the study, a deliberate simple stale-state policy. There is no automatic restore of an unverified imported result.

Neither model reviewed the repaired candidate or the extracted shared chart module after these changes. There is no external final approval, certification or two-model agreement claim. Their findings informed targeted repairs; the local analytic tests, browser checks and scope limits remain the release evidence.

## Section allocation and mixed-fleet review — 0.2 snapshot

Tony clarified that allocation is normally by meaningful signalling segment or CBTC track section, and requested both operating/failure and route profiles. This requirement drives the new workspace and allocation contract; it is user-provided product scope, not an inferred standard clause.

A new 17-section, 192,361-byte source/test/contract snapshot was uploaded to the same actual Pro and Argon High conversations, with visible attachment chips. The standing authorization covered the new application code and synthetic tests. No private project evidence or real fleet values were supplied. Both models confirmed all 17 sections were accessible.

Pro reported execution of all **52 snapshot tests** under Node v24.22.1 plus pure-module probes, generated HTML checks and actual app handlers in a VM with DOM/download stubs. It did not run a real browser, worker or rendered report. Argon stated source inspection and code/mathematical tracing without live execution. Their evidence is separate from the current local test/browser record.

| Review finding | Disposition in the repaired candidate |
|---|---|
| Undo could attach a curve draft to a previously shared vehicle; workspace import retained unrelated history | Undo/structural switching requires Apply or Discard, drafts bind to library targets and Apply rechecks them, import clears history. Actual browser checks confirm the draft stays with its cloned vehicle and cannot change the other shared alternative. |
| Slower vehicles failed curve Apply / sheet export; expanded common grid passed preflight then failed legacy validation | Asset/candidate-workspace validation replaces legacy unfiltered-speed validation. Explicit calculation grids have their own bounded validation; 41-speed and slower-member regressions pass. Browser curve Apply and actual sheet download succeed at a 40 km/h maximum against common requests up to 80 km/h. |
| Active editor extents overwrote shared study configuration | Synchronization copies only common spacing/speeds, not route/direction-derived extents. Cross-direction identity regression passes. |
| All prechecked failures left the active result null | Failed/empty member records now exist and remain inspectable/exportable. Browser shows two explicit failures and disabled trajectory exports rather than an uncalculated state. |
| Method-specific section records and residual governors were not sufficiently identified | Method-labelled section values/governors, unique allocation keys, separate allocation/residual identities and quantity-specific report tables/figures are retained. |
| Partial section maxima omitted successes inside incomplete fleet rows | Partial aggregation uses partial group fields, preserving the successful observation/governor while the full allocation remains null. |
| Repeated rounding and rounded ties obscured the actual margin demand | Section selection uses unrounded demand and one section increment. Profile-rounded results remain diagnostic. Independent 12 m / 16 m allocation fixtures and governor checks pass. |
| Section CSV formula neutralization was not reversible | Versioned reversible text encoding, quoted-text preservation, strict non-chainage numeric fields and spreadsheet boolean case handling. Signs, apostrophes, Unicode, commas/newlines and literal whitespace round trip locally. Spreadsheet application execution remains untested. |
| Legacy optional vehicle metadata failed migration; preset choice overwrote shared assets | Unknown text metadata migrates as explicitly unverified. Preset selection assigns a sheet and preserves other alternatives' shared original. |
| CLI alternative subsets left unrelated sections unevaluated; invalid plans created directories | Symmetric route/direction scoping for subset flags; validation/calculation precedes output creation. Existing records remain protected. |
| Probe outcomes and standalone record identities were incomplete | Overlay status/review is distinct from section coverage; member identities include probe configuration. CSV and fleet SVG records carry engine, generation time and input identity. |

Argon's suggestion to mark unsupported stationary cases inapplicable was not adopted. A release/holding model is outside the contract; silently omitting a requested state could turn unknown coverage into an apparent allocation. Such cases remain explicit applicable failures, with a preflight warning. Argon's original multi-vehicle rounding example also requires distinguishing its single-vehicle 12 m value from the fleet's true 16 m value; the regression tests cover both separately.

The final repaired tree includes additional locally verified input recovery, exact redundant-segment compilation and presentation changes beyond the review snapshot. Neither model's snapshot review is represented as approval of that later tree or as project/safety qualification.

## Continuous uncertainty and section-coverage challenge — 0.3

26 October 2026. The requested actual Pro and Gemini Argon High sessions challenged the proposed method, then received newly written source and wholly synthetic fixtures. No private railway reports, fleet parameters or old implementations were supplied. The public [ERA braking-curve guidance page](https://www.era.europa.eu/domains/european-rail-traffic-management-system/braking-curves) was inspected again: it motivates the distinction between supplied train/track dynamics and a particular train-control algorithm. It does not validate this independent comparison profile or establish ETCS equivalence.

The method challenge led to a separate sufficient comparison profile rather than relabeling sampled maxima. It covers closed entry sections, an explicit initial physical-nose interval and continuous positive commanded speeds. Traction is removed at its guaranteed cut, braking is credited only after full establishment, a first-exit corridor must contain its own bound, and exact decimal-rational operations resolve arithmetic/selection ambiguity. The service-reference margin uses the full quadratic, including an admissible interior maximum. See CONTINUOUS-BOUND.md.

Pro executed Decimal/Fraction and JavaScript arithmetic counterexamples during the method challenge. For the 12-file source-A packet, it inspected every section, ran pure calculation probes without stubs, independently matched 30 Fraction cases across protected distance/margin/extremum (90 comparisons), and ran 17 supplied bound tests in a clearly qualified harness using two earlier helper modules and a chart stub. The original packet omitted three integration helpers, so that harness pass is not a packet-alone/full-app pass. Its unmodified oracle check found only an extra Markdown-extraction trailing blank line, with all seven numerical fixtures matching parsed JSON. It did not run the actual browser/worker or chart rendering.

Gemini inspected source A statically, explicitly ran no Node/Python process, checked the first-exit proof and independently derived energy/phase/margin fixtures. It then read all 14 complete repaired packet-B files, including exact dependencies, 27 bound tests, three batch tests and the constrained energy oracle. It closed its consequential findings statically and reported no remaining consequential counterexample; one nonblocking zero-margin tie identity was subsequently aligned locally. This is model-review evidence, not independent physical acceptance.

| Challenged finding | Disposition |
|---|---|
| Rounded-up speed-domain metadata claimed speeds beyond those actually proved (Pro and local review) | Preserve the exact chosen original numeric cap. Regression checks fractional domain precision. |
| Generic HTML `toFixed(3)` could show an upper allocation below its mathematical demand (Pro and local review) | Preserve the outward numeric spelling in the bound summary. Exact fractions remain alongside it. A deliberately fine selection quantum is checked. |
| Rounded allocation ties and rounded residual comparisons misidentified the stronger source; partial source not exported (Gemini) | Compare exact fractions; retain distinct requested/protected/margin/residual source identities; export partial value/source explicitly. |
| Active diagnostic and section governor tie ordering differed (Gemini) | Use the shared diagnostic comparator. Different allocation quantities can still legitimately have different sources. |
| Negative zero changed JSON round trips; small positive lower-rate presentation collapsed to zero (Gemini/local) | Normalize zero; preserve significant digits before outward comparison. Exact rational evidence is authoritative. |
| Closed speed-limit endpoint appeared to be an attained maximum (Gemini) | Prefer a valid in-domain tie; explicitly label a genuine positive-speed-limit supremum. Never invent a simulated entry/offset for independent extrema. |
| The energy oracle could skip an interior first zero when kinetic energy later rose (Pro/local) | Explicitly enforce this oracle's strictly decreasing-energy and footprint/contiguity preconditions; current seven fixtures are unchanged. It is not a general first-arrest solver. |
| Packet helpers were missing; trailing blank line created a false fixture mismatch (Pro) | Repaired packets include all pure test dependencies; oracle check compares parsed JSON, retaining exact expected numerical strings. |
| Repeated external legend and strict library metadata observations (Gemini) | Embedded SVG legends/status already exist; unused duplicate HTML legend construction removed. Raw vehicle imports deliberately require metadata; legacy project migration has its own fallbacks. The actual structural starter UI already clones and validates transactionally. |

The comparison bound encloses the declared decimal mathematical model. It does not enclose arbitrary RK implementation noise; a sampled numerical-delta allowance can occasionally round a diagnostic allocation one selection step above the exact-model bound. That is not a license to drop failed samples, remove numerical allowances or infer equivalence to a project's accepted calculation model. Project method/data/uncertainty/datum and infrastructure policy remain separate acceptance decisions in PROJECT-QUALIFICATION.md.
