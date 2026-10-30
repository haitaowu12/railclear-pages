# RailClear

Railway safety-distance studies allocated by **traditional signal segment, CBTC track section or named engineering section**, with mixed vehicles, operating/failure profiles and route variants.

Configure the sections where failures may begin, compare vehicles on a common grid, inspect governing cases and carry a complete calculation record into downstream engineering review. All starter vehicles, routes and examples are synthetic. No private project records or prior implementation are included.

## Run locally

Node.js 20 or newer; no package installation, API key or account is required.

```sh
npm start
# Open http://127.0.0.1:4173
npm run verify
```

The server binds to loopback. It serves static files with no upload/computation endpoint. Calculations run in a browser Web Worker. Applied inputs are saved to this browser's local storage when available; **Save workspace JSON** provides the portable record. Storage failures and detected changes from another tab show a persistent warning and preserve an export path. Browser saving is a recovery convenience, not a multi-user project store. Save files may contain confidential data if you add it. Keep real project files in ignored `projects/` or `runs/` folders and follow your project's information controls.

## Working sequence

1. **Allocations & fleet:** define entry ranges and signal/track-section references. Select travel direction, quantity to allocate and rounding increment for each section. Optionally supply an actual protected-point chainage for clearance checks.
2. Add fleet alternatives and assign vehicle, operating profile and route. Shared library IDs share inputs; duplicate a library asset before making an independent variant. Vehicle sheets, failure timelines and alignment CSV are edited through the active alternative.
3. Select common chainage/speed samples and a common entry for trajectory overlays. Check the case budget, then run the workspace.
4. Inspect each section's status, allocation and governing vehicle/profile, entry location and speed. Inspect failures, inapplicable speeds, numerical histories and optional protected-point residuals.
5. Compare the separate **continuous section bounds** with sampled allocations. A bounded result covers every entry in the section, position error within ±front error, and every positive commanded speed up to each vehicle’s cap or the greatest requested speed. Read per-alternative refusals before interpretation.
6. Export the section allocation register, all-case/envelope CSV, common-entry traces, vector figures, self-contained HTML report and reproducible study JSON.

Vehicle sheets, operating profiles, sampling, route identity and project metadata use isolated editors. Review shared users before applying; vehicle/profile editors can create a separate copy for the active alternative. Invalid drafts leave applied inputs unchanged. Cancel discards a draft; closing a changed editor or pressing Escape offers Keep editing / Discard. Performance curves use explicit speed/rate rows. Source and calculation-basis fields support multiline references.

After applied changes, previous allocations, bounds and trajectories are withheld and result exports stay disabled until a fresh run. An import started before another edit or active-target change is refused. Unapplied modal drafts are not saved across browser restart; apply or cancel before closing. If another tab has changed the saved workspace, export this session before reloading to review that version. The snapshot comparison detects already-changed saves; it is not an atomic cross-tab lock or collaborative merge.

A section end **does not truncate the stopping trajectory**. Keep enough route data behind the leading end for the entire train footprint and ahead for first arrest. Missing tails are failed cases. Shared section boundaries are checked in both neighboring sections. Gaps between enabled sections remain unassigned.

If browser saving reports damaged data or a conflict, **Save recovery JSON** retains applied inputs, unfinished alignment/curve drafts and the earlier raw browser records. Open that recovery file through **Open project** to restore its session inputs and drafts. **Review browser recovery** can install the current session after retaining an exact earlier copy; those copies are downloadable under **Report & exports → Earlier browser data**. Recovery refuses intervening saves and preserves a copy if a later write fails. Recovery files can contain confidential or damaged source data, so retain them with the project records. Modal editor drafts still require Apply or Cancel before closing the page.

The allocation quantity is explicit: margin beyond an ideal service target, or protected first-arrest distance. These use different datums and must not be exchanged as an unqualified “safety distance.” A failed applicable fleet case makes the affected section allocation unavailable. Successful partial observations remain available separately for investigation.

## Examples and inputs

- `examples/mixed-fleet-workspace.json`: three synthetic vehicle sheets, one operating profile, three CBTC example sections.
- `examples/operating-route-profiles-workspace.json`: nine alternatives, two operating profiles and two route variants; allocations remain separate by route and direction.
- `examples/allocation-sections-input.csv`: section-input format with explicit route/direction, signal/track-section reference and quantity.
- `examples/reference-fleet-report.html`: self-contained calculation record; print CSS included.
- `examples/reference-project.json`: older single-project format, automatically migrated to one explicit engineering section when opened.

Alignment CSV uses `from_m,to_m,gradient_permille,speed_kph`. Up to 20,000 ordered contiguous segments per route. Gradient is rise/run in per mille, positive in increasing canonical track chainage. Chainage accepts metres or `km+metres`; no unit guessing or grade extrapolation. Alternative route profiles require an explicit chainage datum; discontinuous engineering stationing, branches and horizontal coordinates need an external mapping to this along-track coordinate.

Section CSV uses the exact headers exported by **Download sections CSV**. Import replaces sections only after full validation; invalid data leaves the previous section set available. Library JSON retains vehicle/profile/route inputs; imported route sections are remapped and initially disabled so imported data does not silently become a current allocation.

Workspace schema 2 separates vehicles, profiles, routes, alternatives and allocation sections. Legacy schema 1 projects still open. Study JSON restores inputs and requires recomputation; imported outputs never become current calculations automatically. Compact study exports store input libraries once and bind exact member grids into their identities.

## Local batch work

```sh
npm run calculate -- examples/mixed-fleet-workspace.json --out runs/study-001 --require-bounds
npm run calculate -- examples/mixed-fleet-workspace.json --out runs/section-001 --sections allocation-1
npm run examples
```

`--alternatives id,id` optionally selects fleet alternatives. `--sections id,id` selects sections and, unless alternatives are explicitly selected, limits enabled alternatives to matching routes/directions. Output goes to an empty directory; existing records are never overwritten. Exit status: 0 for a completed or review-required sampled run, 2 for incomplete/no-applicable results (records retained), 1 for invalid input or execution/export failure. `--require-bounds` also returns 2 if any continuous section bound is unavailable; refusal records are retained. The command summary reports both sampled and continuous coverage states.

Planning limits: 30 alternatives, 30 vehicle sheets, 30 operating profiles, 12 routes, 2,000 allocation sections, 2,000 candidate cases per alternative and 12,000 per workspace. The common grid includes section endpoints, compared train-length grade transitions and vehicle/civil entry-speed limits up to the greatest requested speed. Preflight counts these additions before calculation. Run practical subsets rather than treating a whole line as one arbitrary allocation.

## Model and qualification

The acceleration-input kernel includes timed reaction/command, separate propulsion-disable and brake-onset delays, linear brake build-up, continuous speed curves, signed finite-train gradient gravity and first-arrest detection. Curve features, event timing, coverage and numerical refinement are checked. Mass is recorded and does not rescale supplied rates. Inputs must already represent the chosen load, adhesion and equipment/failure condition.

This is a study and verification tool. A completed sampled calculation does **not** establish an accepted fleet model, a continuous conservative envelope, IEEE/ETCS/CBTC compliance or operational approval. Mixed fleet compares individual-train requirements; moving train-pair separation, collisions and headway are not simulated. Force/inertia models, separate track brakes/BAM, dynamic adhesion/WSP and holding/restart remain outside this profile. Nominal RK trajectories retain additive position allowances; the separate continuous comparison profile bounds changing geometry for a declared initial-position interval.

The [continuous-bound derivation](docs/CONTINUOUS-BOUND.md) explains the self-containing corridor, exact decimal arithmetic, positive-speed domain, interior service-margin maximum and refusal conditions. Its independent spatial-energy benchmark uses a separate 60-digit Python oracle; `python3 scripts/benchmark-oracle.py --check` reproduces the checked fixtures. Python is optional for development and unnecessary to run the app.

Read the [calculation contract](docs/CALCULATION-CONTRACT.md), [verification evidence](docs/VERIFICATION.md), [public research and model reviews](docs/RESEARCH.md), [roadmap and qualification work](docs/ROADMAP.md), and [contribution guidance](CONTRIBUTING.md).

For real-project evidence and disposition, use the [project qualification worksheet](docs/PROJECT-QUALIFICATION.md). It distinguishes the implemented comparison proof from accepted vehicle, timing, uncertainty and coordinate evidence.

## 0.4 study workspace candidate

**Study results** is the output home: searchable section allocations, separate continuous bounds, governing-case inspection, traces/checks and an on-demand complete report preview. **Download study pack** produces one local ZIP containing the report, restorable workspace, reproducible study, allocation/bound/case/envelope/trace CSVs and a reading guide from the same run. Packaging runs in a separate worker; an input change invalidates an in-flight download. Individual exports remain available. Export filenames are stable; retain each completed pack in your normal controlled study/revision folder.

**Study inputs** groups the active alternative's vehicle, failure/allowance profile, alignment and study record. Alignment rows are editable with explicit Apply/Discard, 50-row pages and the original CSV/recovery route. Invalid drafts leave applied inputs unchanged. CSV import still replaces a route only after validation. **Sections & fleet** owns domains, assignments and common sampling.

**Calculation methods** selects time integration, classic analytical or work–energy through the shared operating profile. See [method domains and ETCS definition](docs/CALCULATION-METHODS.md). ETCS remains definition only, as agreed; a baseline and independent cases are required before implementing it. This release is a study candidate. Engineering qualification and project acceptance remain open.

## GitHub Pages

The browser app is published at https://haitaowu12.github.io/railclear-pages/. Calculations and saved inputs remain in the visitor’s browser. `npm run build:pages` assembles only application source, public documentation and synthetic examples in ignored `site/`; private runtime folders are excluded. The verified static build is published from `gh-pages` using GitHub’s branch hosting, without a custom Actions deployment workflow. Publication identity is retained in `deployment.json`.
