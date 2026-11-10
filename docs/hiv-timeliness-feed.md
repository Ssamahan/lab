# HIV report timeliness feed

The Monthly Reports panel reads a separate public **reduced summary**: facility,
reporting month, completion timestamp and response count. It never writes to the Lab
Systems register, pending queue or OneDrive workbook. The browser checks the feed
every three minutes while the tab is visible; the source reader is scheduled multiple times per hour. GitHub may delay or skip scheduled jobs, so this is not a real-time
notification or a guarantee of continuous operation. A successful manual read was
verified; a scheduled run and a later new submission still need separate verification.

The reader fetches the workbook through rclone with delegated read-only OneDrive
access. Its configuration and refresh token can read other files accessible to the
Microsoft account. A GitHub-hosted runner temporarily holds the full workbook **in
memory** to extract the summary; it must never print it, publish it, save it as an
artifact or cache it. No raw workbook is stored in the feed. The user-facing endpoint
returns only `{version, checkedAt, records}`. `checkedAt` is when the reader parsed
the workbook, not its modification time. After 30 minutes without a successful check,
the endpoint fails closed with HTTP 503. The browser labels an in-memory previous
result as potentially stale on refresh failure.

## Production components and sensitive material

- `.github/workflows/hiv-timeliness-manual.yml` runs only trusted `main` code, with
  one serialized job, a manually dispatchable trigger and two staggered schedules, nominally every 5–10 minutes. Its
  name is historical. It uses pinned actions and a checksum-verified rclone binary.
- `workers/hiv-feed/reader.mjs` uses only `rclone cat` on the configured workbook;
  `publisher.mjs` obtains the rclone config, reads the workbook, saves any rotated
  config before publishing the filtered summary, and removes its temporary config.
  A failure or interrupted response may have an unknown write outcome.
- `workers/hiv-publisher/` is the separate `lab-hiv-timeliness` Cloudflare Worker.
  It uses the separate `lab-hiv-feed-state` D1 database, never the shared Lab Systems
  register. It stores the rclone config encrypted with AES-GCM under the Worker secret
  `CONFIG_ENCRYPTION_KEY`; the private API requires the Worker secret `PUBLISHER_KEY`.
- GitHub repository secrets `HIV_PUBLISHER_KEY` and `HIV_WORKBOOK_PATH` are supplied
  only to the trusted reader step. Never log them or the decrypted rclone config.
  Keep the config, workbook, and tokens out of the public repo, CI artifacts, caches,
  error messages, browser code and chat. Never enable debugging that prints them.
- Anyone with the publisher bearer key can retrieve the rclone configuration and may
  read the user's OneDrive files. Cloudflare administrators and users who can change
  trusted workflow code or secrets are privileged. Compromise requires revoking the
  Microsoft app grant and rotating/reprovisioning the credentials; an encryption key
  change without re-encrypting or reprovisioning the config makes it unreadable.
- Only one publisher should run at a time. GitHub concurrency serializes runs from
  this workflow, not arbitrary manual clients. Disable the schedule before any manual
  credential replacement, and check the live state after any uncertain operation.

The older anonymous-download Worker in `workers/hiv-feed/src.mjs` remains for parsing
and tests, but it is not the deployed data source. The old `SOURCE_URL` secret is not
used by the current publisher. A view-only “Anyone” link permits anyone holding it to
read or download the **full** workbook, including unrelated fields; review whether it
is needed separately before removing it, as other users or workflows may rely on it.

## Interpretation and recovery

Rows are deduplicated by centre and reporting month, retaining the earliest recorded
completion and exposing the response count. Year is inferred from the completion date
and month label, assuming submission within 12 months. Completion timestamps are read
as displayed; the source timezone has not been independently verified. Missing means
not found in the workbook, not proof of non-submission through another channel.

The Worker and runner tests cover synthetic privacy, auth, failure and stale paths;
they do not replace a production security review. If a scheduled run fails, check the
fixed failure-stage annotation and the displayed last-check time. Never share full
logs containing tokens, paths or workbook data. A Microsoft grant or token may expire
or be revoked, and the user may need to authorize again. Confirm a new genuine response
against the workbook and the dashboard before relying on automatic updates. Avoid
resetting browser storage or modifying existing register data to troubleshoot the feed.

### Aggregate HIV test figures (v6.9.137)
The public feed can additionally carry only the eight explicitly named numeric Determine and STAT-PAK usage and outcome fields. The parser requires exact source headers and suppresses the figures if headings change; an empty or invalid cell is null, not zero. If more than one response exists for a facility and month, test figures for that pair are withheld pending review (the earliest completion still serves timeliness). The publisher independently validates and allowlists these numbers. Names, email, lot identifiers, comments and the workbook never enter the public summary. Counts may include quality-control or proficiency testing and reactive results are not confirmed diagnoses. Missing values, unequal totals and partial coverage must not be silently corrected or interpreted as complete totals. The schedules are best-effort and was not yet observed running at deployment.

### Stock reporting (staged in v6.9.141)
The reader accepts stock fields only when the expected I, N and T–W headings all match. It emits only yes/no, an allowlisted overall status and single test type, a nonnegative numeric remaining quantity when one test is unambiguous, and the two reported lot expiry dates. Unrecognized text, comments, identities and lot numbers are never copied. Duplicate facility/month answers are withheld; conflicting status and quantity are retained for review, not repaired. End-of-month responses are not live inventory, and reported lot expiry does not establish that any of that lot remains. The 90-day display warning is not a validated reorder threshold.

**Deployment order:** deploy the publisher Worker with its existing D1 binding and secrets first, then merge/deploy the reader and UI. An older publisher silently removes the stock fields, and the existing source check must succeed before any stock data can appear. The scheduled job has not yet been observed; do not describe the feed as continuously updated or remove its fallback on the basis of configuration alone.
