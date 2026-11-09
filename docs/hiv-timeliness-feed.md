# Live HIV report timeliness feed

The live panel reads only facility, reporting month and completion timestamp from the
`Ruli HIV Reports` worksheet. The source workbook stays at OneDrive; the feed holds
no database and never writes to it. The dashboard refreshes every three minutes while
open and marks a previous result stale if refresh fails. Only the public facility-level
summary is returned. The full workbook includes testing data and staff contacts and
must not be embedded in the public source code.

## Setup (a separate Cloudflare Worker)

This is **not** a change to the existing `lab` static-site Worker. Deploy a separate
Worker named `lab-hiv-timeliness` from this GitHub repository using the `main` branch,
root directory `workers/hiv-feed`, blank build command and deploy command
`npx wrangler deploy`. Under that Worker’s Settings → Variables and Secrets, add a
**secret** named `SOURCE_URL`, whose value is the view-only OneDrive sharing link
for the live workbook. Do not add it to GitHub, the app, a build variable, or chat.
Never use a link that grants editing. Deploy/redeploy after saving the secret if the
Cloudflare dashboard requires it. The site expects
`https://lab-hiv-timeliness.smhnklvn.workers.dev/`.

A GET returns only `{version, checkedAt, records}`. `checkedAt` is when the Worker
successfully read the source, not proof of the workbook’s own edit time. An error
never returns workbook contents or URL. Test with a browser before relying on it;
compare a known new submission with the workbook and wait for the dashboard refresh.
The service reads on request, not as a background notification when no one is using it.
If OneDrive denies the public download or changes its sharing behavior the feed fails
closed; it is not Microsoft-account OAuth or a guarantee of continuous operation.

Rows are deduplicated by centre and reporting month, retaining the earliest recorded
completion and exposing the response count for review. Year is inferred from the
completion date and month name, assuming a report is submitted within 12 months of its
reporting month. Completion timestamps are read as displayed (timezone not verified);
no patient names, staff contacts, test counts or notes are returned. Missing means
not found in the workbook, not proof of non-submission through other channels.
