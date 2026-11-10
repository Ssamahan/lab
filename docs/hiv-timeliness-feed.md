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
Cloudflare dashboard requires it. In Workers Builds, a new push to the production branch
triggers the Git-connected build; the dashboard’s “New deployment” static-file uploader
does not build this Worker. The site expects
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

## Read-only rclone reader (prototype, not deployed)

`reader.mjs` invokes `rclone cat` on exactly one configured `hiv-readonly:` workbook,
keeps the downloaded bytes in memory, validates/parses with the existing worker parser,
and writes only the reduced JSON summary to standard output. It never prints rclone
stderr, paths or credentials; failures exit nonzero without a summary. It is not a
scheduler or publisher, and must not be run with real workbook data in public CI logs.
It requires a recent rclone and Node.js, plus `RCLONE_CONFIG_PATH` pointing to a private
rclone config file and `HIV_WORKBOOK_PATH` pointing to the exact workbook. rclone can
update its config with refreshed OAuth credentials, so the file is sensitive and must
never be committed, uploaded as a build artifact, or printed. Even read-only OAuth
credentials can expose other files accessible to the Microsoft account.

Before any scheduled use, a separate design must implement and test private encrypted
credential persistence and refresh, authenticated publishing, writer concurrency,
secret provisioning/revocation, and failure recovery. The public endpoint must not
silently present an old stored snapshot as fresh: it needs a checked-at timestamp and
an explicit stale/failure indication compatible with the dashboard. GitHub scheduled
runs may be delayed or skipped. Any CI job must avoid untrusted PR code, debug logs,
raw workbook artifacts and exposure of secrets. Do not enable scheduling or move
credentials to a cloud service until those safeguards are tested and the owner approves
where credentials and workbook bytes will be processed. The existing feed remains
unchanged and the live connection remains unverified.

### Staged publisher implementation

`workers/hiv-publisher/` is an **undeployed** prototype of a separate D1-backed
Worker. Its private config routes require a long random bearer key and encrypt the
rclone configuration with AES-GCM using a separate Worker secret; the public route
returns only validated summary fields and returns HTTP 503 if the last check is older
than 30 minutes. The Wrangler configuration targets the separate `lab-hiv-feed-state` D1 database; its schema and secrets still need to be provisioned before it can work. Anyone
who possesses the publisher bearer key can retrieve the decrypted configuration and
therefore may read the OneDrive files the grant covers. Keep both keys private and
revoke/re-authorize Microsoft access if a credential leaks. Cloudflare administrators
and trusted GitHub workflow code must be considered privileged.

`publisher.mjs` is a staged Node runner. It retrieves the config over HTTPS without
redirects, stores it in a restrictive temporary file, reads the workbook, persists
any refreshed config, publishes the reduced result, then removes the temporary
directory. A failed config update prevents the summary update. An interrupted or
uncertain response must be treated as an unknown outcome, not as proof no write took
place. Tests use only synthetic data and in-memory storage.

This is not yet a complete production service. It has not been deployed, security
reviewed, tested against real D1 or an actual OneDrive file, or connected to a
scheduled workflow. A workflow must serialize runs, provision secrets without printing
them, pin and verify dependencies, restrict execution to trusted code, and avoid
artifacts, logs and untrusted pull requests. A privileged publisher can replace the
summary or read the rclone credential; accidental public exposure of its key would
be serious. Stale-data behavior, concurrency, encryption-key loss/rotation and refresh
recovery must be tested end-to-end before enabling it. No claim of automatic updates
should be made on the basis of these prototypes.
