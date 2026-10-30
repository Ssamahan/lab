# Lab Systems — Ruli District Hospital

The laboratory operating console for **Ruli District Hospital, Laboratory Department**
(Gakenke District, Rwanda): referred samples and chain of custody, commodity security,
rosters and leave, EQA and ISO 15189 quality, equipment, PBF evaluation, training revenue.
Offline-first — it installs as a PWA and works with no network.

**Version 6.9.76** · FY 2026/2027 · no build step, no dependencies, no CDN.

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

## Identifiers

```
sample     R + <test code> + MMYY + 4 digits      RBC10260001
manifest   <test code> + YYMMDD + 4 alphanumerics BC261027A001
```

The code comes from the chosen test, the date from the day, the number from a per-code, per-month
counter. The manifest tail is alphanumeric (`A001`, `A00A`, `A011`) and counts up with
`meta.manifestSerial`. **Ruli DH** is the sending laboratory and the default origin on an order. `S.testCode`, `S.sampleId`/`S.takeSampleId` and `S.manifestId`/`S.takeManifestId` are the
only places that build an ID, and a number is taken inside the commit that stores the record.

## Blood culture

Choosing **Blood Culture** adds **Cytology** and **Gram Stain** to the order automatically — they are
performed as routine on the same specimen. Dropping the culture drops the pair. The manifest lists
them first: `Cytology · Gram Stain · Blood Culture`; the sample ID still comes from the culture
(`RBC…`).

## Manifests

**Referred samples → Manifests** lists every manifest ever generated on this device and in the
shared copy, newest first: the ID, the receiving laboratory, how many samples are on it, the tests
and the day it was made. Each card opens **View** (the printed sheet, both coats over a gold rule,
the ID above its barcode drawn in SVG so it survives the printer, one row per sample, and the
generator, courier and receiver on one signature line),
**Print / PDF**, or **Delete**
— deleting a manifest leaves its samples in the register. The tab carries its own address,
`#/samples?tab=manifests`, and `#/samples?manifest=1` opens the generator.

**Print / PDF prints the sheet you are looking at** — the very node on screen, not a second copy
built somewhere else. On a phone, where a browser may print the page instead of a hidden frame, the
console's print stylesheet hides everything except the open sheet, so the button, the browser menu
and Ctrl+P all give the same page. Module URLs carry the app version (`samples.js?v=6.9.76`), so a
cached module can never survive a deploy and print an old layout.

Duplicates are removable: tick the orders, then **Delete selected** sits beside **Clear** in the
selection bar (Admin only). The confirmation names the IDs, warns when one is on a manifest, unlinks
it from that manifest, writes an audit entry, and the toast offers **Undo**.

## Patient identity

`U.ptName(record)` answers with the recorded name to **anyone signed in** — every staff role records
it on the order and reads it in the register, the drawer, the manifest and the exports. The word
`Confidential` is reserved for the **public visitor**, the read-only session opened from the landing
without an account; a signed-in user never meets it. Where a record holds no name (the 6.9.30 mask
erased what was there), staff see **—** and the record offers **Record a name**, which writes it back
on the order in place. **Age is calculated** from a date of birth (`LSU.ageFromDob`), never typed
while a date is present.

## Seeing the same register on the phone

The register is one list: **every order of every month is drawn, newest first** — no page size, no
"load more" holding the older work back. The referral samples header carries a **freshness chip**
(`Updated 4 minutes ago`); pressing it pulls the shared copy and repaints, and the local copy is kept
as a restore point first. A device that has been asleep catches up when the screen opens or becomes
visible, and a cloud change repaints the screen by itself — including on a visitor session, which now
keeps polling the shared copy instead of showing the snapshot it read when it entered.

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
- **One name a night, two or three nights in a row.** A single night is never handed out and
  a fourth never happens; a three-night block only goes to somebody whose own ceiling allows
  it, and the rotation shares it out. The nights are shared by Dieudonné, Bernadette and
  Jeanne Claudine; whoever is **acting for the manager takes none**, and Beatrice stays on days.
- **RBW is Rest Before Work, and it has one cause.** When nobody covers the weekend, the
  person who carries both weekend nights rests on the **Friday before** it, so the Tuesday
  after is worked — Monday to Wednesday keep the whole bench. It is never a mechanical second
  day off after a block of nights.
- **The weekend carries one on the days and one on the nights** — and only the weekend
  technologist ever works day + night. Every other weekend cell is blank.
- **A cell can be left blank on purpose.** The shift picker's blank tile clears a cell back to
  "at home, nothing written" — the way to take a name off a weekend without inventing an OFF.
- **UO is an unattended off**: a rest day that was worked. It is entered by hand, is neither
  leave nor an absence, and names a day the department owes back.
- **Each month takes its first week over from the month before** and runs a week past its
  own end, so the plan is written ahead of the monthly reports.
- **A public holiday is rostered as a weekend** — one on the days, one on the nights, the
  duty alternating so it is shared fairly, and every other cell blank. The manager is never
  put on a holiday unless he has chosen to work them.
- **A carry-over is only counted when the year it came from was recorded.** Silence in a
  previous fiscal year is not thirty unused days. A block can name the year it is charged to:
  the manager's thirty days run from 16 November 2026 and are charged back to FY 2025/2026.
- **The working plan reads the annual-leave plan.** Leave blocks are painted on the cells
  they cover, and *Fill the leaves* writes the whole register onto the month on request.
- **A newcomer works dayshifts for their first thirty days.** The joining date and the end of
  induction live on the record, so the rule holds for whoever joins next: dayshifts on weekdays,
  no weekend and no night until the month of induction is over. The days **before** somebody's
  first day are hatched, never blank — a blank cell means at home, and it must not also mean
  *not yet employed*.
- **The exports read like the departmental letterhead.** Ministry of Health above Ruli District
  Hospital on the working plan, the weekly roster and the XLSX; every name whole on one line
  with the post beneath it, never wrapped into it; and the phone number on the same line as the
  name, at a size that reads on paper. Posts are written as the department writes them — Lab
  Technician, Lab Technologist, Lab Quality Manager, Lab Safety Officer.
- **One month, one row per person.** A plan holds one row per member of staff and one column
  per day; a stored plan that has been duplicated is repaired on load, keeping the row that is
  in force, and the grid never draws a name twice.
- **The roster is read in one order**: Kelvin, Jean Paul, Dieudonné, Beatrice, Patrick,
  Bernadette, Jeanne Claudine, Aurelie last. A new name joins at the end of the bench.
- **The service requisition sits against the name that signs it** — the Monday request for
  the week's lab commodities from the main pharmacy. It moves to the acting manager while the
  manager is on leave, on the screen and on the printed sheet.
- **An off-site repair starts with the day it left.** Setting an analyser to *Off-site repair*
  asks for the shipment date (and a backup, if one is free); leaving that status asks for the
  return date. The difference is the repair time, printed on the fleet card, the ledger, the
  asset history and the export.
- **Names are Rwandan names.** Given name(s) first, family name last, and the given name is
  one unit: “Jean Paul” is never split into a first name “Jean” and a middle name “Paul”.
  The roster, the plan sheet and the avatars all read it that way.
- **A blank cell means at home.** A day the working plan leaves empty is a decision, not a
  gap: that person is not on duty, is not in the day-cover count and is not in "on duty now".
  The contract pattern only speaks when no plan covers the day.
- **A phone keeps the screen.** The bottom bar is symbols only — no titles under them — it
  slides away as the page goes down and returns on the first upward flick, and the arrow in
  it lifts the whole module list. There is no hamburger in the corner.
- **PBF prints the scorecard the register holds.** A centre shows its recorded domain
  percentages and index while its question marks are still to be entered; nothing is marked
  on its behalf, and a quarter nobody recorded stays a gap, never a zero.
- **The plan book is a record, not a rota**: somebody who left during the year keeps their
  row while leave is charged to that year (Diane's thirty days of 2026/27 ended with her
  leaving on 12 August), marked with the day they left.
- **Leave is listed in turn order** — on leave now, then the next to go — and every block
  says what happened to it: *On leave*, *Attended*, *Attended 1st installment*, *Attended a
  carry-over of 2025/26*.
- **Cards fill the row they are in and tables stop at the fold.** No card is left holding a
  blank block under a short neighbour, and the dashboard re-packs when the rail or a module
  changes the width of its column.
- **PBF evaluates health centres, never the hospital laboratory.** Ruli DH is the assessor;
  it does not appear in the index, the scorecards, the calendar or the visit form.
- **A post is held by name.** The laboratory manager, laboratory quality manager (Jean) and
  laboratory safety officer (Dieudonné) go when training is aimed at their post; they never
  wait in the FIFO queue for it.
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
