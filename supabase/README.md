# Sync backend (Supabase)

The console stores the register in the browser. This folder holds the small server
side that lets a phone and a PC share it.

**Read this instead if you want it explained slowly:** [`docs/supabase-setup.html`](../docs/supabase-setup.html)
— a step-by-step guide written so that anyone in the department can follow it.

## What you have to do once (about fifteen minutes)

1. Create a project at <https://supabase.com> — the free tier is enough for one
   laboratory; pick the region closest to Rwanda (`eu-central-1` or `af-south-1` if
   offered).
2. Open **SQL Editor → New query**, paste `supabase/schema.sql`, run it. It creates
   one table, `lab_registers`, with row-level security on.
3. Open **Authentication → Users → Add user** and create the account the console
   will sign in with (email + password, **Auto confirm** on). Turn off public
   sign-ups in **Authentication → Providers → Email** if you want an invite-only
   console.
4. Copy **Project URL** and the **Publishable key** (`sb_publishable_…`, or the legacy
   `anon` JWT if your project still shows one) from **Settings → API Keys**.
5. In Lab Systems open **Staff & settings → Data → Cloud sync** and paste four
   values: project URL, anon key, the login email and the login password. Press
   **Test connection**, then **Save**. The first device that syncs creates the row.

The policies in `schema.sql` grant the table to the `authenticated` role, so the API
key on its own is not enough: the console signs in with the account from step 3 and
sends that access token, refreshing it when it expires.

Key shapes matter. A publishable key (`sb_publishable_…`) is **not a JWT** and must go
in the `apikey` header only — Supabase rejects it as a Bearer token with *Invalid JWT*.
The client therefore sends `Authorization` only when it holds a real signed-in session
JWT (or a legacy `eyJ…` anon key). `sb_secret_…` keys bypass row-level security: they
are refused by the app's settings form and by the connection test. If you would rather use
a single shared passphrase instead of Auth users, enable **Allow anonymous
sign-ins** and swap `authenticated` for `anon` in the three policies — but then
anyone holding the anon key can read the register.

Every device should take the same route: if one runs on an anonymous session and another on a
project user, give the second device a user of its own — or let the app switch it to anonymous
where the project allows that. The login is kept in the browser's `localStorage` on each device. That is the same
trust boundary as the register itself; do not email it around, and create one
account per person if you want the audit trail to name them.

## How the sync behaves

- **Offline first.** Every edit still lands in `localStorage` immediately. Sync is
  a background copy, never a prerequisite for saving.
- **Live by default.** A save pushes 0.7 s later; a background tick asks for the
  revision number every 2.5 s and pulls the document the moment it moves. The header
  pill shows *Live · Synced just now*. Both intervals are in `settings.cloud`
  (`pushMs`, `pollMs`) and the loop can be switched off with `settings.cloud.live`.
- **Nothing is redrawn under your fingers.** An incoming change is applied to the
  register at once, but a screen holding a focused field is redrawn only when that
  field is released, and an open dialog is never fought with.
- **Pulls do not echo.** Adopting a remote register clears the pending-edit counter, so
  the import cannot schedule a push straight back at the cloud.
- **Conflicts during a live tick** never open a dialog: the device with the visible edit
  publishes, the replaced copy is kept as a restore point, and the card records what
  happened. Pressing **Sync now** still asks which copy to keep.
- **Conflicts are visible, never silent.** If the other device wrote while this one
  had unsaved changes, the console asks which copy to keep and takes a local
  snapshot first, so the losing version can always be restored from
  **Settings → Data & backup → restore points**.
- **No merge.** Records are not merged field by field; the register is one
  document. With two people editing the same roster at the same minute, one of them
  will be asked to choose. That is honest, and it is what the free tier supports.

## Limit worth knowing

Supabase's free tier allows a 500 MB database. A whole register for this laboratory
is a few hundred kilobytes, so history is not a concern; the table keeps only the
current document plus your restore points in the browser.
