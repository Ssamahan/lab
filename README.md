# Lab Systems — Ruli District Hospital

The laboratory operating console for **Ruli District Hospital, Laboratory Department**
(Gakenke District, Rwanda). Referred samples, chain of custody, commodity security,
rosters and leave, EQA and ISO 15189 quality, equipment, PBF evaluation and training
revenue — in one offline-first workspace.

**Version 6.9.4** · FY 2026/2027 · works with no network, installs as a PWA.

---

## What changed in 6.9.4

**The questionnaire is worth 25 marks, and the marks are not spread evenly.**

- The nine questions carry **5 · 3 · 3.5 · 2 · 2 · 2 · 3 · 2.5 · 2 = 25 marks**,
  applied in the order of the questionnaire. They are stored on each question, so
  moving a question keeps its marks with it and re-weighting one question never
  disturbs the others.
- **Half marks are real.** Every mark input steps by 0.5 and anything typed is held
  to the nearest half mark inside the question's maximum — 4.3 becomes 4.5, 9 on a
  3-mark question becomes 3. The percentage beside the field is the percentage that
  is saved.
- The index is still **marks earned ÷ marks available × 100** — now out of 25, so
  22.5 marks reads 90 %. Domain percentages are unchanged: each domain's own marks
  over its own marks available.
- Marks already recorded on the old 25-per-question scale are rescaled once, in
  proportion, so every stored percentage is exactly what it was before.
- The bank shows **25 marks available** and flags it in amber if the questions are
  ever re-weighted away from 25; the maximum-marks field accepts 0.5 increments.
- Printed scorecards and the centre drawer show the true fractions (e.g. `22.5 / 25`,
  `3.5` marks for question 3), never rounded to whole units.

## What changed in 6.9.3

**The question bank now reads like the paper questionnaire, and the index has a history.**

- **One flat, numbered list.** Every question carries its position on the sheet —
  1 to 9 — in the bank, in the visit form, in the centre drawer and on the printed
  scorecard, so what you enter is what the assessor wrote on the page.
- **Free reordering.** Drag a question by its grip, or use the ▲ / ▼ arrows, to put
  the bank in the order of your questionnaire. The order is stored per question
  (`order`) and every screen follows it.
- **Nine questions, as on the form.** The eight seeded questions that are not on the
  district questionnaire are retired, not deleted: they disappear from the numbering,
  the scorecard and the reports, and each one can be restored in a click from the
  bottom of the bank (a restored question appends as number 10).
- **Progress by quarter.** A new *Progress by quarter* card plots the index over every
  quarter recorded, so improvement is visible as soon as Q2 is entered. *District &
  domains* shows the district index as a solid line with each domain's own percentage
  underneath, measured against the 80 % floor. *Health centres* shows one line per
  centre, capped at the eight with data. The side panel lists each quarter's index
  with its point change, the movement since the first quarter, and the most improved
  domain or centre. Nothing is hard-coded — a new quarter appears the day its
  scorecards are complete.

## What changed in 6.9.2

**The PBF index is now arithmetic anyone can check, and the domains belong to the district rather than to the code.**

- **The index is marks, not weights.** Every question is marked out of its own
  maximum — 25 by default — so 25/25 is 100 % of that question. The index is the
  whole scorecard's **marks earned ÷ marks available × 100**. Nothing is weighted,
  nothing is renormalised, and a centre is still only ranked once every question
  carries a mark.
- **Domains are editable.** *Manage domains* in the question bank renames,
  re-weights, adds and retires domains; the list is stored with the register
  (`db.pbfDomains`) and weights are normalised to exactly 100 % with a
  largest-remainder rounding (no more 101 %). A domain with no questions is left
  out of the scorecard, the heatmap and every report, exactly as before.
- **Questions are allocated by hand.** Pick any set of questions in the bank and use
  *Move to domain*, or choose the domain in the question editor. Each domain keeps
  reporting **its own percentage** — its marks earned over its own marks available —
  so a centre can be at 60 % on commodity security while the district index is 88 %.
- **Quality index colours.** 90 % and above is the deepest green, 80–89 green,
  75–79 light red and below 75 blood red. The percentage is printed **inside** the
  index chart — above every bar in the quarterly strip, inside every heatmap cell,
  in the centre ring and in the tooltip.
- **The supervision calendar is clickable.** Tap any day to see what is planned,
  record the visit that happened on it, or put a new one on the plan. Recorded
  visits fill in the matching planned slot automatically.
- **Assessor compliance.** Assessors default to you — Kelvin — and you can pick any
  lab staff member from the roster or type a new one in once. Every planned visit is
  compared with the date it was actually recorded: on time, late by *n* days, missed
  or still upcoming. A new compliance card shows the on-time percentage per assessor
  and the district total, and each recorded visit's toast tells you whether it landed
  on the plan or how late it was.

## What changed in 6.9.1

- **The Command Center packs its cards instead of stacking two columns.** Every card
  now goes into one grid that fills the first free slot on the row
  (`grid-auto-flow: dense`), with its row height measured from the card itself and
  recalculated on resize. The old layout was two independent columns, so whichever
  side ran out of content first left a tall block of empty page under it — the gap
  you can see under *Priority worklist* while *Live activity* is still going.
- Column count follows the screen: one below 880 px, two to 1320 px, three above.
  The throughput chart takes two columns, the worklist table takes two when there is
  room and the full width when there is not, and the activity feed closes the page
  with a full-width row so the last row never ends half empty.
- Cards stay level with their content: a ResizeObserver re-packs the grid when a
  chart redraws or a list grows.

## What changed in 6.9.0

**The console can now share one register between your phone and your PC, and the
day-to-day screens behave the way the bench actually works.**

### Sync (new)
- **Supabase backend included.** `supabase/schema.sql` creates the single
  `lab_registers` table with row-level security; `supabase/README.md` is the
  five-minute setup. Paste the project URL and the **anon** key into
  **Staff & Settings → Cloud sync**, press *Test connection*, then *Sync now*.
- Offline-first: every edit is still written to the device first, pushes happen
  1.5 s after a change, failed syncs retry when the network returns.
- Two devices editing at once is **not silent**: the console asks which copy to
  keep and takes a restore point before replacing anything.
- Sync is off until both fields are filled. Nothing leaves the device before that.

### Screen
- **The header hides while you scroll down** and returns on any upward flick, so
  the page owns the screen.
- **Light is the default.** *Auto* follows the device; a computer with no dark
  preference opens light, a phone set to dark opens Ink. The toggle now records an
  explicit choice instead of flipping a stored default.
- **Live activity shows both directions** — a sample registered and a result back —
  and re-flows into two or three columns on a wide card instead of leaving blank
  space.
- **Charts export as PNG (3× resolution) or SVG (vector)** from the small control
  that appears on hover, ready for the lab social-media groups.
- Lab services and the weekly allocation now use the full width in a responsive
  column grid.

### Referral register
- **Turnaround by test category reads the referral catalogue**, not a roster or a
  stale category on an old record; the compliance KPI counts referred samples only.
- **Culture results are configured, not free text.** Blood culture and TB culture
  take a *Negative / Positive* call; a positive opens the susceptibility panel
  (S / I / R per drug), and the released result carries the organism and the AST
  table.
- **You choose the result release date.** Back-date the release when the result
  arrived earlier than you could type it: turnaround is measured from that field,
  the correction is audited, and the sample is flagged as *back-dated*.

### Stock
- **Lots & expiry, consumption and suppliers open again** — the tab handler was
  listening to the wrong attribute, so only the overview ever rendered.
- **Every row is editable:** lots (quantity, expiry, receipt date, age group, note)
  and consumable lines (name, unit, minimum) open in a small correction dialog,
  audited like any other change.

### Roster & training
- **Night is the last row of the weekly roster**, one name per night, editable like
  any cell; shift codes no longer repeat inside every service cell.
- **Kelvin stays off the grid** unless a weekday would otherwise be down to two
  people; **Beatrice is the reception desk**, with about one week a month on
  parasitology, biochemistry only in a pinch, and never phlebotomy or TB.
- **In-house sessions at Ruli DH no longer move the FIFO queue** — only training
  attended elsewhere is a turn served (the session is still recorded).
- **Certificates are recorded, not assumed:** each session is marked *certified* or
  *not certified* when it is entered, and can be toggled later.
- The organizer default is now simply **RBC**.

---

## What changed in 6.8.1

- **The referral test picker is now exactly the reference-laboratory menu.** ALT,
  RPR and urinalysis followed CBC, malaria RDT and blood slide, fasting glucose,
  creatinine, sputum AFB and the HIV rapid test out of the catalogue. What remains
  is the ten tests Ruli DH actually refers: blood culture, HIV recency viral load,
  TB culture, measles & rubella PCR, monkeypox, Marburg, polio, Rift Valley and
  yellow fever PCR, and hepatitis. Local registers prune the retired entries on
  load.
- Bench competency records still cover the on-site panel (CBC, malaria, glucose,
  creatinine, ALT, HIV rapid, RPR, urinalysis, AFB) — that register is about work
  done here, not about referrals.

## What changed in 6.8.0

**A smaller rail, a cleaner register, and roles for the people who only read.**

- **Referred samples carry the referral menu only.** The referral test picker no
  longer offers bench work done on site; it holds the reference-laboratory line —
  blood culture, HIV recency viral load, TB culture, the outbreak PCRs and
  hepatitis — untouched. Local registers prune the old entries on load.
- **The status strip is gone.** *All systems operational · Synced · Saved 17:46 ·
  PROD · v6.7.2 · RW · Kigali* no longer sits under the content, for any role. What's
  new and install moved into the command palette (⌘K) for administrators.
- **Viewer and Reviewer are real roles.** Security Center → Accounts & two-factor
  now has a role selector on every row. A **Viewer** reads the register and exports;
  a **Reviewer** reads, records and signs off assessments but sees no revenue,
  security, design system or roadmap. Changes apply on the next action and land in
  the audit trail. The owner account stays Admin.
- **Modules a viewer must not see stay hidden.** The rail, the command palette and
  the mobile *More* sheet all filter by permission, so Training Revenue, Security
  Center, Design System and Premium Roadmap never appear for reader roles.
- **The rail collapses to the width of the hamburger.** 46 px instead of 74, and the
  module name appears in a small chip beside the icon on hover or focus — including
  for the active module, which the old CSS tooltip could never show.
- **The rail follows the theme.** Mini nav, brand and user block now render in
  Porcelain's light palette instead of staying dark.
- Page subtitles, hero paragraphs and the compliance strip are hidden for viewer and
  reviewer sessions — same records, less briefing text.

---

## What changed in 6.7.2

**A domain with no questions is no longer a column.** Delete every question in a
domain and it drops out of the centre scorecard, the domain heatmap, the visit
form, the printed scorecard and the district report — no more *0 % of index · 0
questions* rows, and no empty dashes where a domain used to be.

- The six declared weights are shared out across the domains that still hold
  questions, printed as whole percentages that add up to exactly **100**
  (largest-remainder rounding), so a scorecard header can never read 101 %.
- The index is computed from the domains actually being evaluated: a domain whose
  questions have not all been marked is left out and the rest are renormalised over
  what is present, never scored as zero.
- A domain comes back the moment you add a question to it — the **Add question**
  dialog still lists every domain and marks the unused ones *not in use*.
- The question bank only lists domains in use, with a single line explaining where
  the weight went.

---

## What changed in 6.7

- **Question bank, multi-select.** Every question has a tick box, with *select all*,
  a per-domain *all* and a running count. Tick as many as you like and delete them in
  one confirmed action; deleted questions stop scoring and can be restored.
- **Domain percentages auto-calculate.** A domain's score is the marks earned over the
  marks still available in that domain, and the six domain weights renormalise over
  the domains that still hold questions. Removing questions — or an entire domain —
  never distorts the index or needs a manual recalculation.
- **A visit needs a complete scorecard.** Saving a visit with any blank question is
  refused and the first blank field is focused. A centre with a complete scorecard is
  ranked; one with blanks reads *Visited · marks pending* and shows a dash in the
  heatmap instead of a fabricated score.
- **Baseline honesty.** The generated question-level marks that shipped in 6.6 are
  discarded. Coko, Minazi, Rwankuba and Muhondo keep their recorded supervision
  visits (marks to be entered); every other centre reads *Not yet visited*.
- **Supervision calendar.** Plan the quarter — pick a start date, an interval and the
  centres — or add single visits. Planned supervision is surfaced in the notification
  centre as an upcoming live event, so no visit arrives unannounced. *Not visited*
  is still only ever confirmed by you, after the quarter closes.
- **Recommendations.** Each visit carries a short recommendation brief plus a check on
  the previous visit's recommendation (Yes / Partly / No and an evidence note). The
  first supervision says so plainly: there is nothing to follow up.
- **On duty now.** Night crew first, then the day shift, then authorised leave and
  people at home. Labels are plain — *On day duty*, *Coming for a night*,
  *On night duty* — with no shift clock, and a guessed day off from the contract
  pattern is no longer reported as "at home".

---

## What changed in 6.6

**Say only what the records say.** 6.6 removes the last places where the console
spoke for people or kept a register nobody asks for.

- **No cold chain.** The department does not log fridge temperatures here, so the
  cold-chain card, the temperature log modal, the excursion notification, the
  equipment trace chart and the stock "2–8 °C" pills are all gone, along with the
  cold-chain indicator in the PBF question bank. Specimen transport notes on a
  referral manifest are the only remaining mention.
- **PBF questions are yours.** Every question carries its own maximum — **25 marks by
  default**, editable — and the domain score is marks earned over marks available, so
  the percentage is computed, never typed. Questions can be deleted; deleted ones
  stop scoring immediately, keep their recorded marks for audit and can be restored.
- **Not yet visited is not missed.** Each quarter's visits now have a schedule. A
  centre whose visit is still ahead of it reads **not yet visited**; **not visited** is
  a separate statement you confirm, and can undo. Visits can be scheduled at any time
  during the open quarter, and recording a visit settles its slot automatically.
- **Result release is not a per-person switch.** Everyone authorises release. The one
  exception is a joiner still inside the 30-day orientation window, whose results are
  countersigned — shown on their card and once per page.
- **Workforce profile.** Age distribution, sex ratio, tenure (measured to the exit
  date or today) and a 12-month exit forecast, all read off birth dates, join dates
  and exit dates on the staff records. Exit date is now editable.
- **Referral network delete & restore.** Removing a laboratory warns when samples
  still name it, keeps those samples exactly as referred, files the laboratory under
  *Removed from the network*, and can put it back in one click.
- **Revenue reconciles.** KPI sparks and deltas are computed from the monthly ledger
  instead of being typed in, and a reconciliation strip states the expenses,
  reimbursements and net balance the rows add up to.
- **Thresholds are constants.** EQA/PT **95 %**, PBF **80 %** — declared once in the
  store (`S.EQA_MIN`, `S.PBF_MIN`) and used by every pill, band, meter and legend.
- **Dashboard has no dead space.** The Command Center is two independent columns, so
  a short card no longer leaves a block of white space under it; on a phone the
  columns dissolve into the original reading order.

---

## What changed in 6.5

**Truth before decoration.** A screen that shows a number the department never
recorded is worse than an empty one, so 6.5 deletes the invented data rather than
dressing it up.

- **Referrals only.** The sample register holds only what Ruli DH actually referred
  to **NRL, CHUK or Kibagabaga**. Synthetic telemetry samples from health centres are
  purged on first load (`meta.samplesPurgedV65`), and *registered vs resulted* counts
  referrals only.
- **TAT by receiving laboratory.** A new card shows, for the last 12 months, who we
  send to, how many came back, and each laboratory's TAT compliance against its own
  target — plus a per-month registered/resulted strip.
- **Stock is measured in days, not francs.** There is no money on the stock screen.
  Every line carries days of cover from the recorded issue log (30/90-day blend),
  a projected stock-out date and a consumption trend. Lines with no issues yet say so.
- **Consumables you can delete.** Invented reagent lines are gone
  (`meta.stockPurgedV65`), and every line has a delete button that soft-deletes it,
  logs the actor, and can be restored from *Archived lines*.
- **EQA replaces Levey–Jennings** on the Command Center: PT scores over time with an
  **All PTs** selector as the default, an 80 % band, and no invented composite score.
- **Leave vocabulary.** Never "absent" for a person. The forecast says *annual leave*,
  *authorised leave* or *unexcused absence* — the last only when a record exists. Shift
  times read 08:00–17:00 and 17:00–08:00 **the next day** everywhere.
- **Leave planning by fiscal year.** Add, edit and delete annual-leave plans per FY,
  with the contract's entitlement (statute 30 days / contractual 21 weekdays), taken,
  running, planned, balance and an overlap warning — last FY's plan can be entered
  this November, this FY's in March.
- **Who's off today** lists people on leave *and* people who are OFF or blank on the
  working plan.
- **Sheets fixed.** Weekly roster and working plan names are set two-line and larger
  (no more 6 pt names), the rostering exceptions are printed on the sheet, and the
  working plan no longer reports *"This panel could not render"* — the drawing is
  deferred and any failure stays inside the card.
- **Scrolling and Close.** Scroll locking is reference-counted, every modal binds its
  own Close handler, and a route change closes any open layer. JS/CSS are served
  network-first, with a *Force update* action in the account drawer.

---

## Run it

No build step, no dependencies, no CDN. Any static server works:

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

Deploying to GitHub Pages: push the repository and enable Pages on the branch —
`.nojekyll` is already present, so `assets/` is served as-is.

### Demo accounts

| Username | Password | Role |
| --- | --- | --- |
| `kelvin` | `ruli2026` | Admin — everything, including settings and security |
| `aurelie` | `lab2026` | Manager — approvals, revenue, roster |
| `jeanpaul` | `lab2026` | Technologist — register, results, stock (2FA: `123456`) |
| `viewer` | `view2026` | Read-only — PBF / district review |

---

## Architecture

```
index.html                 shell markup only (no inline logic)
assets/css/tokens.css      design tokens: colour ramps, type, spacing, elevation, themes
assets/css/app.css         shell + component layer
assets/css/modules.css    module-specific surfaces (roster grid, gantt, QC heat, PBF, DS)
assets/js/core/icons.js    182 Lucide paths, 1.5px stroke
assets/js/core/seed.js     the v5.3.1 register, carried forward (staff, referrals, leave, …)
assets/js/core/utils.js    DOM, dates, numbers, motion, files, print helpers  → LSU
assets/js/core/store.js    persistence, selectors, telemetry generators        → LS.store
assets/js/core/ui.js       cards, tables, drawers, modals, toasts, art        → LS.ui
assets/js/core/charts.js   SVG spark / line / bars / ring / LJ / dual / heat  → LS.charts
assets/js/core/i18n.js     EN · Kinyarwanda · French
assets/js/core/auth.js     roles, sessions, 2FA, login history
assets/js/core/shell.js    routes, nav, command palette, chrome, shortcuts
assets/js/core/boot.js     splash choreography, init order, recovery
assets/js/modules/*.js     15 lazily-loaded modules (one per route)
sw.js                      offline shell, stale-while-revalidate assets
manifest.json              installable PWA with shortcuts
```

Each module is a self-contained IIFE registered as `LS.modules.<id>` and exposes
`render(root, params)`; the shell code-splits them on first navigation and wraps the
call in an error boundary, so one bad module can never blank the console.

### Persistence

`localStorage['labSystems.v1']` is the source of truth — the same key the v5 register
used, so records carry forward with no migration step. Writes are debounced (220 ms),
mirrored across tabs with `BroadcastChannel`, and every mutation lands in an
append-only audit trail. Cloud sync is optional and off by default; see
**Staff & settings → Data & sync**.

### Data provenance

Staff, referred samples, leave, trainings, training revenue, equipment and suppliers
are the hospital's own register data. Throughput, QC runs, stock issue logs and TAT
telemetry are generated deterministically (seeded) so every screen has something
honest to render in a demo. Generated data never overwrites register records.

---

## Module map

| Group | Module | What it does |
| --- | --- | --- |
| Operations | Command Center | KPIs, 12-month throughput, Levey–Jennings QC, TAT bars, referral board, activity feed, shift-state duty list |
| Operations | Referred Samples | 3-step register wizard, barcode IDs, custody timeline, results with reference ranges, editable records, manifests |
| Operations | Stock & Supplies | Lots & expiry, burn-rate forecasts, cold chain, FIFO allocation, supplier scorecards |
| People | Training Roster | FIFO fairness queue, registry, certificates, history |
| People | Training Revenue | Expenses vs reimbursements with meal, housing and custom categories, cash-flow chart, printable statements |
| Scheduling | Working Plan | Staff × day grid, weekly service roster, drag-to-assign with collision checks, coverage, fairness, printable roster |
| Scheduling | Leave & Timeline | Requests with coverage conflict detection, FY Gantt, approval write-back to the roster |
| Quality | EQA / PT | Composite trend, z-scores, Westgard QC calendar, new round entry, CAPA |
| Quality | PBF Evaluation | Question-level marks, quarterly visit history per centre, six weighted domains |
| Quality | Quality & Compliance | ISO 15189 readiness, SOP control, non-conformances |
| Quality | Equipment | Uptime, full service history (back-dateable), equipment editor, cold-chain trace |
| Admin | Staff & Settings | Registry, roles, identity, TAT targets, data export/import |
| Admin | Security Center | Posture, sessions, 2FA, append-only audit, restore points |
| Admin | Design System | Live tokens, type, motion and components |
| Admin | Premium Roadmap | The 100 upgrades behind v6, with the copyable brief |

---

### Working-plan authority

Stored plans are register data. The console never fabricates a plan for a month that has
none: the month opens with an explicit empty state offering *generate draft*, *start blank*
or a jump to a stored month. Regenerating or replacing an existing plan first archives the
previous version under `workingPlans[month].versions`, and official plans (imported from a
signed roster) are flagged in the header before anything is overwritten.

### Shift states

One vocabulary — `S.shiftState(staff, iso)` — drives the dashboard, roster and staff cards:
day, night, day + night, leave, training, off duty, and *exited*. Exited staff are excluded
from on-duty lists by construction; off-duty, day and night never share a colour.

## Keyboard

`⌘K` / `Ctrl K` palette · `/` focus search · `N` new sample · `G` then `D/S/R/Q/L/T/E/P` jump ·
`T` theme · `[` density · `?` shortcuts · `Esc` close layer.

## Print and export

Roster, manifests, leave register, PBF scorecards and revenue statements print to A4
(roster and district report in landscape) with letterhead drawn from **Settings**.

### Shift times and what "off" means

One vocabulary across the dashboard, roster and staff cards:

| Code | Meaning |
|---|---|
| **D** | On duty · day **08:00–17:00** |
| **N** | On duty · night **17:00–08:00** (next day) |
| **DN** | Day + night |
| **OFF** | **At home** — not on leave, not on shift |
| AL / SL / CL / ML | Approved leave, printed over the plan |

### Reserves and bench rules

- The Laboratory Manager is **not** rostered while the bench is covered. A manager
  shift is drafted only on a weekday that would otherwise have **two people or fewer**
  on day shift.
- Bench preferences drive auto-allocation: Beatrice NGEZEKURE works **Reception**, and
  **Parasitology** only when the bench is empty and only up to **two days a month**
  (`homeBench`, `altBench`, `altMaxMonth`, `avoidBench` on the staff record).

### Leave — real records only

No request is ever seeded: an empty inbox says so. Requests are entered by the
manager and decided **in the week before the leave starts**; each request shows that
window. Approving leave **never rewrites the working plan** — the approval is an
overlay, drawn on screen and on the printed sheet, and the stored plan stays exactly
as signed.

Entitlement follows the contract: **under statute — 30 calendar days** a year,
**contractual — 21 working days** (Mon–Fri). Each post records its **sponsor**
(Government of Rwanda, Global Fund, own revenue, MoH/RBC, partner). The absence
forecast is computed from the register's own history — the leave/absence rate across
every stored month and every recorded leave block — and says how many months it saw.

### EQA / PT — record now, results later

A round is stored the day the panel is tested and sent off: material date, submission
date, and the analytes that scheme has used before (**pre-filled, extensible, never
asked for twice**). Results are added later on the same record, so the console can
measure **dispatch → report** turnaround per round and per scheme, count rounds still
awaiting a report, and flag the ones running past 30 days. The scorecard is grouped by
scheme, newest round first, with one column per analyte that scheme has ever reported.

### Equipment — preventive **and** curative maintenance

The equipment register covers the whole maintenance cycle, not only the manufacturer's
preventive schedule:

| Capability | Where |
|---|---|
| Preventive plan (PM, calibration, next due) | *Preventive plan* tab |
| Curative log — breakdowns, supplier call-outs, off-site repair | *Curative & downtime* tab |
| **Previous maintenance history** — back-fill many past visits in one dialog | *Previous history* button (page, plan tab or the asset drawer) |
| Supplier **response speed** — email time → intervention time, mean / median / fastest / slowest | KPI card + per-asset figures |
| **Off-site repair** — shipment date and the backup analyser handed over | recorded on the case; the backup pool updates itself |
| **Downtime** — counts from the shipment date and keeps accruing until *Mark returned* | fleet cards, inventory tab, drawer |

A curative case captures when the supplier was emailed and when they actually intervened;
the response time is calculated and rolled into the supplier-response KPI (both for new
records and for back-filled history). When an analyser cannot be repaired on site, the
shipment date and the backup analyser are recorded — the backup is marked *deployed* in
the backup inventory and released when the analyser is marked returned. A shipped-out
analyser **stays in the downtime calculation** for the whole period it is away, and the
return itself is recorded so the ledger closes on a real date.

Back-dated events are additive: they never move the next-PM date backwards, and no
maintenance record is ever fabricated — an empty log shows an honest empty state.

### Referral network & training

Partner laboratories are editable — renaming one fixes the spelling everywhere and
re-points every sample that names it. In the training queue, a staff member who has
never trained waits **from their first day of employment** (treated as their training
day), so new joiners queue behind colleagues who have been waiting longer.
**Training by year** is the landing chart; money figures sit on a full-width chart.

### Working plan & weekly roster sheets

The roster module ships two document sheets that reproduce the signed registers — the
monthly **Working Plan** and the **Weekly Unit Roster**. Both are generated as one SVG
in `assets/js/core/sheets.js`, so every output is the same document:

| Output | How | Quality |
|---|---|---|
| **PNG** | SVG → canvas at ~430 dpi | crisp at A4, small file · also a one-click button on the weekly roster |
| **PDF** | SVG → canvas → single JPEG page, 842 × 595 pt | one A4 landscape page, ~430 dpi |
| **XLSX** | hand-written OOXML, landscape, fit-to-page, frozen headers | editable, prints on one page |
| **Print** | same SVG in a print window | vector, fonts fall back to system |

Exports are one file per sheet (`working-plan-october-2026.png`, `unit-roster-2026-10-19.pdf`,
…), and the monthly sheet carries **no** running footer — the only text on the page is the
register itself. The raster path is capped at 15 Mpx / 8192 px per side — the iOS-Safari canvas ceiling —
so a phone can export the same sheet as a desktop without a blank image. No CDN, no
library: the SVG builder, the PNG/PDF encoder and the ZIP/OOXML writer are all local.

The October 2026 plan is stored as **official** register data (transcribed from the signed
sheet, 30 Sep – 6 Nov, 7 staff), with Bernadette MUHAWENIMANA and Marie Claudine
UWAYISABA added to the register. Official plans are never overwritten by the generator:
regeneration archives the current version first.
