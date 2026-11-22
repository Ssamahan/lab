# Elevation plan — UI, UX & security

> **Status:** implemented in v6.9.178 on this branch (S1–S10, V1–V5, U1, U6; the sync
> chip and command palette already existed; the first-run tour remains future work).
> The live Supabase project was hardened in the same pass: sign-ups disabled, anonymous
> writes closed, visitor read preserved.


Audit of the shipped console (`ssamahan.github.io/lab`, build v6.9.177) against the source
on this branch. Every item names a file and gives a concrete edit. Ordered by impact.

---

## Security

### P0 — do this week

#### S1 · The password hashes in the repo are effectively plaintext
`assets/js/core/auth.js` stores five accounts as **unsalted, single-pass SHA-256** in a file
anyone can download. I re-derived three of the four published hashes from a **70-word
dictionary in under a second** — including the Admin (`kelvin`) and Reviewer (`reviewer`)
accounts. Two accounts (`aurelie`, `jeanpaul`) even share one hash, i.e. one password.

The code comment says the hashes keep credentials "out of a public repository" — but a
public hash of a guessable password *is* the credential. Rotating passwords changes the
hash; it does not change the scheme.

**Edit — replace the scheme with PBKDF2 via WebCrypto** (works everywhere the app already
works, since the console is HTTPS-only):

```js
/* auth.js — replaces A.hash. Stored format: "pbkdf2$310000$<salt-hex>$<hash-hex>" */
A.deriveHash = async function(password, saltHex){
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const salt = Uint8Array.from(saltHex.match(/../g).map(h => parseInt(h, 16)));
  const bits = await crypto.subtle.deriveBits(
    { name:'PBKDF2', hash:'SHA-256', salt, iterations: 310000 }, key, 256);
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2,'0')).join('');
};
A.newSalt = () => [...crypto.getRandomValues(new Uint8Array(16))]
  .map(b => b.toString(16).padStart(2,'0')).join('');
```

`login` becomes async and migrates on success — the codebase already has this pattern
(`u.password → passHash`):

```js
if (u.passHash.startsWith('pbkdf2$')) { /* verify as before, constant-time-ish compare */ }
else {
  /* legacy 64-hex SHA-256: verify, then immediately re-derive with PBKDF2 + salt */
  const salt = A.newSalt();
  u.passHash = 'pbkdf2$310000$' + salt + '$' + await A.deriveHash(password, salt);
  persistRoles();
}
```

Then:
1. **Rotate all five passwords** in Security Center (the old hashes die with the deploy).
2. Ban shared passwords — `setPassword` can refuse a hash already used by another account.
3. Longer term (the README already plans this): move identities to **Supabase Auth, one
   account per person**. Supabase stores proper bcrypt hashes server-side and the audit
   trail starts naming the right people.

#### S2 · Staff personal data ships in the public bundle
`auth.js` carries real names, roles and **personal Gmail addresses** of staff
(`aurelieyansoneye@gmail.com`, `nsengiyuma4@gmail.com`, …). Every visitor to the site
downloads that file; it is also indexed by search engines. For a hospital, this is personal
data published without need.

**Edit:** strip `email` from the seeded `USERS` array (keep the field, leave it empty until
S1's Supabase Auth supplies identities per device). If Security Center needs a contact
column, let the admin enter it locally on their own device — it never needs to be in Git.

#### S3 · The one-time code is decorative, and the UI claims otherwise
`auth.js` line ~230: the OTP is compared to the literal `'123456'`, while the sign-in screen
tells users a code was "sent to your device" and that codes "expire after 5 minutes". Nothing
is sent; nothing expires. That is worse than no 2FA — staff will trust a factor that does not
exist.

**Edit (choose one):**
- **Real TOTP client-side** (~30 lines, RFC 6238 over WebCrypto) with per-user secrets and a
  QR enrollment in Security Center:

  ```js
  async function totp(secretB32, step = 30){
    const key = base32decode(secretB32);                 // RFC 4648 alphabet
    const ctr = new DataView(new ArrayBuffer(8));
    ctr.setUint32(4, Math.floor(Date.now() / (step * 1000)));
    const ck = await crypto.subtle.importKey('raw', key, {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
    const mac = new Uint8Array(await crypto.subtle.sign('HMAC', ck, ctr.buffer));
    const o = mac[mac.length-1] & 0xf;
    return String(((mac[o]&0x7f)<<24 | mac[o+1]<<16 | mac[o+2]<<8 | mac[o+3]) % 1e6).padStart(6,'0');
  }
  ```

  Honest caveat to print in the Security Center: the secret lives in the same localStorage as
  the register, so it defends against *remote* guessing of the published hashes, not against
  someone holding the unlocked device.
- **Or remove the 2FA toggle and the OTP field** until a real provider exists. Never show a
  factor that isn't one.

#### S4 · The shared register is readable *and writable* by anyone holding the public key
The README says this plainly, and it is the biggest real-world exposure: `schema.sql`
grants `lab_registers`, `lab_report_months` and `lab_register_history` to **all**
`authenticated` sessions — and Supabase counts anonymous sessions as authenticated. Anyone
who finds the publishable key (it is in `shared.js`, in a public repo, on purpose) can pull
the whole register and **overwrite it** (history keeps the last 50, but 51 bad writes lose
data).

**Edit:** you already drafted the fix — it's commented out in `schema.sql` lines 90–109.
Apply it, now, while also confirming every device signs in with a real project user:

```sql
create policy "lab register read" on public.lab_registers
  for select to authenticated
  using ((auth.jwt() ->> 'is_anonymous')::boolean is not true);
-- …same predicate for insert/update, then switch OFF
-- Authentication → Providers → Allow anonymous sign-ins.
```

Then `shared.js` should stop defaulting `anonAuth: true` — a fresh install should fail loudly
("this project requires a signed-in user") instead of silently degrading.

#### S5 · Add a Content-Security-Policy — today there is none
`index.html` has **no CSP**, and the codebase uses `innerHTML` in **147 places**, several fed
from register content that arrives *from other devices via the cloud*. If any text field ever
carries markup, it executes on every synced device with the user's session. GitHub Pages
cannot set response headers, but a `<meta>` CSP covers everything that matters here except
`frame-ancestors`:

**Edit:** move the inline watchdog script (index.html line 481) to
`assets/js/core/watchdog.js` (it depends on nothing — that's its whole point), then:

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  font-src 'self';
  connect-src 'self' https://lkjwztvhmzhasclmlocx.supabase.co;
  worker-src 'self';
  manifest-src 'self';
  base-uri 'none';
  object-src 'none';
  form-action 'none';
  upgrade-insecure-requests">
```

The one risk is breakage in export/print paths that use blob or data URLs — add those
directives lazily (`img-src … data: blob:` above already covers chart PNG export). Ship it
with a `report-uri`/console check on `check.html`, and progressively sanitize the innerHTML
sinks that interpolate register data (`U.esc()` exists in `utils.js` — route the dynamic
fields through it).

### P1 — this month

#### S6 · The public visitor view shows too much
The anonymous visitor dashboard displays staff **full names + roles + duty status**, sample
IDs tagged `Confidential`, equipment serials, lot numbers and a live activity feed of who did
what. A hospital register at a public URL should show aggregates only.

**Edit:** in `landing.js` / visitor mode, filter the snapshot: keep the KPI tiles, charts and
counts (8 staff, TAT %, EQA composite), drop names → initials or "Staff A", drop sample IDs →
test category, drop the live activity feed. One `redactPublic(db)` function applied before
mount keeps it to a single choke point. The "no invented numbers" principle stays intact —
redaction isn't invention.

#### S7 · `apk-workflow.yml` — pin actions and trim permissions
The HIV feed workflow does this right (SHAs pinned, `permissions: contents: read`,
`persist-credentials: false`). The APK workflow uses floating tags (`actions/checkout@v4`,
`softprops/action-gh-release@v1`). A compromised or renamed action gets your `GITHUB_TOKEN`
and whatever secrets it needs for signing.

**Edit:** copy the pinning pattern from `.github/workflows/hiv-timeliness-manual.yml`, add
`permissions: contents: write` scoped to the release job only (it needs it for
`gh-release`), and gate the job on tag pushes.

#### S8 · Brute-force resistance on the bench-PC login
All auth is client-side, so nothing stops a script hammering the sign-in form. Add the cheap
version: a failed-attempt counter in the store with an exponential delay (1, 2, 5, 15 min)
and a Security Center alert listing failed attempts (keep 50, not 20). It won't stop a
determined attacker (the code is public) but it stops shoulder-surfer scripts and shared-PC
guessing, and it makes attempts *visible*, which is what a hospital audit wants.

#### S9 · Service worker: storage grows forever
`activate` deliberately preserves old caches, and every version mints a new
`lab-shell-v*` + `lab-runtime-v*` pair. A phone updating weekly accumulates tens of MB of
dead caches — on exactly the low-storage devices this app targets.

**Edit (sw.js activate):**

```js
const keep = [SHELL, RUNTIME];
await caches.keys().then(keys => Promise.all(
  keys.filter(k => /^lab-(shell|runtime)-/.test(k) && !keep.includes(k))
      .map(k => caches.delete(k))));
```

Also a real bug at `cacheFirst`: `if (hit) { refresh; return hit; }` — `refresh;` is a no-op
expression statement, not an awaited promise; it works only by accident of GC timing. Write
`void refresh; return hit;` (or `refresh.catch(()=>{})`) to make the intent explicit, and let
ESLint (`no-unused-expressions`) catch the next one.

#### S10 · CI hygiene
- `eslint.config.mjs` exists but nothing runs it. Add a 10-line `lint.yml` (checkout,
  setup-node, `npx eslint assets/js`) — it would have caught S9.
- Add Dependabot (`versioning-strategy: increase` for Capacitor) — `@capacitor/*` 5.x is now
  two majors behind.
- Optional: serve through Cloudflare Pages in front of GitHub Pages. A `_headers` file then
  gives you real HSTS, `X-Content-Type-Options: nosniff`, `Permissions-Policy` and a
  header-delivered CSP with `frame-ancestors 'none'` — none of which a meta tag can do.

---

## UX

### U1 · Hide deltas that have no denominator
The dashboard shows "**0** registered today **+100%**" and "TAT **-100%**" with `n=6` and
`8 registered · 12 mo`. A delta over zero is noise; the landing page itself commits to "no
invented numbers". **Edit:** in `dash.js`, render the delta chip only when the prior period
has a value; otherwise render "first month" / "no prior data" in the muted tone. This single
change kills most of the "is something broken?" moments on a fresh install.

### U2 · Empty states should be doors, not walls
Several screens end at "no data in this window" (`charts.js`). For a register carried
forward from paper, the first-run experience is a wall of zeros. **Edit:** each module's
empty state gets one primary action: Samples → "Register first sample", Plan → "Generate
this month", EQA → "Score a PT round". Reuse the existing `guard('edit')` check so viewers
see "ask the Lab Manager" instead of a dead button.

### U3 · A command palette for 16 screens
Power users (the lab manager above all) navigate by memory, not by reading the rail.
**Edit:** Ctrl/Cmd-K opens a palette indexing screens, recent samples (`RMEA…`), staff, and
actions ("Register a sample", "Generate roster"). ~150 lines in `shell.js` using the
existing keyboard plumbing; the manifest `shortcuts` already model the top four.

### U4 · Make sync state legible at all times
The visitor view has a status line ("Shared register · read 2m ago") that the signed-in
console doesn't match. **Edit:** promote pending-push count + last-sync time into the
status bar permanently (`statusbar-h: 30px` exists), with an amber state when pushes are
queued offline and a red one when a push failed. The "update ready" banner is good — give
it a sibling: "3 changes not yet on other devices".

### U5 · First sign-in, first three minutes
New staff hit a 16-screen console with role-gated areas they can't see. **Edit:** a 4-step
coach-mark tour on first sign-in (Dashboard → Samples → Plan → My account), stored
`localStorage` flag, replayable from Settings. Pair it with the existing i18n: `i18n.js`
already carries Kinyarwanda and French — surface the switcher on the landing page too, not
only in-console; the public page is the one strangers read.

### U6 · Shared-device sign-out should be automatic
The names-gate already re-asks for a password after 15 minutes. Sessions don't. **Edit:**
add a "shared device" profile in Security Center: idle > 10 min → lock to a
password-gated resume (not full logout), matching the names-gate UX. Default ON for
Technologist/Viewer roles, OFF for the manager's own laptop.

---

## UI

### V1 · Keyboard focus is nearly invisible
`grep focus-visible app.css` returns **one** rule (`.ce-btn`). In a dense, dark,
16-screen console, keyboard users are lost. **Edit (tokens.css + app.css):**

```css
:root{ --focus-ring:0 0 0 2px var(--ink-950),0 0 0 4px var(--gold-500); }
:where(a,button,input,select,textarea,[tabindex]):focus-visible{
  outline:none; box-shadow:var(--focus-ring); border-radius:var(--r-xs);
}
```

Plus a skip link (`<a class="skip" href="#main">Skip to console</a>`) and
`aria-current="page"` on the active rail item — `shell.js` already knows the active module.

### V2 · The display font flashes
Only `inter-latin-400` is preloaded; every heading on the landing and boot screen is
Fraunces, so first paint falls back to Georgia then swaps. **Edit (index.html):**

```html
<link rel="preload" href="assets/fonts/fraunces-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
```

(~30 KB, one file, kills the FOUT on the most-designed surface.)

### V3 · Chrome/status-bar color lags the theme
`theme-color` is hardcoded `#FAFAF9` and `shell.js` patches it after load — on a dark
console the phone chrome flashes light first. **Edit:** static media-scoped metas plus the
JS override:

```html
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0B101C">
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#FAFAF9">
```

### V4 · Motion safety beyond the tokens file
`tokens.css` has a global `prefers-reduced-motion` block, and `app.css` covers `.topbar` —
but the boot crest (`--d: .05s…` staggered draws), landing reveals and chart transitions
need verifying inside it. **Edit:** extend the reduced-motion block with
`.draw{animation:none} .boot-thread i{animation:none} [class*="reveal"]{transition:none}` and
spot-check `charts.js` transitions.

### V5 · Contrast: the faint text fails at body size
Landing `--text-faint:#8A8377` on `#F7F5EF` ≈ 3.2:1 — it's used for meta lines like the
address block and footer legalese. **Edit:** bump the landing's `--text-faint` to
`#6F6A5F` (≈ 4.6:1) and keep the current value for decorative eyebrows only. Console
`--ink-300` on `--surface-3` has the same problem in Ink theme — audit the two pairs with a
script in `harness/` (you already have `css_check.js`).

### V6 · Icons and images
Zero `alt=` attributes in `index.html`; inline SVGs correctly carry `aria-hidden` — good —
but the `<img>` logos don't. Add `alt="Ruli District Hospital laboratory crest"` etc.
The favicon set is thorough (16→512 + maskable + ICO) — genuinely above standard.

---

## Suggested order

| # | Item | Effort | Risk |
|---|------|--------|------|
| 1 | S1 rotate passwords + PBKDF2 | 2 h | none (migration on login) |
| 2 | S2 strip staff emails from the bundle | 15 min | none |
| 3 | S4 apply the non-anonymous RLS policies | 30 min | verify every device signs in |
| 4 | S5 CSP + external watchdog | 1 h | test export/print paths |
| 5 | S6 redact the public visitor view | 2 h | none (single choke point) |
| 6 | S3 real TOTP or remove the fake factor | 3 h / 15 min | UX copy change |
| 7 | V1 focus rings + skip link | 1 h | none |
| 8 | U1 honest deltas | 1 h | none |
| 9 | S9 SW cache cleanup + `refresh` fix | 30 min | none |
| 10 | S7/S10 workflow pinning + lint CI | 1 h | none |
| 11 | U3 command palette, U4 sync legibility | 1–2 days | feature work |

Items 1–3 close the gaps that exist *today* for anyone who reads the public repo; the rest
is hardening and polish.
