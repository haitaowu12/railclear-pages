# Product status and qualification work

## Implemented through 0.3

## Current workspace improvements — October 29, 2026

The local candidate extends the existing section-editor interaction to vehicle, operating-profile, sampling, route-identity and project-record inputs. It adds structured performance-curve editing, shared-use visibility and independent vehicle/profile copies, import freshness checks, persistent browser-save warnings and suppression of stale results. Complete-workspace reports and records are directly available from Report & exports. These are project-workflow improvements; calculation kernels and engineering acceptance criteria are unchanged. See VERIFICATION.md for the exact exercised scope and remaining limits.

## Qualification work before issuing safety-critical design values

These are separate engineering acceptance items, not silently completed by software tests.

1. **Accepted calculation profile and benchmarks.** Establish governing standard edition and applicable project method, distance/reference conventions, response schedule, correction ownership and vehicle/load/failure conditions. Retain complete independently checked benchmark inputs and results outside this public/synthetic source repository. Acceptance requires reconciliation of all quantities and boundary cases with the agreed profile, not only a matching headline distance.
2. **Position uncertainty through changing geometry — software method implemented, project interpretation remains.** The separate continuous comparison bound covers an initial physical-nose interval ±frontErrorM, both directions and full train/route corridors, with spatial-energy counterexamples to nominal-plus-error. The project must accept the initial-error reference, magnitude and allowance ownership; antenna/cab/centre inputs require conversion before import. It is not an odometry-growth or post-arrest model.
3. **Continuous section/speed coverage — sufficient comparison bound implemented, project applicability remains.** A self-containing corridor and exact decimal-rational calculation cover all closed section entries and positive commanded speeds through the stated vehicle/requested cap. The method refuses unsupported route/performance/time domains and nonpositive uniform retardation; it can be pessimistic. The nominal trajectory solver still reports sampled maxima and numerical sensitivity. Review [CONTINUOUS-BOUND.md](CONTINUOUS-BOUND.md), independent evidence and the accepted project profile before using bound values for design.
4. **Additional vehicle/route behavior where required.** Force/load/rotational-inertia models, asymmetric formations, separate braking circuits/BAM, adhesion/WSP, post-arrest holding/restart, chainage discontinuities/branches and moving train-pair separation require separate contracts and independent cases. An acceleration profile may represent an accepted degraded condition only when its evidence establishes that meaning.

## Follow-up product work

- Project-specific alignment adapters after a real input format and coordinate mapping are agreed.
- Separately accepted lookup/decision-table profiles, component-brake events and infrastructure transition policies where a project requires them. A continuous braking corridor does not substitute for position-count mapping, look-ahead/transition spacing or an approved data-production rule.
- Additional browser/OS qualification, accessible long-register workflows and installed/PWA distribution if needed.
- Independent final acceptance of the selected release/profile. Model-review findings inform repairs; model agreement is not certification.

## Implemented in 0.3

- Independent continuous comparison kernel, exact decimal-rational arithmetic and one exact section selection; no RK convergence claim is used as a safety bound.
- Initial physical-nose interval, both-direction full-footprint coverage, self-containing local corridor, continuous positive-speed domain, interior service-margin maxima and separate protected-point residual identities.
- Per-member refusal and fleet/partial distinction, dedicated CSV/JSON/HTML/UI records and `--require-bounds` batch gate.
- Independent 60-digit spatial-energy fixtures, logarithmic variable-brake integral, and externally derived analytic/rounding/overlap/fleet counterexamples.

## 0.4 candidate — study workflow and solver selection

The local candidate adds exact classic and hybrid specific-energy solvers for the existing effective-acceleration physical model, separate method groups and explicit refusal domains. ETCS is a profile definition only pending baseline selection and independently checked cases. The study-results workspace groups allocations, continuous bounds, sample inspection, reports and one ZIP export; the input workspace groups vehicle/profile/alignment/record editing. See CALCULATION-METHODS.md and the dated verification record. Full force/inertia/component-brake project methods, geometry extensions, accepted infrastructure transition rules and reference-report reproduction remain qualification/development work; selecting an algorithm does not close them.
