# Lab Systems — Ruli District Hospital

The laboratory operating console for **Ruli District Hospital, Laboratory Department**
(Gakenke District, Rwanda). Referred samples, chain of custody, commodity security,
rosters and leave, EQA and ISO 15189 quality, equipment, PBF evaluation and training
revenue — in one offline-first workspace.

**Version 6.3.0** · FY 2026/2027 · works with no network, installs as a PWA.

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
