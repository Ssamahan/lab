# Monthly reports — HIV reporting timeliness

The standalone **Reports → Monthly Reports** workspace (`#/hiv-reporting`) tracks health-centre report completion against the deadline **before the 5th of the following month**.

## Import

1. Sign in with an Admin or Manager account and open **Reports → Monthly Reports**.
2. Select the Microsoft Forms `.xlsx` workbook, or export the worksheet as `.csv` / `.tsv` and import that file.
3. The importer detects these columns (header row may appear within the first 40 rows):
   - `Health Facility Name`
   - `Reporting Month`
   - `Completion time`
4. Review the import confirmation. Each monthly import merges new rows into the existing local history; earlier months are preserved, and matching submissions already stored are not duplicated. Separate submissions with different completion timestamps remain available for duplicate review.

The importer keeps only health-centre name, reporting month and completion date/time. It ignores form responses, staff names, email addresses, test results, stock information and comments. Health facilities not present in the laboratory's health-centre catalogue (for example Ruli DH) are excluded from the health-centre analysis.

## Classification

- The **Reporting Month** field determines the report period. For a form that records only a month name, the year is inferred from the completion date; a May report completed in June is assigned to May of the same year.
- The final on-time calendar date is the **4th**. Completion on the 5th or later is late.
- Late submissions are split into **1–2 days late (within the stated two-day tolerance)** and **more than 2 days late**. Both remain late; the tolerance does not extend the deadline or count a late report as on time.
- Missing reports become overdue after the 4th. Periods still within their deadline window show **Not due** and are excluded from the on-time denominator.
- When the same centre has duplicate entries for one report month, the earliest completion is used for timeliness and the duplicate count is shown.
- “Repeat follow-up” is an analytic flag for three or more late or overdue cycles in the selected window; it is not a disciplinary rule.

## Data location and backups

The data is stored in a separate local browser key (`labSystems.hivReporting.v1`). It is not added to `labSystems.v1`, is not uploaded to the optional Supabase register, and is not part of the public site bundle. Import each monthly workbook on every browser/device that needs it; imports merge into that browser’s history. **Backup local data** downloads a data-only JSON file. **Restore JSON backup** replaces the current local history, so back it up first if needed. Keep the source workbook as the authoritative record.

Before using a generated letter or directive, verify the imported workbook is complete, review the cut-off date and reconcile any later submissions; the indicator cannot detect records omitted from the source file. The interface is role-gated to Admin and Manager, but this browser-only app is not server-side access control. Local browser data is not encrypted; keep the device and any downloaded backup appropriately protected.
