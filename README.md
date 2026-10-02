# 🧪 Ruli District Hospital — Lab Systems v4 (Premium Command Center)

![Logo](assets/logo-square.png)
**Logo:** Gold blood drop #C9A84C falling from micropipette deep navy #0B1C3D — premium luxury, favicon in tab, animated boot (dropFall + glowPulse)

**🔗 Live App:** https://ssamahan.github.io/lab/
**📂 Repo:** https://github.com/Ssamahan/lab

Premium, luxurious, professional laboratory command-center — single-file HTML app (`index.html`), zero-cost, works on phone & PC, offline-first (localStorage) + optional live Firebase Realtime DB (free) + EmailJS real OTP email (free) — zero-cost.

Built for **Lab Manager: Kelvin SAMAHANI** | Email: registered Admin email
Verified by **Dr. Judson B. MUMBERE** (Clinical Director) | Approved by **Jean de Dieu SIBOMANA** (HR Officer)

---

### ✨ Design System (Premium Luxurious)

- **Colors:** Deep Navy #0B1C3D (primary), Soft Gold #C9A84C (accent — active nav, primary buttons, KPI numbers, chart highlights), Light bg #F7F8FC / White cards, Dark bg #000000 full black / Cards #111111, text #f2f2f2 readable
- **Status refined muted:** Warning soft amber, Critical refined rose, Success muted teal — excellent contrast both modes
- **Light/Dark Mode:** Toggle SVG moon/sun (Lucide stroke 1.8) with gold glow in top header with gold glow, 250ms smooth transitions, every module fully supports both
- **Spacing:** Strict 8px scale (4,8,12,16,20,24,32), Grid `repeat(auto-fit, minmax(min(100%, 280px), 1fr))`, gaps 16-20px, no random blanks, cards stretch equally
- **Typography:** Space Grotesk (kept), KPI 28-36px responsive 900 weight, chart labels ≥12-13px readable
- **Cards:** Soft multi-layer shadows, radius 12-16px, gold left accent on important, hover lift + gold glow
- **Charts:** Fully responsive, predefined bar spacing (gap 14px desktop / 8px phone), height by screen tier, gold highlights, clean tooltips, no tiny text — Bar, HBar, StackedBar, Donut, Line, Spark

---

### 🔐 Admin Login & Confidentiality

- **Default Admin:** Admin access — private credentials set by Lab Manager (contact Kelvin SAMAHANI for access)
- **Login Options:** Password + OTP (6-digit, 5 min expiry, mailto fallback) + Reset via Email OTP
- **Session:** 24h expiry, persists via sessionStorage + localStorage fallback
- **Viewer Mode (Staff):** 
  - Can view & download Working Plan & Roster (PNG/PDF/Excel/Print) — cannot generate/edit
  - **Confidentiality:** Patient names/IDs masked as `..... Confidential`, Training Revenue hidden, EQA editable only by Admin
  - All generate/edit buttons show 🔒 Admin badge and are disabled + toast `🔒 Admin only`
- **Delete Confirmations:** EVERY delete requires confirmation dialog (samples, manifests, stock, hospitals, health centers, consumables, tests, staff, trainings, leaves, holidays, absences, wishes, PT) — prevents accidental loss

---

### 📊 Modules

#### 1. Dashboard — Command Dashboard
- **KPIs (14):** Hemoculture bottles, VTM stock, Positivity/Negativity/Rejection rates, Total/Pending samples, Training coverage, Upcoming trainings, Avg wait, Active staff, Night coverage, On leave now, Next holiday (1994 Genocide against the Tutsi Memorial Day)
- **Visualized with Charts (8):** Trainings per staff (HBar), Most referred types (HBar), Referral per hospital (HBar), VTM per HC (HBar), TAT avg vs expected (Bar), Age distribution (Bar), Sample Status Donut (Pending/Positive/Negative/Rejected/Done), Night Coverage Trend (Bar), Daily staffing trend — September 2026 aggregated by week (StackedBar compact 190px), Master Timeline FY 2026/2027, Pending aging list

#### 2. Referred Samples — Referred Sample Management
- **Action Dashboard (calling for action):** All orders, Pending orders (overdue), Positive, Negative, Done + buttons Register sample, Generate manifest, View results
- **Tabs:** Referred samples (search, status filter, grid of cards with masked patient names for viewers) + Manifests
- **Features:** Auto sample ID `CODE+YYMMDD+001` (e.g., BC260818001), Blood Culture auto-consumes bottle FIFO, CHUK referral, barcode, manifest generation with code `BLC` prefix, exports PDF/PNG/XLSX
- **View Results:** Filter to Done/Positive/Negative with result dates

#### 3. Stock & Supplies — Consumables, Batches, Health Centers
- **Overview:** 5 consumables (Blood Culture Bottles Ped 49 Adult 47, VTM 36, HBV/HCV cartridges, HIV-EID 0) with threshold status OK/LOW/OUT, expiring/expiry alerts, recent entries
- **Ledger:** 14 entries sorted, Del with confirmation
- **Catalog & Settings:** Referral hospitals (NRL, Kibagabaga, CHUK) + Test catalog (Blood Culture BC TAT 4d, HIV, TB Culture 21d, Measles, MonkeyPox, Marburg 3d, Polio, Rift Valley, Yellow Fever, Hepatitis) + Health centers (8 HC) + Consumables & thresholds — **all with Edit + Del** (previously only Del, now Edit too)
- **Premium Editor:** Consumables editor now premium with editable thresholds (gold left border), tracks age groups, links to samples

#### 4. Training Roster — FIFO Queue, Registry, History
- **FIFO Logic Fixed:** Longest wait first (most overdue = next), recent last — Beatrice & Aurelie Jun 2026 now at END, Faustin 1022d next with blinking gold rings
- **Spotlight:** Next in FIFO queue with name, role, wait days, gold tag, Invite button (Admin only)
- **Queue Rail:** Horizontal scroll, avatars, wait badges (42d, 281d...), connector gradient, hover lift, blinking pulse for next
- **Timeline Flow (Premium 7-Step like image):** Alternating top/bottom nodes with arcs, icons 📊🔬🧬⚗️, gold line gradient, horizontal on desktop, **vertical toggle on phone** (≤640px) — premium flow
- **Charts:** Trainings per staff (HBar), Age distribution (Bar)
- **Tabs:** Dashboard, Staff Directory, Training Registry (upcoming), Training History (completed by year)

#### 5. Training Revenue — Elaborated with MoM Charts
- **KPIs:** Net balance, Total expenses (Food/Transport/Lodging/Drinks/Other), Reimbursed (Income), Sessions count with avg per trip
- **Charts (Premium with line charts):**
  - Month-over-Month Expenses vs Income (StackedBar comparative)
  - Monthly Profit/Loss MoM Trend (Bar green profit / rose loss)
  - Net gain/loss per session (Bar)
  - Expense breakdown Food/Transport/Lodging/Drinks/Other (HBar with gold/navy/teal/amber/rose)
- **Sessions:** Log training with title (sync from Training Roster), organizer, location, start/end, expenses itemized by category, reimbursements, profit calc
- **Confidential:** Hidden for viewers (Admin only)

#### 6. Working Plan — Monthly Working Plan + Weekly Unit Roster
- **Covers full month + first week next month** (report week protected, Sep 2026 = Sep 01-30 + Oct 01-06)
- **Roster Rules (Ruli Exact):**
  - Kelvin manager: Mon-Fri D, no weekends/holidays/nights, appears only as 3rd person when ≤2 staff
  - Beatrice: dayonly Mon-Fri, no nights, no weekends (blank not OFF to keep clean), Reception mostly, Parasitology when ≤4 staff, never Phlebotomy/TB
  - Aurelie: weekendonly Sat & Sun DN, Mon-Fri OFF, when in AL weekend split → 1 staff Sat+Sun days + 1 staff Sat+Sun nights (2 consecutive nights → 2 OFFs Thu/Fri)
  - Patrick: nightPref 3, max 12, only one who did 3 consecutive originally, now after shortage Jean Paul & Dieudonne also do 3 nights alternating Mon-Wed (JP) / Thu-Fri (Dieudonne) with Patrick
  - Diane: minimal nights (exited 12/08/2026 per manager), exactly one 2-night block before exit
  - Faustin: contractual 18 working days AL (exited 29/06/2026)
  - Dieudonne & Jean Paul: 3-night blocks after shortage, alternating fairly
  - No 7-day work: wouldWork7 check + post-process forces OFF
  - No 2 AL overlap: validation + auto-resolver shifts overlapping AL
  - Holidays: Rwanda calendar with observed Mondays, one fair day-duty H + night kept, Kelvin & Aurelie exempt
- **Features:** Generate fair plan (gap-aware, avoids singles, Patrick triples), tap cell to edit (Admin only, viewers see hint "Viewer mode"), block shifts 2N/3N/2D/3D/DN + 2/3/5 OFFs batch, version history (12 versions), import Excel past plans for fairness, export
- **Exports Premium Light (Fixed):**
  - Single centered header: Ruli DH 26px 900 black + dept 13px black + email/phone 11px black + gold line 3px only (no Republic of Rwanda / Ministry deep blue, no MOH shield unless uploaded high-res)
  - Title: Working Plan — September 2026 full month name (not Sep) + Date FY only (Period removed, already in title)
  - Table: Single Staff/Name column left-aligned (fix double), first row Days M T W..., second row Dates 31 1 2..., Staff names left column, no empty left side, uses full width W=1400
  - Keys: spacious rectangular tags 300×26px with color dots, 12px gap, 4 per row, below table
  - Staff contacts: premium rectangular blocks 3 per row, gold left 3px, black text (not gold)
  - Signatories: No line below (you sign next to names), gold separator above only, black text, original way (Prepared/Verified/Approved)
  - PNG: scale=2 retina crisp, high-res logos with imageSmoothingQuality high, HD Rwanda coat of arms 1836×2000 transparent embedded base64 (no background) — no depixelation
  - PDF: Same light premium, A4 landscape, includes all names/dates/days/codes

#### 7. Leave & Timeline — Planner, Records, Holidays, Absences
- **Master Timeline:** FY 2026/2027 horizontal scroll with holidays (1994 Genocide against the Tutsi Memorial Day correctly named), leaves, trainings, weddings, absences
- **Leave Planner:** Statute 30 calendar days AL, Contractual 18 working days, ML 14 weeks auto, W wedding day, TR training — type, staff, start/end, note, Add & re-plan, overlap validation (no 2 AL same time)
- **Leave Records:** Chronological from who's next to go for AL (upcoming first), Edit, Approve, Mark taken/Started, Mark ended, Del all with confirmation
- **Patrick Leave Fixed:** Previous FY 30d Aug17-Sep15 + Current FY 15d Sep16-30 =45d total Aug17-Sep30, back Oct01 — no extra Oct OFF, closes correctly, no 9-day back confusion (mergeConsecutiveLeaves)
- **Public Holidays:** Rwanda calendar 2024-2027 with 1994 Genocide against the Tutsi Memorial Day correctly named, observed Mondays auto, Add official, Del with confirmation
- **Absences:** Log absence with auto re-roster, Off-day Exceptions with compensating date

#### 8. EQA / PT Scores — NEW Module (Proficiency Testing)
- **Quarter Code:** Q1 Jul-Sep, Q2 Oct-Dec, Q3 Jan-Mar, Q4 Apr-Jun (FY starts July) — e.g., Q2 2026 = Oct-Dec 2026 samples
- **Programs:** Hematology (WBC,RBC,HCT,MCV,PLT,Hemoglobin), Biochemistry (Glucose,Creatinine,ALT), TB (MTB GeneXpert), HIV (%), Serology (RPR,HCV) — HIV & TB scored in %, others in SD, Pass +-2SD or ≥80%
- **Record:** Delivered to lab date, Tested date, Reported to NRL date, Score Published date, Score SD / Score %, Analytes (WBC:0.5 etc.), Overall Pass/Fail/Pending auto, Notes
- **Add More Tests:** + Add test button adds custom analyte as lab elaborates
- **History:** Seed 5 PT Q1 & Q2 2026/27 all Pass + 📚 Add History import (e.g., `Q1 2024 | Hematology | WBC:0.5,RBC:0.3 | Score:0.6 SD | Pass`)
- **Premium Visuals:** Timeline flow with icons 🩸⚗️🧬🦠🧫, blinking next for Fail, line charts everywhere (PT Scores Over Time line, Pass/Fail per program bar, Hematology SD trend 6 lines, Biochemistry 3 lines, TB & HIV % line, Serology SD trend), KPI cards with pass rate bar

#### 9. Staff & Settings — Registry, Letterhead, Data
- **Staff Registry:** 8 staff (6 active after Diane 12/08/2026 & Faustin 29/06/2026 exited), Active/Exited tags, avatar, sex/age/phone/contract, Edit with full form (profile pic upload, full name, role, sex, DOB, phone, email, contract, work pattern, night pref, max nights, weekend duty D/N/DN, weekend-only, join/exit dates, notes) — **exited saving bug fixed** (migrateDB enforces, saveDB robust)
- **Letterhead & Branding:** Hospital info (Ruli DH, Lab Dept, email, phone, FY start July, manifest prefix BLC), Logos & crest upload (MOH crest & hospital logo placeholders, high-res), Signature block (Prepared Kelvin SAMAHANI Lab Manager, Verified Dr. Judson B. MUMBERE Clinical Director, Approved Jean de Dieu SIBOMANA HR Officer)
- **Data & Backup:** Full backup JSON (staff, samples, stock, trainings, revenue, leaves, holidays, working plans history, EQA), Restore backup, Download app file HTML, Reset to seed data with confirmation, Roster rules (Staff per night shift 1/2, Max weekend 2/3)

---

### 📱 Usage

- Open https://ssamahan.github.io/lab/ → Viewer mode read-only by default (👁️ Viewer — read-only chip)
- **Admin Login:** Top header 🔐 Admin Login → Private access (password + OTP + Reset via Email) — contact Lab Manager
- After login: 🔓 Admin: private chip, editing enabled, all generate/edit buttons active
- **Tab Preservation:** Refresh stays on same module (Training Revenue, EQA, etc.) via hash + localStorage `labSystems.lastTab.v1`
- **Phone:** Hamburger menu minimizes sidebar and main fills full screen (fix half-screen bug), timeline vertical on phone, charts responsive

---

### 📤 Exports

- **Working Plan:** Preview (HTML) + Save as PNG (1400px retina, light premium single header centered, Staff/Name left-aligned single column, Days first row M T W..., Dates second row 31 1 2..., black texts gold line only, keys spacious with dots, contacts in rectangular blocks with gold accent, signatures no line below) + Export PDF (A4 landscape, same premium, includes all names/dates/days) + Excel + Print
- **Weekly Unit Roster:** Save as PNG + Print
- **Manifests:** PDF/PNG/XLSX with high-res HD Rwanda coat of arms 1836×2000 transparent (no background) embedded base64 — crisp, no depixelation
- **Backups:** Full backup JSON + Working Plan JSON

---

### 🔄 How to Update

Just replace `index.html` (and optionally `assets/rwanda-coat-hd.png`) in this repo. Link stays same forever, updates in ~30-60 sec after push.

```bash
git add index.html
git commit -m "Update"
git push origin main
```

GitHub Pages: Settings → Pages → Source Deploy from branch → Branch main / (root) → Save → https://ssamahan.github.io/lab/

---

### 🛡️ Quality Bar

High-end hospital laboratory command center — refined, modern, trustworthy, precious. Light mode clean bright #F7F8FC, Dark mode deep sophisticated luxurious navy #0A1628 + gold #C9A84C. Zero random large blank spaces, charts always readable ≥12px, perfect consistency across every module, confidentiality for patient data, delete confirmations everywhere.

---

### 📧 Contact

Lab Manager: Kelvin SAMAHANI — registered Admin email — 0787055121
Ruli District Hospital — Laboratory Department — rulidhlab@gmail.com — 0787-055-121


### 🏥 Multi-Lab — Move to Other Hospital
- **Current Lab:** Ruli District Hospital
- **When you move to other hospital as Lab Manager:** Staff & Settings → Data & Backup → Lab Management → Enter new hospital name → Archive Ruli & Create New Lab
- Archives previous DB to Ruli Lab (localStorage `labSystems.archives.v1` + cloud + JSON backup) → new lab starts empty with your gold pipette logo
- Switch back anytime via View Archives → Restore

### 🛠 Recent Fixes
- Fix x-axis black text unreadable in night mode: charts now theme-aware var(--text) var(--muted) var(--surface) instead of hardcoded #000000
- Fix admin login showing nothing: toasts z-index 200→10001 above overlay 9998
- Fix admin login button disabled in viewer-mode CSS
- Add live Firebase + EmailJS UI
