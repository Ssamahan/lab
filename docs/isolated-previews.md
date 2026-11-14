# Isolated Worker previews

These preview builds are separate from production deployments. Never use production data, credentials or database bindings in a preview. A preview URL is not an access-control boundary; anyone with the URL may be able to see it, and code from an untrusted branch could change the isolation rules.

## Lab static preview

In the **lab** Worker's Settings → Build → Previews Base, keep the root directory `/` and the build command `npm run build`. Set the preview command to:

```sh
node scripts/build-lab-preview.mjs && npx wrangler preview --config preview/lab.json --ignore-base-config
```

The script copies only the app's static files to `.preview-assets`, adds a prominent warning, and applies a restrictive Content Security Policy via `_headers`. Browser connections to live Supabase and the HIV feed are blocked; only same-origin preview assets can be fetched. Service worker registration is blocked. Changes made in the preview are local to that preview origin; do not put real patient data or production credentials into it. The preview cannot test cloud sync, private names, the live HIV feed, or offline installation.

The script refuses to overwrite a non-empty output directory; CI should build in a clean checkout. This command uses a preview-only Wrangler file and does not replace the production auto-configuration. Never run `wrangler deploy` with this file. Verify the actual preview response headers and blocked network requests after deployment; a local test alone cannot prove Cloudflare served the policy.

## HIV publisher preview

In **lab-hiv-timeliness** → Settings → Build → Previews Base, set root directory to `/workers/hiv-publisher` and preview command to:

```sh
npx wrangler preview --ignore-base-config
```

The `previews` binding in `wrangler.jsonc` points to the separate `lab-hiv-preview` D1 database, never the production D1 database. Initialize only that empty preview database with `schema.sql`. Do not copy the production database or production secrets to the preview. With no preview secrets, authenticated publishing is disabled. An empty preview returns 503 for the public summary until synthetic data is added using a separately configured test-only publishing key; this is expected and is not a production outage.

The flag `--ignore-base-config` prevents dashboard Previews Base settings, including any shared secrets or bindings, from being applied. Check the deployed preview's bindings and response in Cloudflare before treating it as isolated. Never invoke the production HIV publishing workflow to test previews.
