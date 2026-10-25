# Lab Systems — Ruli District Hospital

The laboratory operating console for **Ruli District Hospital, Laboratory Department**
(Gakenke District, Rwanda): referred samples and chain of custody, commodity security,
rosters and leave, EQA and ISO 15189 quality, equipment, PBF evaluation, training revenue.
Offline-first — it installs as a PWA and works with no network.

**Version 6.9.29** · FY 2026/2027 · no build step, no dependencies, no CDN.

---

## Run it

```bash
python3 -m http.server 8000     # open http://localhost:8000
```

Any static host works. For GitHub Pages, push the branch and enable Pages — `.nojekyll`
is already present so `assets/` is served as-is. Deployment and Android packaging are in
[DEPLOY_GUIDE.md](DEPLOY_GUIDE.md) and [APK_GUIDE.md](APK_GUIDE.md).

## Sign in

The app opens on a **public overview** — no password needed to read what the department does, and
one button opens the register itself as a read-only visitor.
The console's sign-in screen is not linked from it: **five clicks on the crest** or **three
clicks on the profile button** opens it, as does `#/signin` in the address bar. Signing out
returns to the overview, and a bookmarked console link still asks for the password.

Accounts are issued and reset by the administrator in **Security Center**. Nothing about
an account — username, password, one-time code — is written in this repository, in the
page source, or in the documentation.

| Role | May do |
| --- | --- |
| Admin | everything, including settings and security |
| Manager | approvals, revenue, roster |
| Technologist | register, results, stock |
| Reviewer | read the register, sign off assessments |
| Viewer | read-only, PBF and district review |

**A visitor needs no account.** The overview's *Open the register as a visitor* button — or a
single tap on the profile, while three taps open the staff sign-in — enters
the console as a Viewer: every operational module plus the staff register, with export and
download, and three surfaces closed — **Training Revenue**, **Settings** and **Data & sync**.
Writes are refused in the store itself, not only in the interface, and the session ends with
the tab.

A visitor reads the **shared register** through the public coordinates in
`assets/js/core/shared.js` (address + publishable key, pull-only, never a write) — so a private
window shows the real samples, rosters and PBF marks rather than the sample copy. Empty
`endpoint` there to switch that off. While Supabase anonymous sign-ins are on, that key also lets
anyone holding it read the register directly; see *Security, stated plainly*.

Passwords are stored as **SHA-256 hashes**; the sign-in form starts empty. If every
manager account is lost, clear this site's browser data (`Settings → Data → reset to seed`)
— the seeded manager account returns, and its password should be changed immediately in
Security Center.

## Cloud sync (optional, off by default)

One register shared between the phone and the PC, live: a change leaves a device in about
a second and appears on the other within three. Setup is a Supabase project plus four
values in **Staff & settings → Data → Cloud sync**:
[the step-by-step guide](docs/supabase-setup.html) · [server notes](supabase/README.md).

**No keys belong in this repository.** The project URL, the API key and the login live in
each device's `localStorage`; the app refuses the `sb_secret_…` key outright, because it
bypasses row-level security.

### A second browser

A private window or a new PC starts from the built-in sample register: it has its own
`localStorage` and no knowledge of your project. **Settings → Data & sync → Two browsers, one
register** compares both copies (samples, staff, PBF visits, PBF marks), **Push everything now**
publishes the whole register, **Download the shared copy** brings the cloud version down behind a
restore point, and **Copy / Paste setup code** carries the address and publishable key to the other
browser as text — never a password. A browser that has never received the shared register cannot
publish its seed over it: the background loop refuses and says so.

## Security, stated plainly

- This is a **browser-only console**: the register lives in the device's `localStorage`.
  Password hashing keeps credentials out of the source; it is not server-side identity.
  Anyone with access to the device and its developer tools can read that register.
- The seeded **2FA code is a local placeholder**, not a real second factor, until a real
  OTP provider is wired in.
- Anonymous Supabase sessions make sync work quickly, but the publishable key is public by
  design: while *Allow anonymous sign-ins* is on, anyone holding the key could read the
  register. **Check setup** warns about it; the guide's Part 8 closes it.
- Rotate any password that has ever been committed, screenshotted or shared in chat. Git
  history is permanent; changing the password in Security Center is the fix, not deleting
  the line.

## Modules

| Group | Modules |
| --- | --- |
| Operations | Command Center · Referred Samples · Stock & Supplies |
| People | Training Roster · Training Revenue |
| Scheduling | Working Plan (grid, weekly roster, posts by head-count, nights) · Leave & Timeline |
| Quality | EQA / PT · PBF Evaluation · Quality & Compliance · Equipment |
| Admin | Staff & Settings · Security Center · Design System · Premium Roadmap |

Full behaviour notes — shift codes, reserves and bench rules, leave, EQA, equipment — are
in the app itself and in the sections below.

## Layout

```
index.html                 shell markup only: boot, public overview, sign-in, console
assets/css/                tokens · app · modules · landing
assets/js/core/            icons, seed, utils (LSU), store, ui, charts, sheets, i18n,
                           auth, landing (public overview), shell, sync, boot
assets/js/modules/*.js     15 lazily loaded modules, one per route
sw.js, manifest.json       offline shell and installable PWA
supabase/                  schema.sql + server notes
docs/supabase-setup.html   the ten-year-old-proof setup guide
CHANGELOG.md               what changed in every version, newest first
```

Each module is a self-contained IIFE registered as `LS.modules.<id>` and exposes
`render(root, params)`; the shell code-splits on first navigation inside an error
boundary, so one failing module cannot blank the console.

`localStorage['labSystems.v1']` is the source of truth — the same key the v5 register used,
so records carried forward with no migration step. Writes are debounced, mirrored across
tabs, and every mutation lands in an append-only audit trail.

Staff, referred samples, leave, trainings, training revenue, equipment and suppliers are
the hospital's own register data. Operational telemetry (throughput, QC runs, stock issues,
TAT) is deterministically generated and labelled as such; generated data never overwrites
register records.

## Behaviour that must not regress

- **A night is a whole shift.** Anyone on nights that day is off the day roster, is never
  given a bench post, and is not counted in the head-count.
- **Posts follow the head-count** (excluding the manager): ≥6 → six posts; 5 → Phlebotomy +
  Haematology as one post; 4 → Biochemistry + Serology also merge; 3 → Reception joins
  Parasitology + TB; ≤2 → the manager takes Biochemistry + Serology.
- **Beatrice takes Reception** whenever a Reception post is open; never Biochemistry or
  Serology; Phlebotomy only alone or by manual override.
- **New staff rotate for thirty days**: W1 phlebotomy ×3 then reception ×2, W2 Haematology /
  Parasitology / TB, W3 Biochemistry / Serology, W4 a full member of staff, with the
  assessment on a Wednesday or Thursday before day 30.
- **Manual override always wins**, and every automatic change is written to the audit trail.
- **Nothing is invented.** History, EQA scores and PBF indices derive only from recorded
  records; a month without a working plan stays empty until someone creates one.

## Keyboard, print, export

`⌘/Ctrl-K` command palette · `?` shortcuts · `⌘/Ctrl-P` prints the current surface.
Every chart and table card has a download that contains the real chart (SVG or PNG),
and the working plan exports a printable sheet plus XLSX.

## Changelog

Every version, with the reason for each change, is in [CHANGELOG.md](CHANGELOG.md).
