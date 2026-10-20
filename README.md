# Lab Systems — Ruli District Hospital

The laboratory operating console for **Ruli District Hospital, Laboratory Department**
(Gakenke District, Rwanda). Referred samples, chain of custody, commodity security,
rosters and leave, EQA and ISO 15189 quality, equipment, PBF evaluation and training
revenue — in one offline-first workspace.

**Version 6.0.0** · FY 2026/2027 · works with no network, installs as a PWA.

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
| Operations | Command Center | KPIs, 14-day throughput, Levey–Jennings QC, TAT bars, referral board, activity feed, on-duty strip |
| Operations | Referred Samples | 3-step register wizard, barcode IDs, custody timeline, results with reference ranges, manifests |
| Operations | Stock & Supplies | Lots & expiry, burn-rate forecasts, cold chain, FIFO allocation, supplier scorecards |
| People | Training Roster | FIFO fairness queue, registry, certificates, history |
| People | Training Revenue | Expenses vs reimbursements, cash-flow chart, printable statements |
| Scheduling | Working Plan | Staff × day grid, drag-to-assign with collision checks, coverage, fairness, printable roster |
| Scheduling | Leave & Timeline | Requests with coverage conflict detection, FY Gantt, approval write-back to the roster |
| Quality | EQA / PT | Composite trend, z-scores, Westgard QC calendar, CAPA |
| Quality | PBF Evaluation | Health-centre indices across six weighted domains |
| Quality | Quality & Compliance | ISO 15189 readiness, SOP control, non-conformances |
| Quality | Equipment | Uptime, preventive maintenance clock, cold-chain trace |
| Admin | Staff & Settings | Registry, roles, identity, TAT targets, data export/import |
| Admin | Security Center | Posture, sessions, 2FA, append-only audit, restore points |
| Admin | Design System | Live tokens, type, motion and components |
| Admin | Premium Roadmap | The 100 upgrades behind v6, with the copyable brief |

---

## Keyboard

`⌘K` / `Ctrl K` palette · `/` focus search · `N` new sample · `G` then `D/S/R/Q/L/T/E/P` jump ·
`T` theme · `[` density · `?` shortcuts · `Esc` close layer.

## Print

Roster, manifests, leave register, PBF scorecards and revenue statements print to A4
(roster and district report in landscape) with letterhead drawn from **Settings**.
