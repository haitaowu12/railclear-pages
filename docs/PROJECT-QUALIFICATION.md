# Applying the continuous profile to a project

The implemented bound answers a mathematical question. This record identifies the project evidence needed to use the answer. Keep completed records and confidential benchmarks in ignored `projects/` or the project's controlled document system, not in the synthetic application repository or external model packets. This blank record does not grant approval or impose new approval authority.

## Calculation identity and scope

| Item | Project disposition / evidence locator |
|---|---|
| Project, calculation ID, revision, preparer, independent checker and disposition | Unspecified |
| Application release and continuous comparison method | Record the actual engine and bound method from the exported study |
| Governing standard/system method, edition and applicability | Unspecified; no automatic IEEE/ETCS/CBTC equivalence |
| Included signal segments / CBTC track sections and directions | Record section IDs, ranges, references and assigned quantities |
| Nominal reference | Physical leading end; record any antenna/cab/centre conversion for each operating orientation |
| Alignment datum and survey version | Along-track metres; map discontinuous stationing/branches externally |
| Allocated quantity and downstream consumer | Protected first-arrest reach or margin beyond ideal service target; do not exchange them |
| Positive commanded-speed domain and civil applicability | Confirm each exported member domain; the bound ignores civil entry filtering conservatively |

## Evidence for model inputs

For each vehicle / formation / operating-failure profile, identify the accepted evidence, revision and locator for:

- Effective brake deceleration lower envelope through the full comparison speed range, loading, degraded equipment, adhesion/WSP and thermal conditions. A nominal rate or marketing value is insufficient. Corrections already included must be explicit.
- Propulsive acceleration upper envelope and certainty of traction removal at the declared cut time. Sustained residual traction after that time is outside this profile and must not be represented by a shorter cut.
- Common time origin, reaction/command, achieved traction cutoff, first brake effort and full-brake timing. Resolve overlapping versus serial delays and any equivalent-response-time definitions.
- Initial true-speed upper error, initial physical-nose position interval, train length and operating orientation. The current bound does not grow odometry uncertainty with distance/time.
- Leading rear position error, rollback and additional clearance ownership. These remain additive supplied magnitudes; first arrest does not demonstrate continued holding.
- Surveyed route coverage and protected-point meaning. The signal/track-section reference alone does not set the hazard coordinate.
- The ideal service reference, if a margin is allocated. This is commanded-speed squared divided by twice the supplied constant service deceleration; it is not a service-controller simulation.

## Independent project reconciliation

Choose independently calculated cases that exercise the accepted project profile rather than copying a published headline distance. Include a uniform segment, an adverse finite-train grade transition, both directions, the governing failure timeline, a speed-curve feature, section endpoints and the worst credible initial-position interval. Compare raw travel, response events, true/commanded speed, service reference, allowance ownership, protected reach and signed residual separately.

Record the independent method/tool, input evidence, expected figures and justified comparison tolerance. Re-run the retained synthetic verification suite for software regression; it cannot substitute for this physical-data reconciliation. Do not tune inputs merely to force agreement with an unexplained legacy spreadsheet.

## Infrastructure allocation policy

A demonstrated braking/fleet bound does not by itself establish the project's implemented signal or track-section data. Record the independent policy for:

| Allocation decision | Project evidence / disposition |
|---|---|
| Section boundary authority and route/direction mapping | Unspecified |
| Continuous physical calculation versus an approved lookup/decision-table method | Establish applicability or equivalence; do not infer it from one matching result |
| Look-ahead/scanning region, minimum transition spacing or transition-count constraints, if required | Unspecified; the braking proof corridor does not implement a data-production scanning policy |
| Output quantum, position-count unit, datum and conversion/rounding direction | Unspecified; a metre selection increment does not establish a signalling position-count interface |
| Other infrastructure or operational separation constraints | Identify separately; a first-arrest calculation does not satisfy every separation requirement |
| Implemented transition register and independent checking | Record selected values, boundaries, governing sources and accepted deviations |

Component braking events and force/inertia/BAM behavior need their own accepted profile when they cannot be conservatively represented by the supplied effective acceleration bounds. Separate numerical coverage from vehicle-model equivalence and implemented infrastructure policy.

## Run and disposition

```sh
npm run verify
python3 scripts/benchmark-oracle.py --check
npm run calculate -- projects/your-workspace.json --out runs/new-reviewed-run --require-bounds
```

The second command reconstructs synthetic energy benchmarks and needs Python; the app and normal Node checks do not. Batch outputs preserve both sampled state and continuous coverage state. Exit 2 retains incomplete/refused records. Inspect every refusal, not only the exit code or fleet maximum. A `bounded` result establishes the stated sufficient model conditions; it does not automatically accept this project record.

Retain the workspace-study JSON, continuous-bound CSV, sampled allocation register, calculation report and independently checked comparisons. Record the authorized engineering disposition, exceptions and intended downstream use in the project's normal system. Unresolved input guarantees, coordinate conversion, method mismatch or unsupported post-arrest behavior remain explicit limitations on use.
