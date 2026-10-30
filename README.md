# RailClear 0.4

Compare railway first-arrest distance requirements across vehicles, operating/failure profiles and routes. Define the traditional signal segments, CBTC track sections or engineering sections where failures may begin, run the study, inspect governing cases and export a reproducible study pack. Built-in examples are synthetic.

## Start a study

1. In **Sections & fleet**, define failure-entry ranges and assign vehicles, operating profiles and routes. Select the quantity to allocate and a rounding increment for each section.
2. In **Study inputs**, review vehicle rates, allowances, failure timing, alignment and project basis. Apply or discard each draft before leaving.
3. Use **Calculation methods** to select time integration, classic analytical or work–energy within its supported input domain. ETCS is definition only.
4. Run the study and inspect **Study results**. Read failures and continuous-bound refusals alongside the sampled allocation register.
5. Download the study pack for the report, portable workspace, reproducible study and full CSV records. Save workspace inputs separately whenever needed.

Calculations and browser saving stay on your device. Export files may contain confidential data if you supply it. Browser saving is a recovery convenience; keep controlled copies of completed studies.

## Interpret results

A section bounds failure-entry locations, not the stopping trajectory. Supply enough route coverage behind and ahead of the train. A failed applicable case makes the affected allocation unavailable.

Margin beyond the ideal service target and protected first-arrest distance use different datums. Keep their quantity labels with every downstream value. A sampled maximum is separate from a continuous section bound; inspect each bound’s declared domain and refusals.

Read the [calculation contract](docs/CALCULATION-CONTRACT.md), [solver domains](docs/CALCULATION-METHODS.md), [continuous-bound derivation](docs/CONTINUOUS-BOUND.md) and [project qualification worksheet](docs/PROJECT-QUALIFICATION.md) before using outputs in engineering decisions.

Software checks do not qualify project inputs, establish standards/vendor equivalence or grant operational approval. Independent engineering review and project-specific evidence remain necessary.
