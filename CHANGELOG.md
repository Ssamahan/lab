# Changelog — Lab Systems

Newest first. Each entry says what changed and why, so a version can be justified later.

---

## What changed in 6.9.100

**When it will not open at all, there is now a way in — and the register is never the price.**

A report came back as a single line: *"Not even loading at all."* I checked the deployment
first — the live site answered with the v6.9.99 build and its scripts — so the problem was on
the device, and the device had no way out. Three of them are now built.

### `reset.html` — a repair page that depends on nothing
`https://ssamahan.github.io/lab/reset.html` is a single file with **no stylesheet, no script,
no font, no service worker** in it. It cannot be broken by anything the console stores.

- It **unregisters the service worker** and **empties every cache** on the origin.
- It **asks the site for `index.html` and for the console's own script**, and reports the
  status, the bytes, the build and how long it took.
- It **reads the register from local storage** — parses it, counts the orders, the months, the
  staff, the audit entries — and offers it **as a file**. If it will not parse, it says so and
  still saves the bytes.
- It never writes and never deletes the register. It says so on the page, in those words.
- Every step is a tick or a cross, so a screenshot is enough to diagnose it from a distance.

### A navigation can no longer end in a blank error page
The service worker answered a failed navigation with `Response.error()`, which is the browser's
own *"this site can't be reached"* — indistinguishable from the site having gone away. It now
looks for the shell in **every** cache, and if there is none, writes out a small self-contained
page with the repair link. `reset.html` is precached, so the repair page is available offline too.

### A register that will not parse is kept, not overwritten
The store used to lay the seed over an unreadable register with a line in the console — a silent
loss of a laboratory's records. Now the raw text is copied to `labSystems.v1.unreadable.<time>`
**before** anything else happens, whether it failed to parse or failed to migrate, the console
starts on a fresh register, and a warning names the reason, the size and the key, with the copy
kept until somebody acknowledges it.

### Smaller doors, all open
- The inline failsafe in `index.html` fires at **six seconds** instead of ten and offers both
  **Repair this device** and **Clear cache & reload**.
- `?fresh=1` **always reloads**, even if a cache delete hangs (1.6 s at the most).
- The boot-failure card offers **Save the register as a file**, then **Repair this device**, and
  only then — behind a confirmation — a fresh register.
- The seven-second watchdog card carries the repair link as well.

`npm test` now covers **40 suites and 1,964 checks**, including 37 in `harness/recover100.js`
that drive a corrupt register through a real boot and check the text survives byte for byte.

---

## What changed in 6.9.99

**A screen that does not arrive now says why — and offers the one action that fixes it.**

A report came back from a real device:

> Lab Systems **v6.9.88** · route: dash · *Module took longer than 25 seconds to render.*

Two separate things were wrong in that line.

### The tab was ten builds behind the site, and nothing said so
v6.9.88 was live in September. A tab left open since then keeps running the JavaScript it
loaded; the browser was holding an old copy of the console while the site had moved on. The
failure panel never mentioned it, so the message read like a bug in the dashboard.

- The panel now **asks the deployed page for its build** and, when the two disagree, says it in
  numbers: *"This tab is running v6.9.88; the site is now v6.9.99."* It names that as the
  usual cause of a screen not arriving.
- It carries a **Clear cache & reload** button, written as a plain address (`?fresh=1`) so it
  still works when the thing that failed to load is the script that would have drawn it.
- It says what clearing does **not** touch: nothing stored on the device is deleted.

### A script that never answers used to hang the screen
A `<script>` can fail by firing `error` — or by firing nothing at all: a service worker
holding a request, a connection that dies mid-download, a file that is no longer where the
address says. Only the first was handled, so the second sat on a skeleton until the 25-second
watchdog gave up.

- The three deferred helpers have a **ten-second deadline**; a module has **fifteen**.
- A module that does not arrive is asked for **once more, past the cache** (a different search
  string is a different URL to the worker), which fixes most stale copies without anyone
  needing to know that a service worker exists.
- The failure is named by kind: *"This screen did not arrive"* rather than *"could not
  render"*, because they are different problems with different cures.

### A skeleton with nothing under it says what it is waiting for
After **six seconds** a note appears above the skeleton — *still loading this screen* — with the
same clear-and-reload action, and it disappears the moment the screen renders. A panel that
looks like it is working while nothing is happening is the worst of both.

`npm test` now covers **39 suites and 1,927 checks**, including 29 in `harness/load99.js`.

---

## What changed in 6.9.98

**The page opens first; the printer, the spreadsheet and the second download come after.**

"It takes longer to load, and I am not sure the landing page will open at all" is not an
impression to be argued with — it was three separate costs, and all three were real.

### The overview no longer waits for what it does not use
The public page is words, counts and two fonts. It was being made to download and parse
**116 KB of JavaScript** first: the chart helper (23 KB), the sheet engine (93 KB, the second
largest file in the build) and the workbook reader. All three are for printing a roster or
importing a district return — neither of which exists on the overview.

- They are **no longer in `index.html`**. The shell fetches them, at the same version, in
  order, the first time a screen asks for them, and never again after that.
- Every one of the sixteen screens still works: the smoke run opens all of them, and the
  monthly sheet still draws.

### The service worker stopped downloading everything twice
- The install step cached all **fifty-six** files with `cache: 'reload'`, which ignores the
  copy the page had downloaded moments earlier — on a phone, **the whole bundle came down
  twice, on every release**. It now caches the shell only, from the browser's own copy.
- The sixteen screens are warmed **twelve seconds after activation**, four at a time, when
  nobody is waiting for them.
- Every versioned asset was also **re-requested in the background on every visit** — forty
  requests for files that carry the build version in their address and therefore cannot
  change. A cache hit is now final. That alone stops a phone from spending its connection
  on redundant traffic while a page is being drawn.

### A slow start now says so, with numbers
When the start passes **2.6 seconds**, a small line appears in the corner — *started in
3.4 s · 612 KB · 41 files* — with **details** listing each part of the start. It blocks
nothing, it is dismissible, and `?diag=1` shows it always. A measured claim is fixable; a
report of "slow" is not.

### Fixed while explaining it: an anonymous account was on the allowlist
The allowlist was first filled from every row of `auth.users`, which included the two
**anonymous accounts** the visitor view signs in with. An account with no email has no person
behind it and no password to prove one with, so neither belonged on a list that opens patient
names. Both rows are gone, and a trigger (`lab_staff_guard`) now **refuses an account with no
email or an anonymous one**, and fills in the email so nobody has to paste a UUID.

### If the page still does not open
That is a browser holding a half-written build, and it has its own answer: **add `?fresh=1`**
to the address — `https://ssamahan.github.io/lab/?fresh=1`. It removes the service worker and
every cache on that origin once, then reloads clean. The register stored on the device is
untouched. The same button appears by itself if the console has not started after seven
seconds.

`npm test` now covers **38 suites and 1,898 checks**, including 32 new ones in
`harness/load98.js` that pin the deferral, the single download and the timing readout.

---

## What changed in 6.9.97

**Patient names reach the cloud — but only through a door staff open themselves.**

6.9.96 kept names in a vault on each device, which meant a name typed at the bench did not follow you to the phone,
and a second device started empty. That was the right trade at the time — the register syncs as one document that
anyone holding the publishable key can read, so a name inside it would have been public. The answer is not to hide
names forever; it is to keep them in a table that has no public door at all.

### A locked table, not a shared blob
- **`lab_patient_names`** holds *one row per order*: `sample_id`, `name`, `updated_at`, `updated_by`. Row-level
  security is on, every policy requires `lab_is_staff()`, and the `anon` role has **no grant and no policy** — a
  fetch with the publishable key alone returns nothing, not even an empty list with a hint.
- **`lab_staff`** is the allowlist: one row per person, keyed by their Supabase `auth.users.id`, with a `role`.
  Being able to sign in is *not* enough. If your account is not on the list, the table stays shut.
- **`lab_is_staff()`** is a `SECURITY DEFINER` helper the policies call, so the check cannot be spoofed by a client.
- The migration and the admin steps are in `supabase/schema.sql`.

### Behind the same password the names already asked for
- The **Show patient names** dialog is unchanged in spirit: your own username, your own password, fifteen minutes,
  every opening audited. It has one extra field — **cloud account email** — shown only when a backend is
  configured, prefilled from the signed-in user.
- The same password is tried against **Supabase Auth** (`grant_type=password`). Success stores a session
  (`labSystems.authsession.v1`, access + refresh token) and the names kept online come down.
- **Newer name wins.** A local name recorded at 09:12 beats a cloud copy from yesterday; a name edited on the phone
  wins when it is pulled. Nothing is silently overwritten or deleted.
- **Recording a name pushes it immediately** (upsert on `sample_id`), so the next device that unlocks sees it.
- **The cloud failing never blocks the device.** If the network is down, the password is only local, or the
  account is not on the allowlist, names still open locally and the toast says exactly what went wrong:
  *"Names shown on this device — the cloud did not answer: this account is not on the staff allowlist."*

### What did not change
- The register still writes `Confidential`, and the `meta.patientNamesMasked` migration still wipes any name that
  older builds left in the document. **No patient name is in the synced register or in any export.**
- Only **Admin, Manager, Technologist** see the control; Reviewer, Viewer and visitors never do.
- `npm test` now covers 37 suites and **1,866 checks**, including 48 new ones that mock a cloud which refuses reads
  without a staff session.

---

## What changed in 6.9.96

**Patient names, behind a password — and a training session that records every line.**

### Names are kept apart from the register
The sample table has a **Patient name** column. It is not filled from the register, because the register is one
document that travels to the cloud and back; a name kept in it would be readable by anyone holding the publishable
key. Names live in their own store on the device (`labSystems.names.v1`), keyed by order, and **never enter the
document that syncs or any export**.

- **A visitor sees only the word Confidential**, and no control — nothing to press, nothing to suggest there is
  something to open.
- **Signed-in bench staff** (Admin, Manager, Technologist) see `•••• hidden` and a **Show names** button.
- Pressing it asks for **their own username and password** — the same hash the login screen checks, verified
  without touching the session. A session left open on a bench PC is not, on its own, permission to read who a
  specimen belongs to.
- It opens **for fifteen minutes**, closes with **Hide names**, and closes when the tab is closed.
- **Every opening is written to the audit trail**: *"Patient names shown to Kelvin SAMAHANI (Admin) for fifteen
  minutes"* — which is what an inspector asks a laboratory to be able to produce.
- Recording a name (from the table, the drawer or the registration form) writes to the vault, and the register
  keeps `Confidential`.

### Training revenue: as many lines as the session had
Logging a session used to take one expense and one reimbursement. It now takes a list of each:

- **Expenses** — amount, category (with *Other*), **the date it was paid**, and a description per line.
- **Reimbursements** — amount, **the date it arrived**, the source, and a note for the instalment.
- **Add** and **remove** lines freely; a running total shows expenses, reimbursed and net before anything is
  saved, and each line keeps its own date. A wrong instalment is now a line to remove, not a session to redo.

Verified — **36 suites, 1,915 checks** — including the name vault staying out of the register, the mask for
visitors, the password check, the fifteen-minute window, the audit line, a Viewer and Technologist role check,
and two expenses plus two reimbursements saved with four distinct dates.

## What changed in 6.9.95

**It opens quickly now, and it does not freeze while it does.**

Three things were making every start slow, and none of them was the register itself — the start-up work measured **7 ms**.

- **The code was re-downloaded on every visit.** The service worker treated JavaScript and CSS as network-first *even when the cache held the same build*, so fifteen files had to come back over the network before the console could appear. Every asset is now asked for at the build's own version (`store.js?v=6.9.95`), and a versioned file is served from the cache at once — the fetch behind it only keeps the cache warm. A deploy still lands immediately, because `index.html` is fetched network-first and carries the new version with it.
- **The splash was a toll gate.** 2.1 seconds on *every* visit. It is now a first-run animation; a device that has opened the console before shows it for a moment and moves on.
- **Every start rewrote the whole register** to storage and broadcast the write, waking every other open tab to read and re-parse it too. The register is now written back only when the repair actually changed something.
- **The cache filled fifty files at once**, saturating a phone's connection while the page was still loading. Six at a time now.
- **The first exchange with the cloud waits for an idle device** (`requestIdleCallback`), so a pull never lands in the middle of the first screen being drawn.

**Measuring instead of guessing:** the start is timed part by part (`register loaded`, `language`, `accounts`), printed to the console when the address carries `?diag=1`, and shown in **Settings → Data → Cloud sync → Last start**.

Verified — **35 suites, 1,832 checks** — including every asset carrying the version, the worker's cache-first rule for versioned code and network-first for everything else, the splash on a returning device, no write to storage on an unchanged restart, and the timing report.

## What changed in 6.9.94

**The money is shown as money, and a session now has an average.**

- **The four cards were divided by a thousand.** Reimbursed, expenses, net and pending read `806 k RWF`,
  `150 k RWF`, `656 k RWF` — which reads as *806 shillings*, and rounds away the part that matters. They now
  show the figures themselves: **805,952 RWF**, **150,200 RWF**, **655,752 RWF**, each with the average per
  session in its note. The cash-flow chart keeps its `k` axis ticks, because a chart legend is not a total.
- **Average per session**, on a card of its own: reimbursed, expenses and net, each divided by the sessions
  actually on the ledger, with the recovery rate (*reimbursed ÷ expenses*).
- **Trend change**: the last three sessions against the ones before them — the average reimbursed and the
  average expense, each with the percentage change and the figure it moved from. It compares the *average per
  session*, not the month total, so one large session cannot flatter the trend; and it says so when there is
  not yet a "before" to compare with.
- **A session compares itself with the record**: opening a drawer states *this session against the average on
  the record* — expenses and reimbursed, side by side.

Verified — **34 suites, 1,797 checks** — including the exact totals on the cards, the average maths read back
from the ledger, the trend percentage derived independently in the test, and the drawer comparison.

## What changed in 6.9.93

**A revenue session is chosen from the training roster.**

The ledger used to be typed by hand while the registry held the same trainings already — which is how a
revenue row and its training drifted apart, and how one session ended up written down twice. Both directions
now exist:

- **Log session** opens on **“Training from the roster”**. The trainings still without a revenue line are
  listed first, the ones already carrying one are named as such, and *“Type a new session instead…”* is still
  there for a workshop nobody has entered yet.
- **Choosing one fills the form** — title, organizer, place, start and end — from the registry, and the saved
  row carries `linkedTraining` plus the attendees, so the two records describe the same event rather than two
  similar-sounding ones.
- **The ledger says which rows came from the roster** (a `roster` tag on the row).
- **The drawer** shows the roster training behind the session — title, dates, how many attended — and offers a
  select to **correct or remove the link**. Every change is written to the audit trail
  (*“Linked to the training roster · …”*).
- **Reconciliation is now by link, not by row count.** The page states *“N of 39 trainings in the roster carry
  a revenue line, M still to log”*, and counts any ledger rows that are not tied to the roster. Counting rows
  could never be right: two sessions of one training, or one training and a typed row, made the registry look
  settled when it was not.

Verified — **34 suites, 1,797 checks** — including the roster in the form, the fill-from-registry, the link
stored and audited, the roster tag on the row, relinking and unlinking from the drawer, a session typed outside
the roster, and the reconciled count moving by exactly one.

## What changed in 6.9.92

**A blank is a blank, and a written 0 is a 0.**

The district's sheet leaves many cells empty and writes 0 in others on purpose — *RPR 0 | 0* is a statement,
an empty cell is silence. The return had been flattening both into one: every zero was dropped on import and
every empty cell was printed as a dash, so a laboratory that reported "no positives" looked identical to one
that had not filled the row at all.

The three states are now kept apart, from the workbook to the screen to the export:

- **On import**, a 0 in the sheet is kept as a 0; a cell the sheet never names stays absent. `S.reportRow`
  now carries `present` — which cells of the row were actually written.
- **On the form**, a written 0 shows as `0` in its box and in the row total; a cell nobody filled is left
  empty, and its total is empty — no dash anywhere.
- **In the blood bank**, a group the sheet records as all zeroes prints zeroes and a closing balance of 0;
  a group the sheet never mentions is left blank.
- **On the printed sheet and in the Excel export**, the same map is read: a figure prints, a 0 prints as 0,
  and a blank cell is an empty cell. The Excel export no longer writes 0 across every empty cell.
- **Typing**: clearing a box removes the figure instead of storing a 0; typing 0 stores a 0.

Verified — **33 suites, 1,755 checks** — including RPR `0|0` read as two zeroes, CD4 `0` kept, a line the
sheet never names staying absent, blank cells and blank totals on the form, the all-zero blood group, and the
printed sheet carrying no dash at all.

## What changed in 6.9.91

**"The site is not reachable" — when the address answers and the device shows nothing.**

That is almost never the server. A browser that has once held a half-installed build keeps serving it from its
own cache, and the result is indistinguishable from a dead site: the splash turns for ever, or the page stays
blank. The console now has three ways out, and none of them needs anyone to explain a cache.

- **It says so instead of turning.** If the splash is still on screen after seven seconds the page has not
  started at all, so the animation is replaced by a sentence — *"This device could not start the console"* —
  that states plainly that the address is answering, names the first thing that actually failed (a script that
  did not load, an error message, a rejected start-up promise), and offers **Clear cache & reload** and
  **Reload**. The register on the device is never touched by either.
- **`?fresh=1` is the guaranteed way in.** The address clears the service worker and every cache on this
  origin, then reloads once — no flag left in the address, no history entry behind it, and a one-shot marker
  so it cannot loop.
- **The page itself carries a fallback that depends on nothing.** Written inline in `index.html`, it fires
  after ten seconds if the console never started — even if none of the console's own scripts arrived — and
  offers the same clean reload as a plain link. A browser with JavaScript switched off is told why.
- **Version watch stays:** a tab running an older build is named, with the reload.

Verified — **32 suites, 1,705 checks** — including the recovery panel naming the failure, its two buttons, the
`?fresh=1` route (flag removed, cache-busting stamp added, one-shot marker), and the inline fallback.

## What changed in 6.9.90

**A month can be deleted — including the one opened by mistake.**

Opening a month was one press and there was no way back: a slip on "New month" left a month in the history for
ever, and every comparison below it was drawn against a blank. A month is now removable, in two places:

- **Delete month** in the header, for the month in front of you;
- a **bin on every row** of the month-by-month table, for any other month.

The confirmation counts what is being removed — examinations, tests, blood groups — read from the month itself,
so it can never claim an empty month that is not. An empty month says *"this month holds no figures — it was
opened and left"*; a month with figures says plainly that they are discarded and that it stops appearing in the
table, the yearly totals and the trends. Cancelling changes nothing.

- **The online copy goes with it.** A delete that only cleared this browser would be undone by the next Fetch,
  so `lab_report_months` loses the row too — one month, by key — and a new delete rule in `supabase/schema.sql`
  allows exactly that.
- **One refusal:** an *empty* month that is the only month on file is not deleted, because the module would then
  have nothing to show. A month carrying figures can always go.
- **The audit trail keeps one line** — *"Monthly return deleted for 2026-11 · 0 examinations and 0 blood groups
  discarded"* — so the record still says the month existed and was removed, without keeping the figures.

Verified — **31 suites, 1,675 checks** — including deleting from the header, cancelling, the count in the
confirmation, the refusal of an empty last month, the audit line, and the row leaving the online table by key.

## What changed in 6.9.89

**The register is live on every device, the history is kept online, and the public page is drawn on paper.**

Four things, and the first one is the reason the other three matter.

- **Sync was off on every device that had not been set up by hand.** The project coordinates lived in that
  device's browser settings — so a phone that had never been configured showed "Local only", its own copy,
  and no sign of the register the laboratory actually keeps. The deployment now carries the coordinates
  itself (`shared.js`), so **a fresh install is connected with nothing typed**: it pulls the shared register
  when the console opens, publishes every change, and checks for other devices every 2.5 s. Settings →
  Cloud sync still overrides the address for one device, and now says which of the two it is using.
- **A device that has never received the register takes it, and keeps what it was showing.** Before, the
  background loop refused and went quiet — which is safe but reads as "it did not sync". Now it adopts the
  shared copy, writes the old one to restore points first, and says so in one line. The sample register can
  still never be published over the real one.
- **Signing in pulls immediately.** `SY.onSession()` — pull, start the live loop, bring in the months — is
  the first thing that happens after the password, rather than a timer that may fire later.
- **The monthly returns are kept in a table of their own** (`lab_report_months`, one row per month). The
  register is one document and is rewritten whole on every push; a return is a record and must not be. A
  **Keep the history online** card in the report module saves every month once, and **Fetch** brings them
  back — on a new phone, after a cleared browser, after a register started again. Loading the workbook saves
  them automatically. A month that exists in both places is only replaced by a copy that is genuinely later.
- **Every write keeps the copy it replaced** (`lab_register_history`, last fifty, by trigger), so a wrong
  push is recoverable from the database and not only from the browser that made it.
- **The public page is light.** Warm paper ground, near-black text, dark gold for contrast, and the empty
  half of the hero now carries a drawn bench — an Erlenmeyer, a round-bottom flask, a test tube in its rack
  and a pipette at rest, with slow-rising bubbles that stop for anyone who asked for less motion. It is SVG:
  no image, no request, no weight.

Verified — **31 suites, 1,545 checks** — including a mocked Supabase at the fetch boundary: a device with no
settings reaches the register, a new device adopts it and preserves its own copy, a change travels both
ways, the sample register is refused a push, the vault saves and restores months on a second device, and an
older online copy never overwrites a newer figure.

Two suites had pinned results to the calendar — the week the month turns, and who is on leave "now" — and
failed for the passage of time rather than for a defect. They now walk to the week they mean and read the
leave register instead of assuming a date.

## What changed in 6.9.88

**The blood bank was only ever October.**

Section VIII of the return — the eight blood groups with opening, requested, received, used, expired and
returned — is not a list of examinations. It is its own block, and the workbook reader only ever looked for
examination lines. So every past month loaded with its examinations and **no blood supply at all**: the
blood-transfusion chart drew one point, and the month-by-month table showed 0 packs used for months that had
plenty.

- **The block is now read for every month**: `A-`, `A+`, `AB-`, `AB+`, `B+`, `B-`, `O+`, `O-` (and
  `A positive` / `O neg` spellings) are matched wherever they sit on the row, with the six figures that
  follow them. The group with nothing moving is read as zeros, not skipped; the printed **Sum** row is
  checked and never counted twice; and an examination sharing that row is still read at the same time.
- **The figures travel with the month** into the return's blood table, so the closing balance
  (opening + received − used − expired − returned) is worked out per group per month, as before.
- **A month without section VIII is a gap, not a zero.** The month table now shows `—` for packs where the
  sheet carried no blood block, the chart leaves a gap rather than dropping to zero, and the card names the
  months concerned: *“No blood-supply block for Oct 24 — load the workbook again and section VIII comes in
  with it.”*

**Reload the workbook once** (Analysis & history → Load the workbook → same file): loading merges into the
months already on file, so the examinations stay exactly as they are and the blood supply is added.

Verified — **30 suites, 1,626 checks** — including six groups read off a sheet whose blood block shares its
rows with the examination blocks, the sum row ignored, the zeros kept, the totals reconciling
(6 opening · 54 received · 51 used · 9 left), and the gap shown rather than drawn as zero.

## What changed in 6.9.87

**The history is something you walk through, not a page you read once.**

Choosing a month used to change some of the page. Now the month is a position on a record, and everything
below it is read from that position.

- **A strip of the months on file**, oldest to newest, each carrying its total and what it moved by. Click a
  month, press the arrows either side, or use **← →** — the whole page follows: the comparison, the
  month-by-month table, the year roll-ups, every chart, and the rankings at the foot. The strip marks where
  you are ("October 2024 · month 2 of 14 on file").
- **The movement chart is the record itself.** `C.delta` — a new diverging chart — draws every month's change
  against the month before it: bars up for a rise, down for a fall, on one zero line, the month you are
  reading outlined in gold. **Clicking a bar winds the page to that month.**
- **Counts and percentages together, never one without the other.** Each comparison card now breaks into
  lines — tests, positives — each with the figure, what it came from, the count it moved by, and the
  percentage:
  `tests 1,180 from 1,024 · +156 · +15.2%`.
- **Year over year, asked of the month in front of you**: *“October across the years on file”* lists each
  October with its total and the change since the first — which is the honest comparison when a year is
  missing.
- **Two more readings across the whole record**: **positivity** through the months (positives as a share of
  that month's qualitative tests) and **the blood bank over time** (received against transfused).
- A month with nothing before it shows a gap in the movement chart and says so; nothing is scored as a fall
  to zero.

Verified — **30 suites, 1,610 checks** — including the strip, the bar-click, both arrow keys, the count and
the percentage in the comparison, and the two new charts.

## What changed in 6.9.86

**The sheet was not being read. It is now.**

The reader shipped in 6.9.85 was written against a guess at the workbook's shape, and the guess was wrong.
The district's sheet does not put a plain name in a column: it prints **the form's numbering inside the
label** — `1. Blood Smears Plasmodium`, `6.4 Full Blood Count`, `5.1.a Fresh` — it lays **several sections
side by side across one row**, and the figures sit several columns to the right of the name. The matcher
compared whole strings, found almost nothing, and the month came in nearly empty.

- **The numbering is read first.** `6.4` → line 6.4, `5.1.a` → 5.1.a, `1.` → line 1, then the wording is
  tried with the number taken off, then the wording as written. A number is only trusted when the words
  beside it agree, so `2. Catchment Area Population` is never mistaken for line 2, the malaria rapid test.
- **A whole row is read, not just its first label.** The urine block sits on the same row as the malaria
  block; every block on a row is now picked up, which is why orange-sugar was arriving as nothing.
- **Figures are the run of numbers that follows the label**, and the run stops at the gap — so the full
  blood count takes its own `1,364` and not the blood-bank column further along the same line.
- **A block's heading outranks the row's own numbering.** Under `5.3 Urine`, a sub-row still written
  `5.1.a Fresh` is read as `5.3.a` — 6 of 529 — instead of colliding with the vaginal swab that already used
  `5.1.a`.
- **Whatever still cannot be placed is kept and shown.** Rows that carry figures but match no line are no
  longer dropped silently: the count is stated when the workbook loads, they are listed on the analysis tab,
  and **Place them** maps each one to its line — once, remembered as an alias for every month after.
- **The month can come from the sheet itself** — `6. Month | October` with `5. Year | 2026/2027` — when the
  tab's name says nothing.

Verified against a reconstruction of their own layout — numbered labels, blocks side by side, the blood bank
on the same rows, `NA` cells, `1,364` with its comma: line 1 = 2 positives / 86 negatives / 51 under-5 /
37 over-5, stool 268, sugar 11 of 24, FBC 1,364, amylase 41, vaginal swab 8 of 59, urine 6 of 529, urea 929,
and the catchment population never read as a test. **30 suites, 1,443 checks.**

## What changed in 6.9.85

**The workbook can be read whole — and a month of returns becomes a history you can travel through.**

The reports module could hold one month. The district's spreadsheet holds every month, so the gap was not
in the form but in what could be got into it. Both halves are now closed.

- **The .xlsx is read on the device, sheet by sheet.** No library, no upload, nothing sent anywhere: the
  workbook is unpacked in the browser and every sheet is listed with the month its name says — *“Oct 2024”,
  “Oct 26”, “September 2024”, “Sep-25”* are all read; a sheet whose name says no month is shown with the
  month left blank to be chosen, never guessed. A name like *Sheet1* stays empty.
- **Every row is matched to the line it belongs to** — the label can sit in any column, the figures to its
  right. A row that matches nothing is ignored and counted, not guessed at; a line that receives fewer
  figures than the form expects is flagged for the eye. Nothing is invented to fill a month, and a month
  that was never entered stays absent rather than becoming a zero.
- **A single sheet can also be pasted** from Excel, for a browser that cannot unpack an .xlsx or a month
  that arrives on its own. Both roads end in the same matcher.
- **Analysis & history** is a second reading of the same module, on its own tab beside the return:
  - **the comparison strip** — this month against the month before it *on the calendar* (if that month was
    never entered the comparison is absent, not borrowed from an older month) and against the same month a
    year earlier, with the head-count change beside the percentage;
  - **month by month** — every return on file, newest first, with its change, positives, positivity, stool
    samples and the blood bank's packs used and left. A row opens that month's return, which is the way back
    in time;
  - **year by year** — tests rolled up by calendar year and by financial year (July–June, as the district
    reports it), with the average per month beside the total, because a part year and a full year cannot be
    compared on totals alone;
  - **follow one examination through time** — choose full blood count, amylase, ALAT, creatinine, HBV or any
    other line and see it month by month, with the change since the first month on file;
  - **what moved** — the examinations that rose and fell since last month, biggest movement first;
  - **where the work sat** — every section of the form charted month by month.
- **The names the district writes now find the line they mean.** *Full Blood Count*, *FBC*, *NFS*, *ALT*,
  *GPT*, *Blood glucose*, *Malaria smears*, *GE*, *MRDT*, *LCR*, *Urée* and their like are aliases of the
  form's own lines, so a month read back in lands on the right row instead of creating a second one.

Verified: **30 suites, 1,443 checks**, including a new one that builds a real three-sheet .xlsx in memory and
reads it back — names, order, shared strings, numbers, the month read off each sheet name, the matcher, the
series, month over month, year over year, the per-test trend, the movers, and the whole path through the page.

## What changed in 6.9.84

**Monthly Reports can be found — and the registry stops inventing access roles.**

Two things were wrong, and only one of them was in the code.

- **The monthly report was deployed but a tab that was already open never saw it.** Code is fetched
  network-first, so a reload always gets the new build — but a page left open on a phone keeps running the
  JavaScript it loaded, and a module added later simply is not in it. The console now asks the deployed page
  once, a few seconds after load and again whenever the tab comes back into view, what version it is serving;
  if it disagrees with the build in memory it says so by name — *“A newer build (v6.9.84) is live — this tab
  is running v6.9.83”* — with a button that reloads. The report is also on the Command Center as a third hero
  button, not only in the rail, and it is precached by the service worker so it opens offline like the rest.
- **The staff registry was labelling jobs as system roles.** Beside every name sat a badge reading
  *Technologist* for anybody whose job title contained “technician” or “technologist” — so the whole bench
  appeared to have been put on a Technologist account, including the five who have no account at all. That
  badge was derived from the job title, not read from anywhere: **no role was invented and no record was
  changed.** The badge now reports an access role only when the person really holds an account, and otherwise
  says **no account**. Kelvin (Admin), Aurelie (Manager) and Jean Paul (Technologist) are the only three
  people with a login; everyone else's title — Lab Technician, Lab Technologist, HIV Lab Quality Corp — is
  their job, exactly as the register keeps it.

## What changed in 6.9.83

**A Monthly Reports module — the district HMIS return, the analysis behind it, and an export that looks like
the sheet the district receives.**

The laboratory reports its month to Gakenke District on the HMIS form: a numbered list of examinations, each
with positives, negatives and — for malaria and stool — the age split, then the blood-supply table. That is
now a module of its own, in Operations, and October 2026 is already on it, transcribed line by line from the
signed sheet: **10,855 tests**, 223 positives, 6,081 negatives, and the blood bank reconciling exactly
(6 opening · 54 received · 51 used · 9 left).

**The form is data, not code.** Every line carries its section, its number, and how it is counted (positives
and negatives · with the age split · positives by 0–4 / 5–15 / 16+ · a single total). Because of that:

- a **test added to Settings → Test menu appears on the return by itself**, in the right section, marked
  *new* — nothing has to be re-coded when the laboratory takes on another examination (the blood cultures
  that are referred out are on the sheet already, waiting for their figures);
- **Add examination** puts a line of your own on the form from that month on, linked to a test or standing
  alone, and it can be taken off again;
- the *of-which* rows — the malaria species, the eleven stool parasites — are printed in full and never
  counted twice, which is why the page total matches the 10,855 on the signed sheet to the test.

**Nothing is typed twice.** Only the figures are typed; every row total, section total, page total and closing
blood balance is computed, and the whole page updates as a cell is left. **New month** opens an empty return
without copying the month before, so last month's figures can never be mistaken for this one.

**The analysis** that the module carries beside the form:

- **Top 10 requested examinations** — full blood count 1,364, blood glucose 1,022, creatinine 938, urea 929,
  ALAT 917 …
- **Top positive tests** — only the examinations whose result is qualitative, each with its own rate:
  H. pylori 69 of 273 (25.3%), Entamoeba 58 of the 268 stool samples (21.6%), albumin 41 of 119 (34.5%) …
- **Least requested** — and the examinations nobody requested at all this month, named.
- **Blood transfusion** — packs by group type, received against transfused, the closing balance and the
  transfusion rate, with O+ and B+ carrying the month.
- **Where the work sits** — every section of the return, and its share of the month.
- **Month on month** — tests and positives, once more than one return is on file.

**The export** is one press away and follows the house style of the working plan and the roster: the same
letterhead, the form's own sections, page numbered, **A4 portrait, paginated from the data** — three pages for
October, and more pages when lines are added rather than a broken sheet. Offered as PDF (multi-page), Print,
PNG per page, and Excel with the same rows. The export dialogue previews page one before you choose.

Also fixed: three plan and roster suites that read the *current* month, which rolled over to November during
this work — they now open the month they assert about, so they stay honest in any month.

## What changed in 6.9.82

**The training queue reads the history, and the history had two mistakes in it.**

Aurelie and Beatrice attended the weekly skills training on **20–24 July 2026**. It was recorded at *Ruli DH*,
and a session held at Ruli DH is in-house, so it never served a turn: the queue went on counting their wait
from 2025 and kept them at the front while colleagues who had genuinely waited longer stood behind them. The
session was held in **Musanze**; the record now says so, and both of them count from 24 July. A second,
overlapping record of the same session (24–25 July, no location, the same two people, from the leave planner)
is folded into it — one attendance, one turn.

Bernadette's record said she joined in February 2024. She joined on **14 September 2026**, so her wait is
counted from that day, and her first thirty days in the department run to 13 October — which is exactly why
the signed October sheet puts her on nights from the 15th and not before. The staff card, the roster rules
and the queue all read the same date.

Both corrections are guarded by the exact old value: a register that already holds the truth — a synced one,
for instance — is left untouched, and each is applied once.

The queue itself:

- **One list.** The three post holders (laboratory manager, quality manager, safety officer) are no longer
  parked above the queue. A post decides who is **called by name** when a session is aimed at it, not who
  waits — so everyone active stands in the same queue, carrying a small *post* marker.
- **Read from the history.** Days served waiting are counted from the day a person returned from their last
  training of three days or more held away from Ruli DH; a person who has never been trained waits from the
  day they joined.
- **Two people from one session** are level on days, so the earlier history separates them: the one who had
  waited *fewer* days to reach that shared session goes first. Aurelie (332 days to reach the July session)
  therefore stands ahead of Beatrice (360).
- **Already booked, therefore last.** Somebody with a session still ahead of them is not due another one, so
  they stand at the foot of the list until it is over, marked with the date. The manager, booked for Monday,
  is last on the list rather than fourth on it.

The order now reads, from the top: Jean Paul 505d · Patrick 421d · Dieudonné 414d · Kelvin 358d ·
Aurelie 99d · Beatrice 99d · Bernadette 47d · Jeanne Claudine 25d — Aurelie and Beatrice followed by
Bernadette and Jeanne Claudine, as the history says they should be.

## What changed in 6.9.81

**The turnaround target belongs to the examination, and it is saved when the test is added.**

A target was being typed per sample, so two blood cultures registered a week apart could carry 4 days and
7 days for no reason other than who typed them. The standard now lives on the examination: blood culture
**7 days**, TB culture **21**, HIV recency viral load, measles & rubella, monkeypox and polio PCR **5**,
hepatitis **7**, and every viral haemorrhagic fever — Marburg, Ebola, Lassa, Rift Valley, Yellow Fever,
Crimean-Congo — **3**. Anything not named in the table falls back to 3.

- **Settings → Test menu** is where the figure is set: one number beside each examination and one *Save TAT*.
  Saving writes it onto the catalogue test and re-reads every sample carrying that test, so the register
  follows at once. The menu says what the numbers mean.
- **Registering a sample**: the test step states the target as the tests are chosen — "Target TAT 7 days —
  saved with the sample, from the test" — with each examination's own days listed beside it. The routing
  card repeats the figure. Nothing is typed anywhere.
- **Several tests on one sample** take the longest of them: a specimen is not on time until the last
  examination is back.
- **A deliberate figure on one record** (the record editor) is remembered as an override and is never
  overwritten by a later change to the standard. The record's own panel says whether the number came from
  the test, from the longest of several, or was set by hand.
- The old per-sample settings shadows (blood culture 4, hepatitis 7 by name, a blanket default) are removed
  on load and every existing sample is re-read from the test it carries.

Fixed with it: a sample whose examinations were stored as a list was being measured against the whole
list treated as one name, which is how a blood culture could read 3 days. Reading the examinations
uniformly is now shared by the migration, the re-apply and the record panel.

## What changed in 6.9.80

**No scorecard for a centre nobody visited, and nothing on the public page a visitor has no business knowing.**

The PBF module was seeding a scorecard for **every** health centre from a random number generator, and the
table fell back to those rows whenever a centre had no visit — so Rushashi and Muyongwe, never visited,
carried a plausible index and a "recorded scorecard" label. That source is gone: the generator is removed,
the rows it left on existing devices are purged at load, and the fallback is deleted. A centre now carries
a mark only from a visit an assessor actually recorded; until every question on that visit is marked it
reads **Visited · marks pending**, and a centre with no visit reads **Not yet visited**. The four visits
the district confirmed (Coko, Minazi, Rwankuba, Muhondo) stay as visits with their marks still to be
entered, and the one-time seeding that writes them is now idempotent, so a fresh device keeps them.

The public page claimed **nine health centres**: Ruli DH had been added to the centre list so samples could
originate there, and it was counted with the eight. Ruli DH is the hospital that receives and refers — it
is not a centre in the network — so the page now counts eight, and its list of centres leaves Ruli DH out.

The public page no longer names the modules a visitor cannot open. It used to say *everything except
Training Revenue, Settings and Data & sync*, and the visitor strip repeated it. Both now describe the view
the visitor is in, not the rooms behind the wall.

---

## What changed in 6.9.79

**A slimmer margin on the paper, and a legend laid four by four.**

The print margin is **two thirds of what it was — 6 mm → 4 mm**, which takes the white band beside the
sheet from about 8.8 mm to about 6 mm, the same on the left as on the right, since the sheet is centred
in the printable box.

The keys are laid **four rows of four blocks** instead of five to a row: sixteen keys, no ragged last
row, and each block wide enough to hold its line at the size of the staff names — the keys, the contacts
and the names in the grid are all set at 26 px.

---

## What changed in 6.9.78

**The working plan prints on one page again.**

Every print of the working plan came with a second, empty page. The sheet was printed at
`width:100%; height:auto`, and its aspect ratio (3200:2263) is a shade wider than A4 landscape's
printable box — so a sheet set to the full width of the page ran about 3.5 mm past the foot of it, and
the browser answered with a blank second page.

The sheet is now fitted inside the printable box in **both** directions: it is given an explicit size in
millimetres, taken from its own viewBox, less a hairline of safety so no rounding of a hundredth of a
millimetre can spill onto page two. Same fix for the weekly roster, which prints through the same helper.

---

## What changed in 6.9.77

**Compact blocks, one type size, and a plural heading.**

- The key blocks and the contact blocks are **three fifths of the height they stood at** — 116 → 70 px —
  and the air between two rows comes down with them (13 → 8 px), so both lists keep their proportion and
  one pitch.
- **One voice under the table:** the keys and the staff contacts are set at the size of the staff names
  in the grid. The legend is laid five blocks to a row so a block has the width to hold its own line at
  that size, and a phone number is now measured at the advance of the mono face it is printed in — that
  wrong measure was what shrank a number below its name beside the longest name on the establishment.
- The name column is headed **Names**, on the sheet and in the XLSX.
- **Republic of Rwanda** and **Ruli District Hospital** are set a step larger (26 → 31 px) so the
  letterhead belongs to the same page as the plan.

---

## What changed in 6.9.76

**The keys follow the table again, and the spacing goes back to what it was signed off at.**

6.9.75 spread one gap through the whole lower half of the sheet to fix a band of white — and moved the
contacts and the keys with it. That is undone. The gaps are the ones the sheet had when it was approved:
22 px before a heading, 30 px from *Keys:* to the key blocks, 34 px from *Staff contacts:* to the
contacts, 18 px to the signature rule — and the key and contact blocks are again the block the sheet was
signed off with, on one pitch, with 13 px of air between their rows.

The single fault is fixed on its own: **the keys now open right under the grid.** The band of white
between the last row of the table and *Keys:* is gone — the heading sits 22 px under the gold rule
instead of 58 px plus a heading's worth of paper.

---

## What changed in 6.9.75

**One gap, used four times, and no band of white under the grid.**

The sheet had a 58 px break under the grid, then a 30 px heading, then a 22 px list break, then a
34 px heading again — four different gaps, and the first of them a band of white. There is now **one
gap, used four times**: the rule under the grid to *Keys:*, *Keys:* to its blocks, the last key block
to *Staff contacts:*, and that heading to the contacts. The same air, measured on the paper rather than
on the alphabet — a heading sits on a baseline, so its cap height and descender are part of the gap a
reader sees.

The space the compact rows free is **spent on the blocks first** — a key block and a contact block are
now the height of a list row (79 → 104 px on a full establishment) — and only what is left goes to the
gap. Both lists stay on one pitch with the same 13 px of air between their rows, and the contact blocks
now start where the pitch says they do instead of being nudged down inside their row.

---

## What changed in 6.9.74

**The keys are spaced like the contacts.**

The legend is no longer spread down the page to fill it. A key block is the height of a contact
block (79 px) and the two lists stand on the **same 92 px pitch with the same 13 px of air between
their rows**, so the keys read as a list under the grid and the contacts as a list under their
heading — one setting, not two.

What the compact lists leave over is not turned into air between rows: it is set as a single section
break under the grid, and the rest stands as the sheet's own bottom margin. The signature block
still follows the last row of contacts.

---

## What changed in 6.9.73

**The contacts are a list again, and the signatures follow them.**

The two rows of staff contacts now sit on a 92 px pitch instead of being spread down the page, and the
list opens 34 px under its own heading instead of hanging below it. The signature block no longer waits
at the foot of the paper: the rule is drawn 18 px under the last row of contacts, so the sheet closes on
the names it signs. Whatever height that leaves over is given to the key grid as air between the blocks
— the page is closed by the keys it has to explain, not by a band of white paper.

---

## What changed in 6.9.72

**The rows of the working plan are compact, and the key blocks have grown a fifth.**

A staff row is **three fifths of its old height — 126 → 76 px** — and so is a contact row
(132 → 79 px). The grid is a register, not a poster: the name and the post under it are fitted to the
row they have, and a post long enough to need three lines steps down (the post first, then the name)
until the block stands inside its row instead of printing over the row beneath it. The letters in the
grid keep their harmonised size, so a shorter row does not make them smaller.

The **key blocks are a fifth taller** — 54 → 65 px, on a pitch of 62 → 73 — with their chips and their
lettering grown to match. What the compact rows leave over is spent on air between the two contact rows
rather than on a white band under them, so the sheet still closes on the signature rule.

---

## What changed in 6.9.71

**Staff contacts are two rows — four blocks to a row — with the numbers flush right, and one size throughout.**

The contact block is now **two rows**, whatever the size of the establishment: four blocks to a row on
eight people, and the row count never grows. Each block holds its name hard left and its number hard
right, on one inset shared by every block, so the numbers stand on four right-hand edges and read down
as columns of numbers rather than as a line of text.

The name and its number are set at **one size for the whole block** — 23.5 px here — solved together
against the longest name and the longest number, so no block is tight, no number runs into the name
beside it, and a short name never floats beside a number set larger than itself. The number gives way
first if a block is ever narrower, and never below 24 px.

---

## What changed in 6.9.70

**Staff contacts: two to a row, four rows, numbers flush right.**

The contact block is 2 × 4 — two names to a row and a row for every pair, so the establishment of
eight reads as four rows of two blocks. Nothing is spread into a third or fourth column. Inside each
block the name is set hard left and the number hard right, on one inset shared by both columns, so
every number in a column stands on the same vertical line: two clean edges down the whole block
instead of a ragged line of text.

---

## What changed in 6.9.69

**The shift letters are the size of the names, the posts are the size of the key, and the contacts sit in two columns.**

*The letters.* `D`, `N`, `DN`, `OFF` were set from the height of the row — up to 56 px, twice the staff
name beside them, and they read as a poster rather than a register. They are now set at **the size of
the staff names**, and both are set from the two columns they have to fit: the longest name on the
establishment on one line in the label column (now 560 px, widened from 520) and the longest code
(`ABS`) inside a day column. That is 26 px on a full establishment — one size for the names, one for
the letters, and the day letters above them. Nothing in the grid is bigger than the name it belongs to
any more.

*The posts.* A staff title is set at **the size of the key text** — 22 px, the same voice as the key
line under the grid — instead of a footnote size under a 34 px name. A post that is too long for the
column wraps onto a second line before it is ever shrunk below the key, and it breaks between its parts
(`Lab Quality Manager` / `service requisition (acting)`) rather than in the middle of one.

*The contacts.* Two columns, always — a pair to a row. The block had been spread into three or four
columns whenever the space was tight, which made each card twice as wide; the number was then printed
against the far edge of the card, a hand's width from the name it belongs to. The number now follows
the name after a short gap, and the cards keep their two-column pitch even when that leaves white under
them.

---

## What changed in 6.9.68

**The weekly roster reads the working plan of every day in the week — and the weekend is one duty.**

*The plan was read through one month.* The weekly roster took its shift codes from the plan of
whichever month was selected above it, so the week of 26 October 2026 — Monday to Friday in October,
Saturday and Sunday in November — read both days from October and found nothing on the weekend. The
console then fell back to the contract pattern, which is how a name the plan has at home appeared on a
Sunday. Every day is now read from its own month's plan: the week covers both months, the grid and the
printed sheet say which plans were read, and the New Year week (28 Dec – 3 Jan) does the same.

*A newcomer is never invented into the weekend.* Jeanne Claudine arrived on 6 October. The plan leaves
her off Saturday 31 October and Sunday 1 November, so the roster now shows her nowhere near them.

*The weekend is one duty, not seven benches.* A Saturday, a Sunday and a public holiday are worked by
whoever the plan puts on the day, over the whole unit. Auto-allocate used to skip the weekend columns
and leave seven empty benches per day, then report them as empty slots. It now clears its own weekend
cells (a by-hand allocation there is kept and counted), the columns are marked **unit duty**, and the
empty-slot count ignores them. Clicking a weekend bench explains the rule instead of opening the
allocator.

*A day duty row, from the plan.* The grid and the printed week now carry **Day duty**, above the night
row: numbered on weekdays, named on the weekend, so the Sunday duty is visible in one place.

*Auto-allocate fills every bench.* It filled the posts it knew and then left whatever remained empty —
Parasitology and TB/Molecular went unfilled on a four-person day. Every bench now gets a name, the
person on duty who may work it and is carrying the fewest benches already, and anything left open is
named in the message rather than counted as a silent skip.

*Auto nights never writes over the plan.* The night row is the plan's. Auto nights now proposes names
only for the days the plan leaves without one; when the plan names every night of the week, it says so
and writes nothing.

*A name is enough.* `S.shiftState` accepts the name printed on the plan as well as the record id, so a
caller reading the sheet can no longer get "unknown" for somebody who is plainly on duty.

---

## What changed in 6.9.67

**A4 landscape, the numbers as the department writes them, and a fairer rota.**

*The sheet.* The working plan is drawn on A4 landscape and nothing else: the page is now 3200 × 2262
(297 × 210 mm) instead of 3200 × 1876, so the rows take the height the paper actually has. The rows
are up to 126 px tall instead of 90, every name is set as large as its column allows (34 px at the
top, 22 px floor — was 42 px down to 21), the posts under them to 24 px, the day letters from 27 to
31 and the day numbers from 26 to 30. The letter in a cell is set from the row's height but never
wider than its own column, so `OFF` and `DN` can no longer run into the next day. The key and the
signature block are measured from the foot of the page, so nothing is drawn off the paper.

*The key.* UO reads `UO — Unattended off`. The bracketed paragraph that ran past the end of the key
block is gone; the ledger and the tooltip still say what the day was.

*The numbers.* Every telephone number on a screen or a sheet prints `07XX-XXX-XXX` — `0787-055-121`,
not `0787055121` — through `U.fmtPhone`, which also accepts `+250…` and a bare `7…`. It is a display
format: the register keeps the digits it stores.

*The rota.* December's nights go to Dieudonné, Patrick and Jeanne Claudine; Bernadette carries none.
That is a field on her record, `lightMonths`, not a rule buried in the generator: a month named there
is one the plan turns to last, and only when nobody else can take the block. The November plan, which
writes the first week of December, leaves her off that week too.

The public holidays now turn around the bench from what the record already says. The nights worked
over the three months before are read off their stored plans and weigh the next pick — the month
being written is evened out first, and a tie goes to whoever has carried less. The arrival of a
holiday is counted the same way, so the name who worked the last one does not get the next.

A holiday falling Monday to Wednesday is never given to somebody with under six months' service
(counted to the month from the date they joined): those go to the seniors, and the newer names take
the Thursday and the Friday, and a weekend holiday only when nobody else is covering day and night
that weekend. Where the bench has nobody senior free, the rule steps aside rather than leave the day
uncovered.

Rest before work (RBW) is no longer written on the Friday before a weekend when the person goes on
leave straight after it — the leave is the rest, and the Monday off it promised was never theirs to
take.

---

## What changed in 6.9.66

**UO is set in the same grey as OFF.**

UO was drawn in gold to mark it as a decision somebody made by hand. On a sheet, though, a day at
rest is a day at rest: UO and OFF now share one cell colour — `#FCFCFE` with the same grey ink — on
the screen and on the printed sheet, and only the letter tells them apart. The key still spells out
what UO means, and the ledger still counts it as a day that was worked.

---

## What changed in 6.9.65

**The signature block gets the leading its new size needs.**

6.9.64 set *Prepared by / Verified by / Approved by* and the roles under them at the size of the
staff-contact names. The lines still sat where a 21 px footnote had put them, so at 34 px the name and
the post closed on each other. The three lines are now spaced for their size — the label, the name
under it and the post under that — and the block still closes well above the foot of the page.

---

## What changed in 6.9.64

**A blank tile, UO, and a sheet that gives its width back to the days.**

**A cell can be left blank on purpose.** The shift picker had no way to *clear* a cell: taking a
name off a weekend meant writing an `OFF`, which put a grey square in a place that should be white.
The picker now opens with a **Blank** tile — *at home, nothing written* — and the audit trail records
the change as a blank rather than as an empty code. It is the difference between "this person rests"
and "nothing is decided here", and until now the console could only say the first.

**UO — unattended off.** A rest day that was worked instead. It is entered by hand, sets in a warm
gold rather than a grey, is not a leave and is not an absence, so it never draws on the
annual-leave balance or the carry-over. It counts where it belongs and nowhere else: as day cover
(a person who worked their rest day is on the bench), as a weekend or public holiday in the fairness
ledger, and in the console's own reading of a day as *worked a day due as rest*. A shift pattern
never paints over it, because somebody decided it.

**The gap between the names and the first day of the month is closed.** The label column was 700 px
of a 3200 px page, so a band of white sat between the last letter of the shortest name and the first
of the month while the day columns were squeezed. It is **520 px** now and the days take the rest.
Every name still prints whole on one line at a legible size — *Jeanne Claudine UWAYISABA* sets at
24.8 px and clears the column — and the post beneath it is fitted to the column instead of running
into Monday. A name only falls to two lines when it will not fit at all.

**The sheet no longer opens with a band of rostering notes.** *Rostering exceptions* — who may not
work nights, who rests at the weekend, who may run three — repeated what the rows already say and
pushed the keys and the contacts down the page. It is gone from the monthly sheet and from the weekly
unit roster; the keys now follow the grid directly.

**The signature block is set at the size of the staff contacts.** *Prepared by / Verified by /
Approved by* and the roles under them were printed as a footnote, smaller than the register they
sign. All three lines now share the size of the names in the contacts above them, and each is fitted
to its third of the page so a long name or post cannot run into the next signature.

---

## What changed in 6.9.63

**A leave block can be charged to a past fiscal year, and a month regenerated by mistake can be put
back.**

The plan book's *Charged to fiscal year* was a caption: it printed the year the dates fell in and
could not be changed. That made one honest thing impossible — recording, this November, the leave
being paid out of the days **FY 2025/2026** never used. It is a choice now:

- it defaults to the year the dates fall in, and lists the earlier years beside it;
- each year says what it can still carry — *12 of 30 days still unused*, or *fully charged
  (30 of 30)* — so the consequence is visible before the block is saved;
- choosing an earlier year charges the block to that year while the block keeps the dates it has,
  which is exactly what a carry-over is;
- the summary says it in one line — *20 days · taken in FY 2026/2027 · charged to FY 2025/2026, the
  year whose days it is using* — and warns when the block is more than that year can carry, or when
  it overlaps a block already on the books.

The year the dates fall in is still read off the dates and never typed, so a record cannot be filed
under a year the person was not away in. A block now shows on **both** rows it belongs to: the year
it is taken in, marked *days charged to FY 2025/2026*, and the year it is charged to, marked *taken
in FY 2026/2027*. Editing the block reopens the year it was charged to.

**Plan history.** Regenerating a month has always archived the grid it replaced, but the archive was
reachable only by digging — which is why a month regenerated by mistake had to be retrieved by hand.
The working plan now carries a **Plan history** table under the grid: every version the month has
carried, newest first, with what it was, how many days it ran and what state it was in, and a
**Restore** button on each. Restoring puts a version back as the plan in force and archives the one
it replaces first, so a restore is never a one-way door either.

---

## What changed in 6.9.62

**The new rules reach a console that already has a plan on it.**

6.9.61 changed what the working plan does with a night block and how far a month runs, but a
month already generated on the manager's own machine keeps the shape it was written with — it
would still read 13 December and a single day of rest until somebody pressed *Generate draft*.

Loading the console now rebuilds the drafts: every stored month that is generated and not
officially published or transcribed is regenerated under the current rules — the span that stops
seven days past its month, the repayment of every night block, the weekend days recorded rather
than written. The month it replaces is kept in that month's archive of versions, its own label
travels with the rebuild, and an official or transcribed month is never touched, so nothing that
was signed off can move under the manager's hand.

A screen-only wording change came with it: the `OFF` key on the working plan now says what the
cell means — *At home (not on shift) · the days a night block is repaid*. The printed sheet keeps
its short key, because a printing register is read at a glance.

---

## What changed in 6.9.61

**Every night is paid back, the plan stops at the week, and the leave register is read by the
plan itself.**

Three things the department asked for, all of them about the working plan telling the truth.

**Three nights, three days at home.** A block of nights is now repaid after its last night, not by
the single day the older build wrote. Three nights finish on a Friday morning, and the Monday,
Tuesday and Wednesday after it are days owed. The repayment is written on the plan as `OFF`, so a
reader sees the rest without reading the ledger.

**A day owed on a weekend is recorded, not written.** When the day owed falls on a Saturday, a
Sunday or a public holiday, the cell is left blank — the weekend stays clean, which is exactly how
the department's own paper plan reads — but the day is not lost: it is counted, and the working
plan shows a **Rest owed after nights** card under the grid with, name by name, the nights worked,
the days owed, the days written, the days not written and their dates. The card is read from the
cells, so a plan transcribed or hand-edited gives the same statement as a generated one.

**A plan never runs more than a week past its month.** November used to run to 13 December. The
run now ends exactly seven days after the last day of the month it belongs to — November 2026 ends
on 7 December — which is the overhang the department's own workbook keeps. Nothing before the
boundary changed.

**The annual-leave plan is the authority the working plan reads — including when the block belongs
to last year.** The manager's thirty days are FY 2025/2026 carry-over taken from 16 November 2026.
The working plan honoured them; the leave book did not show them, because the book listed only the
blocks *charged* to the year it was displaying. The book now reads two angles and shows both:

- what is **taken** in the year — the blocks whose dates fall inside it, which is what a reader
  looking at November needs to see on the row;
- what is **charged** to the year — the blocks whose days come out of that year's entitlement,
  which is what the balance is counted from.

So the FY 2026/2027 book lists the block, marks it *days charged to FY 2025/2026* beside the dates,
and leaves this year's own thirty days at thirty; the FY 2025/2026 book still shows the thirty
charged and a balance of zero. A month created from the console — generated or blank — has the
register written over its cells, so nobody appears at work through leave that is already on the
books.

**The nights turn by the load of the whole run.** The picker was weighing a name by the nights of
the calendar month the block fell in, so the week the plan runs into December started everybody at
zero and the same few names picked the tail up again. It now weighs the load of the whole run
while the monthly ceiling stays as it was, which brings the November shares back to 7 / 8 / 6.
A night block is also never continued by the weekend technologist into the working week: her
Monday is `OFF`, so a night handed to her there simply disappeared.

Two tests were written to the older behaviour and are corrected here rather than worked around: a
single night **on the last day of the run** is the beginning of a block the next month's plan
continues, not a lone night; and an annual-leave fill from 23 November now has thirteen cells to
the end of the run rather than seventeen.

---

## What changed in 6.9.60

**Her name is Jeanne Claudine.**

The register carried her as *Marie Claudine*, which was not her name. The record now reads
**Jeanne Claudine UWAYISABA**, and the correction reaches every place the old name had reached:
her staff record, every row of every stored month and of every archived version, the weekly unit
rosters, the trainings she attended, and any swap asked for in her favour. The staff id is what
joins those records, so nothing was orphaned by the change — only the words moved.

The given name stays whole, as it must: *Jeanne Claudine* is one unit and *UWAYISABA* is the
family name, so the sheet prints all three words on one line and her avatar reads **JU** — the
first given initial and the family name, the same rule that gives Jean Paul **JN**.

---

## What changed in 6.9.59

**Jeanne Claudine's contact details.** Her record carried neither a phone number nor an email, so
the printed contact list gave her a dash. Both are on the establishment now — **0784 063 985**
and **uwayjeanneclaudine@gmail.com** — and the number prints beside her name on the working plan
with the rest of the department.

---

## What changed in 6.9.58

**Jeanne Claudine UWAYISABA arrives on 6 October 2026.**

Her record carried a 2022 joining date, which put her on the establishment for years she was
never there and left her off the October sheet she actually started on. The date is now
**6 October 2026**, and she takes her place on the October working plan — one row, between
Bernadette and Aurelie, where the roster order puts her.

**The days before her arrival are hatched.** Before the 6th her cells carry **BE — before
employment** on the screen and a diagonal hatch on the printed sheet, so they are not read as
"at home" and not read as an unrostered gap. The hatch prints without a letter (a letter would
read as a shift) and its own line is in the key. Nothing else on the October plan was touched:
every other row is exactly as it was signed, and the month is stamped *Revised — 6 October
2026* so the change is visible on the sheet.

**From the 6th she works dayshifts, as a newcomer.** The first thirty days in the department are
dayshifts only: she carries the bench Monday to Friday and is **exempt from the weekend and
from nights until 4 November 2026**. The rule is a property of the record — a joining date and
a `newcomerUntil` date — so it holds for any future staff member, not just her. The November
draft was rebuilt from the rule: no night for her before the 5th, and her two-night blocks back
on the rota afterwards.

The printed sheet now also runs in **the roster order the screen uses** (manager, the two
post-holders, the bench, the weekend technologist last) rather than the order a month happened
to be stored in — the sheet and the grid can no longer disagree.

---

## What changed in 6.9.57

**The printed sheet reads like the letterhead it is.**

*The ministry above the hospital.* Every export — the working plan, the weekly unit roster and
the XLSX workbook — now opens with **MINISTRY OF HEALTH** above **RULI DISTRICT HOSPITAL**, the
order the departmental letterhead is written in. The small print under it (department, email,
phone) moved down a line to give the two names their own air.

*Every name whole, on one line.* The label column was 560 px and the longest names —
MUHAWENIMANA, NIYIDUHABYOSE, UWAYISABA — were set on two lines, which then collided with the
post printed underneath. The column is now 700 px and the name is never wrapped: every name on
the establishment fits across it at up to 34 px, and the post prints on the line beneath it, a
step smaller and in muted ink, so the name always reads first.

*The phone number beside the name.* The contact list used to put the number under the name,
where it was squeezed to 16–20 px and could not be read off a printed sheet. It is now set on
the **same line as the name**, at 26–30 px, with the name on the left and the number ranged
right in each card. The columns follow the space that is actually left — two, three or four
across — and a card never shrinks below the size a number stays legible at.

*The posts, written the way the department writes them.* **Lab Technician** replaces
“Laboratory Technician” for Patrick, Bernadette and Jeanne Claudine; **Beatrice stays the Lab
Technologist** — she is the only one called that; **Jean Paul is the Lab Quality Manager**;
**Dieudonné is the Lab Safety Officer**. The manager keeps *Laboratory Manager*, and the duty
codes behind the posts (quality manager, safety officer) are untouched, so role-targeted
training still finds them. The same wording is used on the screen, on the sheet, in the
training pickers and in the sign-in title.

---

## What changed in 6.9.56

**One month, one row per person.**

The working plan could end up holding the same member of staff five times over in a single
month. The cause was a repair written in 6.9.46: to rewrite the old leave letters it collected
*every* row of *every* archived version and pushed them into the plan in force, so a month that
had been regenerated a few times ended up with one copy of the roster per version — each name
repeated down the sheet, each day repeated across it.

The line that appended those rows is gone; the letters are rewritten on a list, and nothing is
added to a plan by it. Every stored month is now put back into shape on load — the first row
for each name kept (that is the row in force), the copies dropped, a repeated date dropped with
its column, and a row of the wrong length padded or trimmed to the days of the month. No shift
is moved and no leave is touched by the repair, and it is safe to run on a plan that is already
in shape: nothing changes. The staff list is de-duplicated by id in the same pass.

The working plan also refuses to draw a name twice, so a plan that reaches the screen damaged
still reads as one row per person.

---

## What changed in 6.9.55

**The roster answers to the department, not to the generator.**

*The manager's own thirty days.* Kelvin's FY 2025/26 annual leave was never on the register —
the year before it held no leave at all, so the book had nothing to carry and silently showed
zero. The thirty days are now recorded where they belong: **from 16 November 2026, running the
full thirty days to 15 December**, charged back to **FY 2025/2026**, the year they were earned
in. This year's own entitlement is untouched. A leave block can now name the year it is charged
to, and the leave-plan form offers ten, fifteen, twenty and thirty days in one click.

*The working plan reads the annual-leave plan.* The manager's row is painted AL from the 16th by
itself, and **Fill the leaves** on the working plan writes every block in the register onto the
cells it covers — the fallback for a month whose plan could not be read, and one click when a
new block is entered. Hand edits made afterwards still win.

*The order the roster is read in.* Kelvin first (he signs it), then Jean Paul, Dieudonné,
Beatrice, Patrick, Bernadette, Jeanne Claudine, and Aurelie last — she is the weekend
technologist, so her row only ever carries Saturday and Sunday. Rows are read in that order on
the screen and in the stored plan, and any new name joins at the end of the bench, never above
a named row and never below the weekend one.

*November’s nights are shared.* Dieudonné was carrying the nights with Bernadette; **Jeanne
Claudine now takes her share** (two at a time), and **Jean Paul takes none at all while he is
acting for the manager** — the acting manager is the manager for every roster rule. Beatrice
keeps the conditions set for her: days only. Three-night blocks now go to whoever's own ceiling
allows it and whoever is carrying the fewest nights, instead of being reserved for one name.

*RBW means one thing again.* **Rest Before Work** is written only where **nobody covers the
weekend**: the person who carries both weekend nights is owed a day, and it is taken on the
**Friday before** the weekend duty — not on the Tuesday after — so Tuesday, a heavy clinic day,
is worked. The mechanical second day off after every block of nights is gone; the only RBW ever
added the old way was the one Patrick should not have had.

*Who requests the lab commodities.* Next to the name that signs it: **Service requisition** —
the Monday request to the main pharmacy for the whole week's commodities. In October it sits
against **Kelvin**; in November, while he is away, it moves to **Jean Paul** and says *acting*.
The printed sheet carries the same mark, so the paper matches the screen.

*Blocks in one click.* Tapping a cell now offers **two or three days** and **two or three
nights** as single buttons, plus the annual-leave blocks (10 / 15 / 20 / 30). Tapping **AL**
fills the next **fifteen** fields, so a block is a click plus an adjustment; a block of another
kind already recorded in the register is never overwritten by it.

---

## What changed in 6.9.54

**An off-site repair starts with the day it left.**

Setting an analyser to *Off-site repair* only changed a word on a card: nothing recorded when
it went, so "how many days did the repair take" had no answer — the downtime figure could be
read off the ledger, but the round trip to the supplier could not.

Choosing **Off-site repair** in the equipment form now opens the case properly. It asks for the
**shipment date** — the day the analyser left — and, if one is free, which **backup analyser**
covers it; the case cannot be saved without that date, because a clock with no start records
nothing. The form then counts out loud: *“Out for 9 days so far.”*

The mirror side is closed too. Changing the status away from Off-site repair asks for the
**return date**, writes it on the same case and records the repair time; a case can never be
left open by accident. The return form does the same thing with the same numbers.

The days are then visible wherever the question is asked:

- the fleet card and the off-site banner read *“Off site since 8 Oct · 9 days out”*;
- the curative ledger shows downtime **and** *“9 days out so far”* or *“9 days to repair”*;
- the asset drawer carries a **Repair time** figure and each case says *“repair took 9 days”*;
- *Open off-site cases* prints the mean, fastest and slowest turnaround across returned cases;
- the register export gained **Last shipment · Last return · Repair days · Off-site cases**.

Nothing is back-filled: an analyser already off site with no shipment date keeps an empty one
until somebody opens its record and gives the day it left.

## What changed in 6.9.53

**Names are given name then family name, and the given name is one unit.**

The roster split every name at the first space, so the week grid and the night row printed
**Jean** in the dark weight with *Paul NSENGIYUMVA* faint underneath — a first name that does
not exist and a surname that is not his. On the printed plan the same split printed “Jean”
over “Paul NSENGIYUMVA”, and a narrow column cut a long three-part name off at the first given name.

In this register a person is given name(s) followed by the family name: **Jean Paul
NSENGIYUMVA**, **Jeanne Claudine UWAYISABA**, **Jean de Dieu SIBOMANA**. Everything before the
last word is the given name — one unit, whether it is one word or three. One helper now does
that split everywhere (`nameParts`), so:

- the roster grid, the week grid, the night row and the balance card draw the given names in
  one unbreakable span with the family name in the heavier weight beside it;
- when a name must wrap it breaks **between** the given names and the family name, never
  inside “Jean Paul”, and never with an ellipsis through the surname;
- the printed monthly and weekly sheets set the given names on one line with the family name
  under them, in the same order;
- avatars read **JN** for Jean Paul NSENGIYUMVA, **MU** for Jeanne Claudine UWAYISABA — the
  given name and the family name, not two given names;
- chips and chart labels that used to show the first word now show the given name whole
  (“Jean Paul”), with the full name on hover.

Nothing changes at the record level: names are stored and exported exactly as they were
entered, and the full name stays in every tooltip.

## What changed in 6.9.52

**A blank cell means at home.**

The working plan is the register of who is on duty. A day with an empty cell was being
filled in from the person's contract pattern, so somebody the plan had deliberately left off
the duty was drawn on the dashboard as **On day duty** — counted in "on duty now", counted in
the day cover, counted in the night crew. He is at home; the plan said so by leaving him out.

A blank cell on a plan that covers the day is now an answer, not a missing one: *At home*,
source **Working plan**. A person the published plan does not list at all is in the same
position — not on the duty that was drawn — and reads *At home* too, with the omission visible
rather than hidden behind a guessed shift. The contract pattern speaks only when no plan covers
the day at all, which is what it was always for. Leave, `OFF`, `W` and `RBW` read as before.

## What changed in 6.9.51

**A phone gets the whole screen; PBF shows the scorecard the register holds; a visitor's
refused key now says which key was refused.**

*The bottom bar.* The Kinyarwanda titles under the four icons are gone — a symbol is read
faster than a word, and the word never fits under a thumb. Each button keeps its name in the
tooltip and the aria-label, so a screen reader still says *Dashboard*, *Samples*, *Plan*,
*EQA*. The bar now rides down with the page and comes back on the first upward flick, and it
always returns at the very bottom, where the next thing a thumb wants is the next screen.
The upper-left hamburger is removed outright — the bar already reaches the four screens it
held, and the last symbol in the bar is an **upward arrow** that lifts the full module list
over the page. All fifteen routes stay one press away; nothing is behind a hamburger any more.

*PBF evaluation.* The screen was empty on every device. The v6.7 correction stopped the
aggregate district rows being turned into invented question marks — correct — but it also
left the page with nothing to show: four visits waiting for marks, an index of 0 %, no trend.
The domain scorecard the register actually holds is evidence, so it is what the screen now
prints: each centre's six domain percentages and its recorded index, ranked, with the row
saying **recorded scorecard · question marks still to be entered**. The trend draws one
observation per centre per quarter from the marks where they exist and from the recorded
scorecard where the questions are still blank; a quarter nobody recorded stays a gap, never a
zero. Nothing is filled in on a centre's behalf: the four confirmed visits keep empty answers
and stay in the *awaiting marks* queue.

*The visitor's read.* The 401 sentence blamed a trailing space or quote in the key. That was
wrong — the key in `shared.js` carries neither — so it sent people looking in the wrong place.
The message now names the project, the shape and the length of the key that was refused
(`sb_publishable…t3NC (43 characters)`), so it can be compared with Project Settings → API keys
in one glance. Two real fixes sit behind it: the anonymous sign-in is retried once with the key
as the **bearer token** (both header conventions exist in the wild), and if the sign-in is still
refused while the register itself answers a key-only GET, the visitor reads the real register
that way and the strip says so. Settings → Data & sync gained a **visitor route** check that
reports exactly what a phone in incognito would get.

## What changed in 6.9.50

**A person who leaves keeps their leave in the book.**

Diane took her thirty days of FY 2026/27 from 13 July to 11 August 2026 and left two days
later, on 12 August. The plan book only listed people still on the establishment, so her
block — the one the archived working plans show running to the day she left — had dropped out
of the year it belongs to.

The book is a record, not a rota. It now carries anyone who has leave charged to the fiscal
year being shown, whether or not they are still on the bench: Diane keeps her row, marked
**left 12 Aug 2026**, with her block reading **Attended**; the timeline carries her too. A
person who left with no leave in that year — Faustin, whose last block was in 2025/26 — is
not carried in, so the book stays a record of the year and not a list of everybody who ever
worked here.

## What changed in 6.9.49

**The screens fit, the holiday is rostered, and the leave book reads in turn order.**

- **A public holiday is worked like a weekend.** One name on the days, one on the nights,
  every other cell blank. The duty alternates — a count of holidays worked, carried over from
  the month before, with a rota that turns one place each time — so it is shared fairly and
  not restarted every month. The manager is never put on a holiday unless he has chosen to
  work them (`worksHolidays`). A holiday night is a single duty: it never runs on into the
  working week and quietly turns a two-night block into three.
- **The manager's own leave belongs to FY 2026/27.** His thirty days (19 November – 18
  December 2026) are his own turn in the year he takes them, the turn after Aurélie — not a
  carry-over from a year whose leave was never recorded. The stale fifteen-day block that
  would have double-booked the same thirty days is gone.
- **A carry-over is only counted when the year it came from was recorded.** The previous
  fiscal year was being looked up under the wrong label, so every person appeared with thirty
  days carried in. The lookup is fixed: Patrick's fifteen unused days of 2025/26 still carry,
  and nothing is carried for the people whose previous year holds no records at all.
- **Leave & timeline is in turn order, and every block says what happened to it.** The plan
  book opens with the person away now, then the next to go, then the people already gone.
  Aurélie reads **On leave**; Patrick reads **Attended a carry-over of 2025/26** and
  **Attended 1st installment**; Diane reads **Attended**. A carry-over is never numbered as an
  installment of the year's own entitlement. The timeline rows follow the same order.
- **Every screen fits, and no card is left holding dead space.** A card fills the row it sits
  in — its body takes the slack, its foot stays on the floor — and a long table stops at the
  fold instead of running past the screen. The referred-samples register takes the full width
  with its three lists in one row under it, instead of eight columns beside a tall column and a
  narrow box at the foot. The dashboard measures the width of its own column, so collapsing
  the rail or turning a module off re-packs the cards instead of leaving a column of nothing.
- **PBF evaluates health centres only.** Ruli DH is the hospital laboratory that does the
  assessing: it is out of the index, the scorecards, the calendar, the plan and the visit form.
- **Posts are held by name.** Jean holds the laboratory quality post and Dieudonné the
  safety post. The training queue now calls out the posts — manager, quality manager, safety
  officer — above the lobby, labelled *called by role*: training aimed at a post goes to the
  person who holds it and they never wait in the FIFO queue for it. The schedule form asks who
  a session is aimed at and ticks the holder.
- **Two columns where one was wasting the page.** The EQA per-scheme scorecard is a band of
  half-width scheme tables rather than one full-width stack; the training history is laid out
  in two columns; the PBF quarterly index shares its row with the quarter-on-quarter trend; and
  in Quality the continuous-improvement and non-conformance cards join ISO readiness in one
  row so the KPI trendlines get the full width.

## What changed in 6.9.48

**The working plan is built the way the department works it, in their own words.**

- **One name on the night — never two.** Every night of the plan carries exactly one
  person, and the coverage ledger now proves it day by day.
- **A night is two or three nights, never one.** The plan hands out blocks of two, or of
  three for the two contracted for it (Patrick, then Jean Paul). A single night never
  appears unless it is chosen by hand. A fourth night in a row never happens.
- **The weekend carries one on the days and one on the nights.** Saturday and Sunday go to
  the same two people on the same shifts. Every other weekend cell stays blank — nobody is
  rostered at the weekend to fill the grid.
- **Only the weekend technologist works day + night**, and only at the weekend. When she is
  away the weekend is split: one takes both days, another both nights, never a `DN` for
  anybody else. The day worker is off the Friday before and the Monday after; the night
  worker is off the Monday after and rests before work on the Tuesday.
- **Each month takes over the week the month before already wrote**, and runs at least a
  week past its own end. The first days of a month are therefore already planned while the
  monthly reports are being written — that week is the buffer — and a night block is never
  cut in half by the turn of the month.
- **The manager works the bench.** He is on the day shift, Monday to Friday, like everybody
  else: no nights, no weekends, no public holidays — and never a month of his own off. The
  November 2026 draft that showed him off for four weeks is rebuilt.

**The table fits the page.** The month grid is drawn to the width of the screen — every day
of the run, no sideways scrolling, and no second column of names left floating over the grid
while it scrolls. Coverage and balance now sit underneath it, side by side where the screen
is wide enough: coverage as a tile for every day of the run (day staff / night staff against
what is required), balance as a name-by-name ledger of nights, weekend days and public
holidays. The Balance card used to be drawn empty; it now carries the numbers.

## What changed in 6.9.47

**Every month the workbook holds is now read into the console — sheet by sheet, straight from
the source.**

The workbook (*Work plan - Lab.xlsx*, 26 tabs) is read directly rather than off photographs.
Each month is transcribed cell by cell into `assets/data/plan-archive.js` and installed as a
**transcribed record**: never *Official*, never printed as signed, and never overwriting a plan
that is in force.

- **Twenty-one months are in:** January, February, April, May, June, August, September,
  October, November and December 2024; every month of 2025 except June. The workbook has no
  tab for March or July 2024, and none for June 2025 — nothing is invented to fill them.
- Where a month has two tabs (the original and a revised one, or an older and a "New" one), the
  later tab is the one kept: `Jan 25 Revised`, `Sep 25 - Rev`, `Sept 24 Revised`,
  `New May 2025`, `New Dec 25`.
- Every row keeps its blanks, its mentorship days, its trainings, its rest days, its day-and-night
  weekends and its leave **exactly** where the sheet puts them, from the first date the sheet
  covers to the last cell it fills. The 2024 sheets run past the end of their month, into the
  next — that tail is kept too.
- **The paper's letters are translated to the standard set** on the way in:
  `IL` → **CL**, `SICK` → **SL**, `MAT` → **ML**, `Tr` → **TR**, `Ms` → **MS**, `RWB` → `RBW`,
  `-` → **BE**, and from the French sheets `J`/`GJ` → **D**, `GN` → **N**, `JN` → **DN**,
  `R` → **OFF**, `CO` → **AL**, `FO` → **TR**, `A.C` → **TR**.
- **`BE` — before employment** is a code in its own right: Jean Paul's first two days of February
  2025, Dieudonné's first days of September 2024. It is not leave and never draws on the thirty
  days.
- A month is re-installed only when its content changes (each carries a stamp), so reading a
  sheet again updates that month and touches nothing else.

**From the sheets themselves**

- Beatrice's block on 4–7 and 10–12 February 2025 is **circumstantial leave (CL)**, followed by
  maternal leave to the 22nd — exactly as you said it should read.
- Diane's 5–7 May 2025 block, marked `IL` on the paper, now reads **CL**.
- Dieudonné is on annual leave from 8 September 2025 to 6 October, across the month's edge.
- Elie, who is on the 2024 sheets only, has his 26 days of `CO` read as annual leave and his
  weekend `JN` as day-and-night; Siladji, also only on the 2024 sheets, keeps his own roster.

## What changed in 6.9.46

**One set of leave letters, the department's own: `AL · ML · PL · SL · CL · AA · H · WD`.**

- **AL** annual · **ML** maternal · **PL** paternal · **SL** sick · **CL** circumstantial ·
  **AA** authorised · **H** public holiday · **WD** work desertion / unauthorised absence.
  The same letters now appear on the plan, in the cell picker, on the leave screen, in the
  leave register and on anything printed.
- Only **AL** is drawn from the thirty days. ML, PL, SL, CL, AA and H are given, not taken from
  the entitlement; **WD** is recorded as what it is and never drawn from the thirty either.
- Everything stored under an older letter is rewritten once (SICK→SL, MAT→ML, IL→CL,
  COMP/STUDY/W/UNPAID→AA, ABS→WD). Nothing is dropped and nothing is counted twice — a record
  can no longer read as an unexplained absence.

**December 2025, read from the department's own sheet.**

- The **New Dec 25** spreadsheet was read cell by cell: eight names, 1 December 2025 → 11
  January 2026 (42 days, because the sheet runs on into the new year), and it is on file as a
  **transcribed record** — not a published plan.
- The manager's sixteen days of annual leave, Patrick's opening three nights, Diane's leave into
  January, the RBW rest days and every blank are exactly where the sheet puts them.
- **Public holidays are written `H`** on a transcribed month, the way the paper shades them, so a
  closed day never reads as an unrostered gap: 25 and 26 December, 1 and 2 January.
- A month that only existed as a generated draft is replaced by the record (the draft is kept
  under plan versions); a plan in force is never replaced.

## What changed in 6.9.45

**`IL` on the 2025 working plans is circumstantial leave — the leave the department gives
when a member of staff loses their spouse or a close relative.**

It was being read as an unexplained absence. It is not one:

- `IL` now carries the label **Circumstantial leave** everywhere it can appear — the roster
  legend, the shift picker on a cell, the leave screen, an exported register.
- It is **authorised leave**, not annual leave: it never comes out of anyone's thirty days,
  and it is never counted as an absence or held against attendance.
- An authorised absence (`AA`) is treated the same way.
- The chip on the grid has its own colour, so a circumstantial-leave block is visible at a
  glance on the months transcribed from the older sheets — including Beatrice's February 2025.

## What changed in 6.9.44

**While the weekend technologist is away the weekend is worked by two people — and the
month they worked is rested around, not just after.**

- **The weekend split.** When the weekend technologist is on duty the weekend is hers alone,
  day+night (`DN`), as before. When she is on leave the weekend is worked by **two** people:
  one takes the Saturday and Sunday **day** shifts, a different one takes the Saturday and
  Sunday **nights**, and the same pair holds both days.
- **Only the night is rested straight after it.** The night technician is off on the Monday
  and on rest-before-work (`RBW`) on the Tuesday. The day technician is off on the
  **Friday before** — so the week never runs seven days — and off again on the **Monday
  after**, the two offs that cover the two day shifts worked at the weekend.
- **Rest now takes priority over the shift pattern.** A day-only technician used to be
  written straight to `D` and could work the weekend and then the whole week; rest is now
  decided first, so a weekend on duty can never run into seven days of work.

**The working plans on file are being transcribed into the console.**

- A new archive (`assets/data/plan-archive.js`) holds the department's paper plans month by
  month, read off the photographs cell by cell. **September 2025** is in it: eight names as
  the sheet prints them, 1 September to 5 October, 35 days, with the leave, the training, the
  nights and the blanks exactly where the paper puts them.
- A transcribed month is installed **only where the console holds no plan for that month** —
  a plan in force is never overwritten — and it is labelled **Transcribed**, never *Official*.
  It is a record of what the paper said; it is not proof that the department published it,
  and it is not printed as if it had been.
- `Ms` (as printed on the 2025 plans) and `Mc` (mentorship in outbreaks surveillance and HIV
  service delivery) are now in the code legend, so the older sheets read as they were written.

## What changed in 6.9.43

**The weekend belongs to one person, the month is read in order, and the leave screen says
who is away today.**

- **The weekend is one duty, not two.** Saturday and Sunday are covered by the weekend
  technologist on day+night (`DN`); a weekend is never split between one person on the day
  and another on the night. If she is on leave, one fallback technician takes the whole
  weekend rather than two people sharing it. Nights are chosen a week at a time — one holder
  for Monday–Wednesday, one for Thursday–Friday — and the week's nights step around the
  weekend on both sides, so nobody runs a fourth night. The Monday after a weekend on duty is
  a rest day and the Tuesday is rest-before-work (`RBW`).
- **Only the people working the weekend carry a code.** Every other weekend cell is blank, so
  the grid reads as a roster and not as a wall of `OFF`. Annual leave, sickness and training
  are still written on the weekend — an absence is not a shift.
- **The carried-over leave: thirty days from 19 November 2026.** The whole FY 2025/26
  entitlement was left unused, so the block now runs 19 November → 18 December, back on the
  19th, marked `autoEnd`. The two days once pencilled for 8–9 December sit inside that block
  and are part of the same thirty — the shorter seeded row is removed rather than counted
  twice.
- **The leave screen names who is away now.** A strip at the top of every leave tab shows the
  person, the type of leave, day *n* of *total* with a progress bar, days used, days left and
  the expected return date.
- **September 2026 read again against the sheet on file, cell by cell.** Every row already
  matched the printed sheet; one row did not. Patrick's annual leave runs to 1 October, the
  2nd is a single day, the weekend of 3–4 October is blank because that weekend belongs to
  the weekend technologist, and his two nights start on 5 October. The six cells at the tail
  of that row now say exactly that.
- **The plan book is in time order.** Running leave first, then the next block ahead,
  then those who have already taken theirs, listed last.
- **Wide tables fit the card they sit in.** A content-aware fitter measures each table card
  after render; narrow cards are capped to their natural width instead of stretching, and wide
  ones scroll inside the card — horizontally on a phone, never overflowing the page.

---

## What changed in 6.9.42

**A draft becomes the plan in force only when the department publishes it.**

Until now a month could be *transcribed* as official but a reviewed draft had no way to become one —
the November draft could be read and edited but never signed. The roster header now offers **Publish
plan** on any month that is not yet official. Publishing:

- asks first, and names who will appear as prepared, verified and approved;
- records `publishedBy` and `publishedAt` on the plan and rewrites the label to *Official <month> —
  published by <name>*;
- keeps the version it replaced in `workingPlans[mk].versions`, restorable as before;
- turns the sheet from `DRAFT — for review, not yet published` into the signed calendar, with the
  three signature blocks unchanged;
- is written to the audit trail (`roster.publish`).

*Generate draft* still rebuilds a month from the rules at any time, and an official month still asks
before it is replaced.

---

## What changed in 6.9.41

**November 2026 exists, built from the rules and the record — and the sheet now reads
like the department's own plans.**

### The November plan
The department's plan for November 2026 had not been written down. It is now built once,
as a **draft**, from the rules the bench works to and from the record of August 2026 and
November 2025: Mon–Wed carries the three-night block, Thu–Fri carries a two-night block,
Saturday and Sunday belong to the weekend technologist, and the manager is off from
1 November and on his carried-over annual leave from 2 November to the end of the month,
exactly where the leave register already puts him. Patrick holds three blocks (10 nights),
Jean Paul the other one (3 nights), Dieudonné and Bernadette work two at a time, Beatrice is
on days, nobody runs a fourth night.

It is a **draft**: the roster header says so, the sheet prints `DRAFT — for review, not yet
published` across its face, and nothing is published until the department reads it. Any cell
is editable by clicking it, and *Generate draft* rebuilds the month the same way.

### The sheet follows the record
Every plan the department has kept names the post under the person. The monthly sheet now
prints **role under name** (Laboratory Manager, Laboratory Technologist…), keeps the three
signature blocks (Prepared / Verified / Approved), the key strip and the holiday line, and
adds the two codes the paper plans have always used: **RBW — off duty (rest before work)**
and **AA — authorised absence**. Both are offered in the shift picker and read correctly in
the dashboard and the roster ("Rest before work", "Authorised absence").

### Still open
The nineteen months of plans sent as photographs are the **record**, not yet the register:
they are not transcribed into the app, because a mis-read cell would become a false
attendance record. Say the word and a month (or a whole year) can be entered cell by cell
and checked against the photographs before it is saved.

---

## What changed in 6.9.40

**The bench asked for eleven things; these are the ten that can be done without guessing.**

### Annual leave takes a number of days
Both leave forms — the plan editor and the request form — now ask for **Number of days**. Typing a
number moves the end date (`from + days − 1`); editing the end date recalculates the number. The
summary line under the form and the fiscal-year charge follow whichever was typed last.

### Briefing removed
The dashboard hero no longer offers *Briefing*, and the exporter behind it (and its command-palette
entry) is gone. Register sample and Build manifest remain.

### Cards that fit their data
*Priority worklist* and *Live activity* were pinned to the full width of a two-column screen, so six
narrow columns of table and a handful of feed lines sat in a wide empty band. Both now take **half a
row**, and neither `.duty-fill` nor `.feed-fill` stretches to the height of a taller neighbour any
more. The *TAT compliance by receiving laboratory* card on the samples screen is wrapped in
`.fit-card` and capped at 760 px for the same reason: three rows do not need the whole screen.

### Five tests that are never referred, removed
Sputum AFB (Ziehl-Neelsen), CBC, Malaria RDT, Fasting Blood Glucose and Blood Slide for Malaria have
left the referral menu, the reference ranges, the culture panel and the generator. On first load of
6.9.40 every stored order carrying one of them is removed (`meta.neverReferredV6940`), and the
number removed is recorded on the device. The referral menu is the ten tests that are actually sent.

### TAT starts at reception
`S.tatFor` used to count from collection at the health centre, so a specimen that travelled
overnight spent those hours against the receiving laboratory. The clock now starts at the **reception
stamp** (`receivedAt`), with `S.tatStartOf` naming which stamp it used. The register wizard and the
record editor both take reception **date and time**; a specimen that has not arrived has no clock at
all and is shown as *awaiting reception* instead of a countdown or a breach. Records written before
this version carry no reception stamp; where the status or the dispatch date proves the specimen was
received, the clock runs from collection and the record says so rather than pretending otherwise.

### One bottle per blood culture, and no invented consumption
A blood-culture order draws exactly one bottle: the **paediatric/neonatal** bottle at fifteen years
or younger, the **adult** bottle above that. The movement is written to the distribution log with the
order's id on it, so deleting the order returns that bottle and the undo draws it again. No other
registration consumes anything, and no transfer to a hospital is recorded unless someone dispatches
one.

### Reorder radar: the department's own ceilings
Monthly ceilings are now three HIV-EID cartridges, five VTM vials (transfers to health centres are
counted apart, because they leave the building) and three blood-culture bottles — about two
paediatric/neonatal and one adult, shown as a split on the ceiling row. The ceiling is compared with
the **last thirty days** of the distribution log, not a ninety-day average.

### Three-night blocks are earned
`generatePlan` and *Auto nights* only give a third consecutive night to staff flagged for it —
Patrick ISHIMWE first, Jean Paul NSENGIYUMVA on the weeks Patrick does not take. Patrick carries two
weeks in three. Everybody else works two-night blocks, the weekend technologist carries Saturday and
Sunday day+night, and a generated month never runs four nights without a break.

### The weekly roster reads the working plan
`S.nightCover(iso)` is now the one answer to "who is on nights": a manual night in the unit roster
wins and is labelled *by hand*, then the working plan (a night code **or** a day+night code — the
weekend name was previously invisible), then the contract pattern, labelled as a pattern. The weekly
roster, the sheet preview, PNG, PDF, XLSX and print all read the same selector, and the night dialog
opens on the planned name and offers *Back to the plan*.

### Still open
The **previous clean working plan** for November was referred to but never arrived with the request,
so the November grid has not been transcribed or replaced. Send it (photo, PDF, XLSX or CSV) and it
will be entered cell for cell against the rules above.

---

## What changed in 6.9.39

**The phone shows the whole register, and Confidential is a word only a visitor reads.**

### Every order, all time
The referral samples list drew the first 90 rows and left the rest behind a "load more" step; a
phone that never scrolled the inner box therefore looked like it held less than the PC. The list now
draws **every order in the register, newest first**, and the footer names the span:
`147 orders shown · all time · from 30 Jul 2026 to 27 Oct 2026`. Each row carries the whole identity
line — name, patient ID, sex, date of birth or age.

### No Confidential for staff
`U.ptName()` answers a signed-in user with the recorded name. Where the register holds none — the
names the 6.9.30 migration replaced — it answers **—**, never the word, and the record offers
**Record a name**, which writes the name back onto the order (and its manifests) and audits it.
`Confidential` is now returned only to the public visitor.

### The phone catching up with the machine
- the referral samples header has a **freshness chip** (`Updated 4 minutes ago`); one press does a
  real pull (`SY.pullLatest`) and repaints, keeping the local copy as a restore point;
- opening the screen, or coming back to the app, asks for the shared copy when it is more than 20
  seconds old;
- a visitor session now **keeps polling** (`SY.visitorSync` — revision first, document only when it
  moved) instead of freezing on the snapshot read when they entered, and `SY.restart()` rebuilds the
  loop whenever a session begins.

## What changed in 6.9.38

**Ruli DH is the sending laboratory, and a manifest code always ends in four alphanumeric
characters.**

### Health facility on the manifest
The wizard's origin list started at the first health centre, so every order registered in the
console was filed under **Ruli HC** — and the manifest printed it. Now:
- **Ruli DH** is first on the list and the one selected by default; the health centres stay
  available for specimens collected there;
- a one-time correction moves console-registered orders filed as *Ruli HC* to **Ruli DH**, so
  existing manifests read `Ruli DH, Gakenke`;
- the appearance/edit lists offer Ruli DH as well.

### The manifest code's last four characters
`<code><YYMMDD><tail>` — the tail was the serial written in base 36, which for a young register is
`0001`, `0002`: a run of digits, with nothing alphanumeric after the date. The tail is now offset
into the letter range, so the first manifest of the day is **A001**, the tenth **A00A**, the
thirty-seventh **A011** — still ordered and still unique, always alphanumeric.

A one-time repair rewrites any stored manifest code that does not fit `<code><YYMMDD><4
alphanumeric>` — an old seed code, or one of those digit-only tails — from the manifest's own
creation date, the test on its samples, and a fresh serial. Nothing else about the manifest changes.

## What changed in 6.9.37

**What prints is what you see.**

- **Print / PDF now prints the node on screen.** With the preview open, the button hands the very
  `#manDoc` from the modal to the printer instead of rebuilding the sheet; with the preview closed
  it builds the same markup as before. The two cannot drift apart again.
- **The page prints as the sheet too.** While a manifest preview is open the console marks itself
  (`body.manifest-open`); the print stylesheet then hides the rail, the modal heading and the
  buttons, releases the scroll box, and puts the footer on the paper margin. This is the case that
  was failing on a phone, where `iframe.contentWindow.print()` prints the *page* rather than the
  frame — the page used to come out as the console, not as the sheet.
- **`U.print` prefers a window of its own** (which desktop and Android print correctly) and falls
  back to the hidden frame when a popup is blocked.
- **Module URLs are version-stamped** (`assets/js/modules/samples.js?v=6.9.37`). The service worker
  is stale-while-revalidate for modules, so after a deploy the first load could run the previous
  `samples.js` — the most likely reason a print could still show the older sheet. A version in the
  URL means a stale module is never served in place of the one that matches the shell.

## What changed in 6.9.36

**Names for the whole laboratory, Gram Stain and Cytology with every blood culture, and the bar code
back to its old shape.**

### Who sees a name
`U.canSeeNames()` now answers **yes for anyone signed in** and **no for the public visitor**. The
name typed on the order is read in the register, the record drawer, the manifest and the exports;
the visitor's read-only session still sees `Confidential` everywhere. Records whose name was erased
by the 6.9.30 mask read `Confidential` until the name is typed again — the old value was overwritten
on the device and cannot be read back by the app.

### Gram Stain and Cytology travel with a blood culture
- a blood culture is never ordered alone: choosing it ticks **Cytology** and **Gram Stain** (dashed
  border, marked as routine), and un-ticking it removes the pair;
- the test menu gains both entries (`CYT`, `GS`), added by migration on an existing device;
- the record keeps them in the order the manifest prints — `Cytology · Gram Stain · Blood Culture` —
  and the manifest's Test column lists them one per line in that order;
- the manifest card, the drawer and the CSV exports show the full list; the sample ID still comes
  from the culture (`RBC…`).

### The bar code, back to the way it was
The SVG code (which is what makes it print) is redrawn to the console's own proportions: a 34px
strip, 1px and 2px bars, 1.5px of air, a little extra gap every ninth bar, and the short bars at
seven tenths of the full height, all on one baseline — the code from before, in ink.

## What changed in 6.9.35

**The signature line is one line, the footer reads the way it always did, and the bar code keeps
its short bars.**

### One line for the three signatories
`Generated By <name>` · `Transported By <name>` · `Received By (at <laboratory>) ______` now sit on
a single line, spread edge to edge and never wrapped. The reception date — and with it the last
date on the sheet — is removed: the register holds the dates, the paper only needs who signed.
The small-caps labels and the navy names stay exactly as they were.

### The footer, the way it was
`Specimen Manifest Generated On: 26 Oct 2026 | Samples: n | Page 1/1`, centred, one line — now
fixed to the bottom page margin instead of sitting inside the sheet.

### Bar codes
`UI.barcodeSVG()` keeps the console's pattern in ink: every bar is drawn and the short ones are four
fifths of the full height, hanging from the same baseline, so the printed code looks exactly like the
one on the screen.

## What changed in 6.9.34

**The sheet prints what you see, the footer sits on the paper margin, and the signature area asks
only for the date of reception.**

### Barcodes that survive the printer
The console drew barcodes as CSS backgrounds; a browser drops background graphics on print, so the
bars vanished on paper. `UI.barcodeSVG()` draws the same bars as SVG rectangles — ink, not
background — and the manifest uses them on screen and on the printed sheet.

### The footer belongs to the paper
`Specimen Manifest Generated On: … | Samples: n | Page 1/1` no longer sits inside the sheet. The
footer is now a single line — `Triple packaging UN3373 · cold chain where required` on the left,
`Samples: n · Page 1/1` on the right — and on print it is fixed to the bottom margin on every page
(`.manifest-foot{position:fixed;bottom:0}`), not tucked inside the table.

### Signature area
- **Only the date of reception is asked for.** The generation date and the date of transport are
  gone — the register already holds both, and the driver's sheet has no business with them;
- each signatory keeps a full area: an uppercase label (`Generated By`, `Transported By`,
  `Received By (at NRL)`) over a ruled line for the pen, **Transported By** filled from the
  transporter chosen on the order;
- `Date of Reception` closes the block on its own line, aligned under the receiver;
- print stylesheet adds `print-color-adjust:exact`, keeps the signature block unbroken across pages
  and prints A4 landscape.

## What changed in 6.9.33

**The manifest sheet, corrected where it was wrong.**

### The patient name is on it
The name column reads the record: `U.ptName(sample)`, so the **Admin** sees the name that was
recorded on the order, and every other role still sees `Confidential`. A record registered before
the name was masked has no name stored — put it in the order (or Edit) and it will print.

### No code under the barcodes
`UI.barcode(code,{label:false})` leaves the bars bare. The manifest ID is printed once, in the band
above its barcode; each sample ID is printed once, in its own column. Neither is repeated under the
bars, on screen or on the printed sheet.

### The signature block lines up
Four lines, two columns, the dates in one aligned column:

```
Generated By: Kelvin SAMAHANI                 Date: 26 Oct 2026
Transported By: Patrick ISHIMWE               Date of Transport: ____ / ____ / ______
Received By (at NRL): ____________________
                      Date of Reception: ____ / ____ / ______
```

- **Transported By fills itself** from the transporter chosen when the order was registered (the
  manifest keeps its own `transportedBy` as well, written when it is generated);
- **Date of Reception** is on its own line beneath *Received By*, instead of being pushed to the
  right where the laboratory name wrapped it.

## What changed in 6.9.32

**Duplicates can be deleted, and the manifests that were invisible are back — in the October shape.**

### Delete selected
- ticking orders shows **Delete selected** beside **Clear** in the selection bar (Admin only; every
  other role does not see the button and the commit would refuse it);
- the confirmation states the count, names the sample IDs, and says when one of them is on a
  manifest — those are unlinked, the manifest itself stays;
- one `S.commit` removes the records and the audit trail keeps the fact of the deletion;
- the toast carries **Undo**, which puts the records back on the register *and* back on their
  manifest.

### The manifest view
- `#/samples?tab=manifests` — a **Manifests** tab beside the sample filter row, with a count chip,
  **Generate manifest**, **Export list** and a card per manifest: bold ID, title, receiving
  laboratory, sample count, tests, `Generated <date> · who`, then **View**, **Print / PDF** and
  **Delete**;
- the grid is newest first and repaints itself the moment a manifest is generated — the generator
  takes you straight to it, so a new manifest can no longer disappear;
- deleting a manifest removes only the manifest; its samples stay in the register.

### The sheet, restored to the first week of October
- both coats either side of the title over a gold rule, the ID above its barcode in a pale band,
  then `No · Sample ID · Health facility · Patient name · Patient ID · DOB · Sex · Test ·
  Collection date · Barcode`, then *Generated By / Transported By / Received By* with date lines;
- **Print / PDF** prints that same document on A4 landscape with its own stylesheet (the console's
  letterhead is no longer wrapped around it);
- every row still reads `Confidential` — the sheet and its CSV copy call `U.ptName()` without a
  record, whoever is signed in.

## What changed in 6.9.31

**The sample ID now means something, the name is the Admin's to record, and age comes from a date of birth.**

### Identifiers, read from the test that was chosen
```
sample     R + <test code> + MMYY + 4 digits      RBC10260001
           remote · blood culture · October 2026 · first sample of that month
manifest   <test code> + YYMMDD + 4 characters    BC2610270001
           blood culture manifest · created 27 October 2026 · alphanumeric tail
```
- the code is taken from the test menu entry (`S.testCode`), never from the hospital initials;
- the month and day come from the date, so the number reads without a lookup table;
- counters live in `meta.sampleCounters` (per code and month) and `meta.manifestSerial`, and are
  taken inside the same commit that stores the record — two samples can never share a number;
- the wizard's preview uses the real rule, so what you see on step 3 is what gets printed.

### The patient name
The mask is for everyone except the Admin:
- an **Admin** may type and read a recorded name; `U.ptName(record)` answers with it;
- **every other role** — Manager, Technologist, Reviewer, Viewer, visitor — is answered with
  `Confidential`, and the wizard shows no name field at all, only the reason;
- **every file** — CSV export, manifest, printed sheet — calls `U.ptName()` without a record and
  therefore always reads `Confidential`, whoever is signed in.

### Date of birth and age
- the wizard has a **date of birth** field; the age fills itself the moment a date is picked and the
  field locks while a date is present. Clear the date and the age can be typed again;
- the edit form has the same pair, and the record drawer shows both;
- `LSU.ageFromDob()` is the single calculation, so an age and a date of birth can never disagree.

## What changed in 6.9.30

**A patient is never named. The word is `Confidential`, everywhere, for everyone.**

This is a standing rule that had slipped: the register identified a sample by a person's name,
and the name travelled into the worklist, the record drawer, the command palette, the CSV, the
manifest, the print sheet — and the bundle served to the public.

- `U.ptName()` is the only thing that decides what a patient is called, and it answers with
  `Confidential`. Every screen, drawer, table, manifest, printed sheet and CSV uses it.
- **The register itself is cleaned.** A one-time migration in `normalize()` replaces any stored
  `patientName` with `Confidential` on load, so the value does not exist in `localStorage`,
  in the JSON backup or in the shared copy either. The seeded register was scrubbed too — the six
  carried-forward samples no longer contain a name in `seed.js`.
- **The wizard no longer asks.** Step 1 shows `Confidential` with the reason and takes the
  patient / insurance ID instead; that ID is what the bench and the manifest use. Editing a record
  shows the same read-only mask.
- Searching no longer matches a name; the command palette shows `sample ID · Confidential`.
- When the migration fires, the cleaned register is **published to the shared copy once**, without
  being asked, so the cloud does not keep the old names.
- Generated telemetry no longer invents names either.

What this does not change: patient / insurance IDs, sex, age and dates stay as recorded, because
they are what the referral actually needs.

## What changed in 6.9.29

**A visitor now reads the real register — and one tap on the profile is the way in.**

Incognito still showed no PBF data, because a visitor had no way to be given the project
address and key: the Data & sync card is one of the three surfaces closed to them. The public
coordinates therefore moved into the app itself:

- `assets/js/core/shared.js` holds the project address and the **publishable** key. A publishable
  key is public by design; the secret key is the one that must never appear there;
- a visitor session reads the shared register through those coordinates, in **pull-only** mode.
  Three separate things would have to fail before a visitor could write: the role has no `edit`,
  `store.commit()` refuses, and `sync.push()` now throws for a visitor as well;
- the strip says which copy is on screen — *Shared register · N PBF marks · read just now* — or
  names the reason it fell back to the sample copy, and gained a **Refresh** button;
- leave `endpoint` empty in `shared.js` to switch the read off entirely.

**The profile button is now two doors.** One tap opens the console as a visitor; three quick taps
open the staff sign-in screen; five taps on the crest still do the same. A single tap waits 420 ms
to see whether a second is coming, so neither gesture fires by accident. The old five-tap gesture on
the crest is unchanged, and the console's own crest still returns to the public page.

**What this costs, stated once:** while *Allow anonymous sign-ins* is on, the publishable key in
`shared.js` lets anyone who reads the page fetch the register — patient names included — without
opening the app. That is the same exposure the visitor view already had inside the browser, now
reachable from outside it. Close it as Part 8 describes; visitors then see the sample copy until a
read-only route is designed for them.

## What changed in 6.9.28

**"My PBF marks are gone in incognito" — answered with counts, not reassurance.**

An incognito window has its own empty `localStorage`. It starts from the built-in sample register
and cannot know the project address or key, so the work typed on the PC is not there. The marks
were never lost; they were in another browser. Three things now make that visible and fixable:

- **Two browsers, one register** (Settings → Data & sync): a table comparing *this browser* and
  *the shared copy* for samples, staff, leave, referrals, equipment, trainings, **PBF visits, PBF
  marks entered and PBF questions**. Press **Compare** to read the cloud side; the counts either
  match or they do not, with nothing to interpret.
- **Push everything now** publishes the whole register — every sample, roster, leave record, EQA
  round and PBF mark — behind a confirmation that names the counts first, and reports the revision
  Supabase stored.
- **Download the shared copy** replaces this browser with the cloud version, taking a restore point
  of what was here first.
- **Setup code** — *Copy setup code* on the working device, *Paste setup code* on the new one. It
  carries the address, publishable key, mode and anonymous flag as text; **it never carries a
  password** (the test decodes it to prove that).

**A guard against the worst mistake.** A browser that has never received the shared register used
to be able to publish its seed over a real cloud copy — one pending edit was enough, and the
background loop did it silently. That is exactly how "everything vanished" happens. The loop now
refuses when `lastPullAt` is empty, says why in the card, and leaves the cloud copy alone; the
explicit *Push everything now* is the only way to overwrite it from such a browser.

The guide gained **Part 9: Incognito, a new PC, a new phone**.

## What changed in 6.9.27

**A visitor is now a real Viewer: the register opens without a password, read-only.**

The overview page was still only a description. A visitor could not see the register at all.
Now the overview carries one button — *Open the register as a visitor — read only* — and a
visitor walks straight into the console with no account:

- **visible**: Command Center, Referred Samples, Stock, Training Roster, Working Plan, Leave,
  EQA, PBF, Quality, Equipment, and **Staff → People** (the whole staff register, with the
  workforce profile);
- **closed**: **Training Revenue**, **Settings**, and the **Data & sync** tab. Security Center,
  Design System and Premium Roadmap stay administrator-only. Closed means the tab or module is
  never built for that role — a URL with `?tab=data` falls back to People, and `#/revenue`
  answers with the reason and a Sign in button;
- **export and download stay open** for a visitor: register JSON, chart downloads, printable
  sheets — the `Viewer` role already had `export`, and it is the reason the role exists;
- **editing does not**. Every control that writes is gone from the visitor's screens, and
  `store.commit()` now refuses outright for a role without `edit`, so a stray button or a
  console call cannot write to the register or queue a change for the shared copy;
- the visitor session is kept in **sessionStorage**, so it ends with the tab and never becomes
  a stored login; `localStorage` holds no session for a visitor;
- a **strip above the topbar** states the view — *Visitor · read only* — what is closed, and
  offers **Sign in** and **Overview**. Signing in from it replaces the visitor with the real
  account and restores every module; leaving the visitor view needs no confirmation;
- an unauthenticated console link (`#/roster`, a bookmark) now opens that page **as a visitor**
  rather than a password wall; `#/signin` remains the staff door, and the five-taps-on-the-crest
  and three-taps-on-the-profile gestures still work.

Also fixed: the splash used the session captured when it began, so a sign-in that completed
during the animation could be overruled by the visitor path. It now reads the session when the
splash ends.

## What changed in 6.9.26

**The first screen is a public overview. The console's sign-in is a door, not a wall.**

Opening the app used to put a password form in front of everything, so a visitor — a health
centre, a district officer, a new member of staff — met a login box before they met the
department. Now:

- a bare address, `#/welcome`, `#/overview` or `#/home` shows the **public overview**: what the
  laboratory does, the five working groups, the eight health centres, the reference
  laboratories, and the telephone and email from the settings. It reads the register only for
  **counts** — no patient name is on that page;
- the sign-in screen is **not linked** from it. It opens after **five clicks on the crest**,
  **three clicks on the profile button**, or at `#/signin`;
- a deep link to a console route (`#/staff`, `#/roster`, …) still asks for the password, so
  bookmarks keep working;
- **signing out** now lands on the overview instead of a login wall;
- inside the console, five clicks on the rail crest reopens the overview, and the account menu
  has a *Public overview page* button;
- both gestures count keyboard activation too (Enter or Space on the crest or the profile), so
  the door is not mouse-only.

## What changed in 6.9.25

**No credential of any kind is published any more, and the README fits on one screen.**

The repository is public and the console is served from it, so anything written into the
source was public: an administrator username and password in the sign-in markup, a
one-press *Enter demo console as Lab Manager* button, the credentials printed under the
form, a table of every account and password in the README, plain-text passwords in
`auth.js`, and the one-time code in the 2FA hint.

- account passwords are now stored as **SHA-256 hashes** (`passHash`), computed by a
  dependency-free implementation in `auth.js`; the sign-in form validates against the hash,
  so the existing passwords still work and none of them appear in the source;
- `setPassword()` writes a hash and deletes any plain-text field; it refuses anything under
  eight characters. A record found in plain text is migrated on the next successful sign-in;
- the sign-in form starts empty, the demo button and the credentials strip are gone, and
  the 2FA hint no longer prints the code;
- the README was rewritten from 1,056 lines to about 130: what the app is, how to run it,
  how accounts work, what is and is not secure, the module map, the rules that must not
  regress, and where the detail lives. The version history moved to `CHANGELOG.md`;
- Security Center no longer calls the console a demo with demo credentials; it states that
  hashing keeps credentials out of the source but is still a browser-local gate.

Nothing was rotated automatically: the passwords were already public, so **rotate them in
Security Center** — the hash changes, the repository never does. Git history keeps the old
lines, which is exactly why rotation, not deletion, is the fix.

## What changed in 6.9.24

**Sync works — and the anonymous door is now measured out loud.**

An anonymous session is an ordinary `authenticated` session, so the policies in `schema.sql`
let it straight in, and the publishable key is public by design. That means while *Allow
anonymous sign-ins* is on, anyone holding the project address and the key could open a session
and read or replace the whole register — patient names included.

The app says so in the three places a person actually looks:

- **Check setup** gained a **Register privacy** row. With anonymous sessions on it quotes how
  many patient names are in the register right now and what to do; with a project user it does
  not appear at all.
- the **Cloud sync card** shows a warning strip in anonymous mode, naming the next step.
- the guide gained **Part 8 — close the anonymous door before real patients**: the ten-minute
  upgrade to a project user on every device, then the toggle off, then `Check setup` green.
- `supabase/schema.sql` gained a commented **hardening** block that makes the database itself
  refuse anonymous sessions (`(auth.jwt() ->> 'is_anonymous')::boolean is not true`), for when
  every device has a real user.

Nothing is lost by switching: the register lives on the device and in the cloud; the route only
decides who may open the door.

## What changed in 6.9.23

**A second device that refuses the password is offered the route that works.**

The phone was set to the project-user route with a password the project does not know, while
the PC runs on an anonymous session. Both are legitimate; they just were not the same.

- an *Invalid login credentials* failure now carries `badCredentials` and whether the project
  **allows anonymous sessions** (read from `/auth/v1/settings`);
- when it does, the failure card shows a one-press **Use an anonymous session** button: it
  switches this device, clears the unused password, creates the session, publishes or pulls,
  and starts the live loop — no retyping, no guessing;
- the wording now says *"use the same route as the other device"* instead of hinting at a
  menu;
- a password pasted from a note (trailing space, newline, stray quotes) is trimmed before it is
  sent — Supabase compares it exactly, and that is a silent, infuriating failure;
- the guide's Part 4 states plainly that every device should take the same route.

## What changed in 6.9.22

**Pull no longer asks for a column that does not exist.**

`supabase/schema.sql` stores the writing device in `client_id`, but `SY.pull()` and
`SY.remoteVersion()` selected `device_id`. PostgREST answered
`400 42703 column lab_registers.device_id does not exist` and every pull failed — including
the 2.5 s live check — so Save looked broken while the key and the table were both fine.

- one column list in one place: `client_id` is requested, and a row is normalised so
  `device_id` and `client_id` both read correctly for anything that looks at them;
- if a project still answers 42703 (a table built by an older schema, or one that has
  neither column), the pull retries with a lean list, so syncing keeps working and the card
  records what to fix instead of failing;
- a column error now marks the failure as a **schema issue**, and the failure card says to
  re-run the SQL;
- `schema.sql` gained an idempotent **repair** block (`add column if not exists` for
  `client_id`, `updated_by`, `revision`), so re-running it heals an older table;
- **Save** failures open the same card as a failed test instead of a toast that disappears.

## What changed in 6.9.21

**Every change is on the other device in about a second — nothing pressed.**

Two rhythms now keep a room full of devices on one register:

- **push** — a local commit schedules a push after `pushMs` (700 ms);
- **poll** — a background tick asks *only for the revision number* every `pollMs`
  (2.5 s), and pulls the document the moment it differs from the one this device last
  saw. A dozen bytes per check, not the whole register.

Both are silent. No toast per sync, no dialog, and no redrawing under a focused field:
an incoming change lands in the register immediately but the screen is redrawn when the
field is released (and never while a dialog is open). After a pull the pending-edit
counter is cleared, which is what stops two devices echoing the same document back and
forth.

**Conflicts during a live tick never ask.** The device with the visible edit publishes,
the copy it replaced stays in restore points, and the card records *"This device
published over a newer cloud copy"*. Pressing **Sync now** still asks.

The header pill now reports the truth — *Live · Synced just now*, *Syncing…*, *Offline —
queued*, *Sync error* — and the Cloud sync card gained a **Live sync** switch, the loop's
state, the last push/pull and any conflict note. Two tabs of the same browser now also
adopt each other's writes through the `storage` event.

`hasLocalChanges()` was rebuilt on the pending-edit counter; the old *"never pushed"*
fallback made a freshly-joined device believe it always had unsaved work, so it
overwrote the cloud instead of pulling.

## What changed in 6.9.20

**When the fix lives in Supabase, the app hands over the link to that exact page.**

A refused anonymous session used to end in a toast naming a menu. Now:

- `SY.authSettings()` reads the project's public `/auth/v1/settings` (cached for a minute,
  bypassed on an explicit **Test connection**), so a switch that is off is known **before** a
  request that is certain to fail. The error names the switch and carries the exact URL;
- `SY.dashboardUrl()` derives the project reference from the pasted address, giving
  `…/project/<ref>/auth/providers`, `…/auth/users` and `…/sql/new`;
- the Cloud sync card shows **Open Auth providers · Open Auth users · Open SQL editor** as
  buttons, so the switches are one click from the app;
- **a failed Test connection opens a card, not a toast**: the reason, with any URL made
  clickable, and a primary button *Open the page that fixes it*;
- sign-ups being disabled outright has its own message instead of looking like a password
  problem.

The guide's Part 4 says where the *Allow anonymous sign-ins* switch actually sits (its own
switch in the provider list, not inside Email) and warns that the check must be re-run after
flipping it.

## What changed in 6.9.19

**A missing table no longer looks like a wrong address — and the SQL is one press away.**

`https://<project>.supabase.co` is answered by PostgREST, so a project whose schema has not
been run replies `404 PGRST205 Could not find the table`. That arrived looking like *"the
project URL is probably wrong"*, which sent the reader to fix the one thing that was right.

`SY.ping()` now reads the body of a 404: `PGRST20x` / *Could not find the table* / *relation …
does not exist* means **the project answered and accepted the key — only the table is missing**,
and the message says so, with the two clicks that fix it. Any other 404 is still blamed on the
address. `SY.diagnose()` makes the same distinction in its table row.

The Cloud sync card also gained **Copy the table SQL**: it reads
`supabase/schema.sql` from the app's own files (no GitHub needed), shows it, and copies it for
the SQL Editor. `UI.copy()` was added with a `execCommand` fallback for browsers that refuse
the async clipboard.

## What changed in 6.9.18

**A setup check that names the mistake, and the answer to "where is Auto Confirm?"**

The Cloud sync card gained **Check setup**. One press asks the project four questions and
lists the answers with a tick or a cross:

1. is the project address right (and was anything like `/rest/v1` repaired?);
2. does the project answer, and does it accept the key — `GET /auth/v1/settings` is public,
   so it also reports two things nobody can see from the app: whether **email confirmations
   are on** (`mailer_autoconfirm`) and whether **anonymous sign-ins are allowed**;
3. can a session actually be created — a real password sign-in, or an anonymous one;
4. does `lab_registers` answer, or is the table missing.

The email-confirmation row is the one that ends the guessing: when confirmations are off the
check says *"every new user is confirmed automatically — that is why there is no Auto Confirm
user switch to look for"*; when they are on it says to tick the switch or confirm the user
afterwards.

An unconfirmed user also gets its own message now (*"Supabase found that user but it was never
confirmed…"*), and the table probe runs with whatever credential is available, so a failed
sign-in no longer hides a missing table behind it.

The guide gained the same explanation in Part 4 and three new rows in its error table.

## What changed in 6.9.17

**Two ways to get a Supabase session — and neither is your dashboard login.**

Signing into supabase.com with GitHub, Google or email only opens the dashboard. The
console needs a *user of the project*, which is why the app appeared to demand a
password nobody had. The Cloud sync card now says so in plain words and offers a second
route:

**Way A — a project user (recommended).** Authentication → Users → Add user, email +
password, *Auto confirm* ticked. The card calls these fields *Project user · email* and
*Project user · password*.

**Way B — an anonymous session.** One toggle in Authentication → Sign In / Providers, then
tick **Anonymous session** and leave the fields empty. `POST /auth/v1/signup` with an empty
body returns a Supabase session whose Postgres role is `authenticated`, so the existing
row-level policies work unchanged. The card states the trade-off: anyone with the
publishable key could create such a session too, so it is for setting up, or for a
register without patient identifiers.

The session (access token **and** refresh token) is now kept in `localStorage`, so a
reload reuses it instead of minting a fresh anonymous user — anonymous sign-ups are rate
limited per IP. An expiring session is refreshed with its refresh token before any
password is used, and a 401 retries once with a new session.

Errors now name the cause: *"Supabase does not recognise that email and password. This is
the app user from Authentication → Users, not the login you use on supabase.com"* and
*"Supabase refused an anonymous session — turn it on: Authentication → Sign In /
Providers → Allow anonymous sign-ins"*. Neither is dressed up as a network problem any
more. `docs/supabase-setup.html` Part 4 was rewritten with both ways.

## What changed in 6.9.16

**A pasted path in the project URL no longer breaks the sign-in.**

Supabase answered `404 — PGRST125 Invalid path specified in request URL` because the
project URL carried a path (usually `/rest/v1`), which turned the sign-in call into
`…/rest/v1/auth/v1/token`. PostgREST owns that prefix, so it rejected the path before
Auth ever saw the password.

`LS.sync.baseUrl()` now reduces whatever is pasted to the project address: it adds
`https://` when the scheme is missing, trims whitespace and trailing slashes, and strips
`/rest/v1`, `/auth/v1`, `/storage/v1`, `/realtime/v1`, `/graphql/v1` or `/functions/v1`
(and anything after them). A custom domain keeps its own path prefix. The address is
normalised both when it is saved and every time it is read, so a value already stored
on a device is repaired without anyone retyping it.

The error message now says what to do — *"the project URL has a path in it. Use only the
project address, `https://<project>.supabase.co`, with no `/rest/v1` on the end"* — and a
404 on the connection test points at the URL instead of the password.

## What changed in 6.9.15

**The new Supabase keys work — `sb_publishable_…` is sent on `apikey` only.**

Supabase now issues opaque keys (`sb_publishable_…`, `sb_secret_…`) instead of the old
`anon` JWT. Those strings are **not JWTs**, so the gateway rejects them when they arrive
as `Authorization: Bearer …` — which is exactly what the client did, meaning a freshly
created project answered *Invalid JWT* on every call.

`assets/js/core/sync.js` now classifies the key and sends it correctly:

| key | `apikey` | `Authorization` |
|---|---|---|
| `sb_publishable_…` | the key | the signed-in user's JWT, or nothing |
| `eyJ…` (legacy anon) | the key | the session JWT, or the key itself |
| `sb_secret_…` | refused | — |

The secret key never leaves Supabase: the connection test and the **Save** button both
refuse it with an explanation, because it bypasses row-level security. The Cloud sync
card now asks for the **publishable key** and links to the guide, which has been updated
to match the current dashboard (Settings → API Keys → *Publishable key*).

## What changed in 6.9.14

**Cloud sync can actually sign in, and there is a guide written for a ten-year-old.**

The row-level policies in `supabase/schema.sql` give the table to the `authenticated`
role, but the console only ever sent the anon key — so a correctly-built Supabase
project would still answer 401. The Cloud sync card now takes the laboratory's
Supabase **email and password** as well: the client signs in through
`/auth/v1/token?grant_type=password`, sends that access token on every read and
write, caches it for an hour and refreshes it once if the project answers 401.
**Test connection** proves the password instead of reusing an old token, and a wrong
password is reported as *"Supabase sign-in failed (400) — Invalid login credentials"*
rather than a vague network error.

New: [`docs/supabase-setup.html`](docs/supabase-setup.html) — the whole setup in
seven parts, in plain language, with the SQL ready to copy, checkboxes, and an
honest table of what each error message means. It is linked from the Cloud sync
card itself.

## What changed in 6.9.13

**The working-plan header follows the month.**

Choosing **Next** or **Previous** in the working plan moved the plan but left the month
label, the plan pill and the filter tabs on the month the page was opened on, because
only the body was redrawn. The header is now redrawn with the body, so the label, the
`Official · October 2026` pill and the stored-plan buttons always describe the plan
that is actually on screen. **Today** returns to the live month as before.

## What changed in 6.9.12

**Nights are a whole shift, new staff get a four-week orientation, and Beatrice keeps
Reception.**

### A night is not a day post

Anyone recorded on nights on a given day is removed from that day's roster before the
posts are built. The week view raises a breach if the plan still carries them:
*"<name> is on nights that day — a night is a whole shift, not a day post."*
The head-count that drives the post table counts only the people actually on day duty,
so a night shift never inflates the bench plan.

### Thirty-day orientation for a new staff member

A new staff member is on a four-week rotation, starting from the **Orientation begins**
date on their staff record.

| week | rotation |
|---|---|
| 1 | Phlebotomy on days 1–3, then Reception on days 4–5 |
| 2 | Haematology · Parasitology · TB |
| 3 | Biochemistry · Serology |
| 4 | a full member of staff — no fixed bench |

The end-of-orientation assessment is set on the **Wednesday of week 4**, or the Thursday
when the Wednesday would fall on or after the thirtieth day.

The rotation is applied before any other allocation, so it always wins. The grid marks
the week with a small `W1`–`W4` chip, the sidebar shows the day's bench and the count of
days left, and the printed weekly sheet carries a *Orientation — new staff on the
thirty-day rotation* note listing each name with their week and bench. Past thirty days
the person is an ordinary member of staff everywhere.

### Beatrice on Reception

When a person has a home bench and that bench is part of an open post, the post is given
to them: Beatrice takes Reception whenever a Reception post exists, instead of being
carried to Phytology or Biochemistry by turn order.

## What changed in 6.9.11

**The unit is staffed by posts, and the posts change with the number on duty — plus a
night week with three named owners.**

### Posts

A post is one person covering one or more benches. The manager is never counted in
the head-count, and is never posted on a day that carries more than his threshold.

| on day duty | posts |
|---|---|
| 6 or more | Reception · **Phlebotomy · Haematology** · Biochemistry · Serology · **Parasitology + TB** |
| 5 | Reception · **Phlebotomy + Haematology** · Biochemistry · Serology · Parasitology + TB |
| 4 | Reception · Phlebotomy + Haematology · **Biochemistry + Serology** · Parasitology + TB |
| 3 | **Reception + Parasitology + TB** · Phlebotomy + Haematology · Biochemistry + Serology |
| 2 or fewer | the same three posts, with **Biochemistry + Serology taken by the manager** |

Each post writes one name into every bench it covers, so the grid, the printed sheet
and the XLSX all agree. The thresholds are editable in **Post model**, and a *Posting
today* card names the posts and who holds each one.

### Nights

- **Mon–Wed** — one technologist does **three consecutive nights**; the two
  three-night technologists alternate week to week.
- **Thu–Fri** — a **different** technologist does two.
- **Sat–Sun** — the weekend technologist takes **day + night**, unless she is on
  leave; then the two-night technologist covers the weekend nights rather than
  leaving them open.
- Nobody is given a night their contract forbids (`nightPref`, `maxConsecN`,
  `maxNights`), that falls inside leave, or that would exceed the month's night
  count. The manager never takes a night.

*Auto nights* fills the week in one click.

## What changed in 6.9.10

**The weekly roster follows the bench contract — three rules, enforced rather than
hoped for.**

- **Reserve cover is never added to a busy day.** The manager is on the weekly roster
  only when the day's working plan carries **no more than two staff** (the threshold
  is editable per person). On any busier day he is not a candidate at all, and an
  earlier automatic placement is withdrawn on re-run. A manual placement on a busy
  day is flagged as a rule breach until it is either removed or recorded as an
  override.
- **Beatrice is never put on Biochemistry or Serology.** Those are hard blocks, not
  preferences — the old build had Biochemistry listed as an "occasional" bench, which
  is exactly what put her there. Phlebotomy is **alone-only**: allowed when she is the
  only person on the unit that day, or when a manager records an override. TB/Molecular
  stays blocked.
- **In a shortage the pair is covered by one person.** When a day has fewer staff than
  benches, Biochemistry and Serology are assigned to the same person **before** any
  other bench is doubled up, rather than leaving one of them empty.
- **Overrides are recorded, not silent.** Choosing someone a rule excludes asks for
  confirmation and a reason, then stores who and when against that cell. The cell
  shows an **override** badge, the printed weekly sheet marks it and prints a note
  naming the person and the manager, and the XLSX carries the same line.
- **Bench rules are visible and editable.** A *Bench rules* card in the weekly view
  lists every person's home bench, never-benches, alone-only benches and reserve
  threshold; clicking a line opens an editor. Auto-allocate reads the same data, so a
  correction is one edit rather than a code change.

## What changed in 6.9.9

**The word “first” is gone from under the health-centre names — on screen and in
every download.**

- The quarterly index printed a placeholder movement — `first` — beneath the rank of
  any centre with only one scorecard. It read as data and it travelled into the
  export. A movement is now shown **only when a previous complete scorecard exists**
  to measure against; where it does not, the line stays empty and silent.
- The rank `#1`, `#2` … still prints, and the row keeps its height so every name and
  rank in the strip shares one baseline.
- **Export ink is fixed, not inherited.** A downloaded sheet is white paper in either
  theme, so its text is drawn in the print palette. Previously, exporting from the
  dark (Ink) theme could copy the theme's near-white text onto white paper — a chart
  that looked blank even though it was drawn. Pale colours found while tracing are
  replaced with real ink.

## What changed in 6.9.8

**An exported chart is now the chart — not a blank sheet with a caption.**

- The Quarterly index download was a white page with only the footer line: the
  export rebuilt the picture by reading the live DOM, and the strip's colours and
  sizes live in CSS classes and custom properties that a downloaded file does not
  have. The index now carries its **own numbers** (`data-chart-model`): name, index,
  band, rank and movement for every centre. The download draws itself from that data
  on a fresh white sheet — grid, target line at 90 %, band colours, the percentage
  above each bar, the centre name below it, `#rank +movement`, the band key, the
  card's title and its one-line explanation, then the footer caption.
- **Line, area and scatter charts** export with every colour resolved (including
  CSS tokens that point at other tokens), real font sizes instead of `0.7px`,
  values instead of `var(--gold-600)`, and a solid finished line instead of the
  first 1-pixel dash of the draw-in animation. The invisible hit area and crosshair
  no longer print as a dark block.
- **The legend comes with the chart.** A six-line trend exported without it was six
  coloured lines and no names; the swatches and their labels are now drawn under
  the plot.
- **Tables export as tables** — a real header band, zebra rows, monospace numbers,
  band-coloured index pills and heat-tile washes rebuilt from the tile's tone and
  alpha. Interface columns (the Edit button) are dropped; the data stays.
- **Ring gauges** are redrawn from their own value and colour, with the card's
  explanation wrapped under the title instead of running off the sheet.
- **A card with nothing plotted yet** (an empty quarter) exports what it says —
  "no complete scorecard yet" — instead of an empty page.
- PNG downloads stay at **3×** and now fall back to the SVG file if a browser
  refuses to rasterise the canvas, so the button always produces a file.
- Every card — chart or table — keeps a PNG, an SVG, and CSV where there are rows.

## What changed in 6.9.7

**The quarterly index strip is as tall as its content — no centre is cut in half.**

- The strip was a fixed 172-pixel box, so the rank, the centre's name and its
  movement figure were clipped at the bottom: names read `Coko`, `Minazi`, `Rwan…`
  with their lower half missing. The box is gone; the strip now grows with its
  tallest column.
- Each bar has a fixed 118-pixel plot band of its own and is drawn at a **pixel**
  height, not a percentage of an auto-height column (which is what let the label
  fall outside the strip).
- **Every health centre name is printed in full**, wrapping to two lines where it
  needs to; all columns reserve those two lines, so bars, ranks and movement
  figures share one baseline. Long names are never truncated to a stub — the hover
  title still carries the centre, its index and its marks.
- With more centres than fit, the strip scrolls horizontally instead of squeezing
  the names into unreadable slivers.

## What changed in 6.9.6

**A download on every card, a plan you can correct, and compliance that knows the
difference between a missed visit and a missing vehicle.**

- **Every card carries one download control** — a chart becomes a **PNG** (3×) or a
  **vector SVG**, a table becomes **CSV**, and a card holding both offers all three.
  Because the control belongs to the card, a chart painted later (a trend, a tab
  switch, a KPI sparkline) can never be left without one.
- **The supervision plan is editable row by row.** Every plan row has **Edit** —
  planned date, quarter, assessor, state and the reason — so the calendar can be
  set to the M&amp;E schedule after the fact. A **reason** field records why a visit was
  late or not made: *assessor's side*, *no vehicle*, *no fuel*, *funds not released*,
  *roads impassable*, *other*.
- **Compliance counts only what the assessor controls.** On time = recorded on or
  before the planned date. Late and missed visits are judged; anything carrying an
  administration reason is shown as an **admin hold** and is excluded from the
  percentage, with the reasons itemised beside it. Recording “not visited” asks for
  the reason instead of assuming fault.
- **Plan and visits sit head to head** — plan on the left, quarterly visits on the
  right, the compliance arithmetic underneath reading across both.
- **The question bank is the last card and Admin-only.** Everyone reads the
  questionnaire; only an Admin can add, reorder, re-weight, move or retire a
  question, and every one of those actions checks the role.
- **The trend axis no longer puts the first quarter on the “0”.** The first and last
  x labels are anchored inside the plot, and the y-axis has room of its own.
- **The index strip prints no phantom zero.** A movement figure appears only when
  there is a previous scorecard to move from — a centre on its first visit reads
  *first*. The **N awaiting marks** chip is now a button: it lists every visit
  without a complete scorecard, how far each has got, and an **Evaluate** action that
  opens it with its marks.

## What changed in 6.9.5

**Charts you can download, a menu you can prune, and numbers that come only from
what was actually recorded.**

- **Every chart now exports both PNG and SVG.** The download control sits on the
  chart itself — line charts, bar charts, heat strips, ring gauges, capacity bars
  and the PBF index column — and appears as soon as the chart paints, including
  the ones drawn after an async render. Charts drawn in HTML are traced into real
  vector graphics at download time, so the SVG is a genuine picture of the numbers
  on screen, not a screenshot.
- **The test menu is now managed, not fixed.** Staff & Settings lists every
  examination by category with a **select-many → delete-selected** bar, a per-row
  delete, an on/off-menu switch and an *Add examination* form. Deleting removes it
  from the sample wizard and every picker; samples already registered keep the test
  name they were recorded with. Every change is audited.
- **Consumption is stated in months.** Each consumable can carry a **monthly
  ceiling** — “no more than five blood-culture bottles a month” — and the stock
  module shows the ceiling against the real 90-day usage average, the percentage of
  the ceiling used, and how many months of stock remain. A line past its ceiling
  turns amber, then red. Nothing is estimated: a line with no issues reads *no draw*.
- **Training records can be corrected and deleted.** Every row in the registry has
  edit and delete, and the record drawer carries both actions too. Editing fixes a
  wrong date, organiser or attendee list — the FIFO queue recalculates from the
  corrected dates. Deleting is confirmed, audited, and removes the session from
  every attendee's history.
- **Leave history is derived from dates, never from a label.** A leave record's
  fiscal year is the year its dates fall in, so a block can no longer appear under
  a year the person was not away in. The plan book now shows **carried-in days**:
  unused annual leave does not evaporate at the year boundary — it moves into the
  next fiscal year and is taken there, capped at one year's entitlement. Every
  fiscal year, including 2025/2026, can be opened and its blocks edited or removed.
- **EQA scores are read, not invented.** The quarterly composite is now the mean of
  the recorded scores in each round: schemes scored in % use the provider's figure,
  and SD-scored schemes use the provider's own criterion — |z| ≤ 2 satisfactory,
  2–3 questionable, ≥ 3 unsatisfactory. A passing round therefore reads 100 %, not
  a made-up “100 − z × 25”. Only quarters with a real score are plotted, and the
  axis opens at 90 % because nothing has ever been scored below 95 %.
- **A missing PBF score is a gap, not a zero.** The quarterly index chart no longer
  runs a line through 0 % for a centre that has not been scored yet: each run of
  real points is drawn on its own, an unscored quarter is left blank, the axis opens
  at the lowest recorded index, and 0 % is labelled for what it is — no marks
  earned. When nothing is complete, the chart says why instead of drawing empty axes.
- **Staff profiles lose competency and result release, and gain a photo.** The
  profile drawer now shows annual-leave position instead of the competency table;
  a camera button crops the chosen image square, scales it to 256 px and stores it
  on the staff record, so the face follows the person through cards, lists, rosters
  and printed sheets. The photo can be removed at any time.

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
