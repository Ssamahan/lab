# Changelog — Lab Systems

Newest first. Each entry says what changed and why, so a version can be justified later.

---

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
