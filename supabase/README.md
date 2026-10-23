# Sync backend (Supabase)

The console stores the register in the browser. This folder holds the small
server side that lets a phone and a PC share it.

## What you have to do once (about five minutes)

1. Create a project at <https://supabase.com> — the free tier is enough for one
   laboratory; pick the region closest to Rwanda (`eu-central-1` or
   `af-south-1` if offered).
2. Open **SQL Editor → New query**, paste `supabase/schema.sql`, run it. It creates
   one table, `lab_registers`, with row-level security on.
3. Open **Authentication → Users → Add user** and create the accounts your staff
   will use (email + password, "Auto confirm" on). Turn off public sign-ups in
   **Authentication → Providers → Email** if you want an invite-only console.
4. Copy **Project URL** and the **anon public** key from **Settings → API**.
5. In Lab Systems open **Staff & Settings → Cloud sync**, paste both values, press
   **Test connection**, then **Save**. The first device that syncs creates the row.

I could not create the hosted project for you: that needs a Supabase account and a
browser session on your own billing/organisation, and this sandbox has no such
access. Everything else — schema, client, retry queue, conflict handling — is in
the repository and works the moment the two values are pasted in.

## How the sync behaves

- **Offline first.** Every edit still lands in `localStorage` immediately. Sync is
  a background copy, never a prerequisite for saving.
- **Push after edits.** A save schedules a push 1.5 s later; failures retry when
  the device comes back online.
- **Pull on open and on demand.** Opening the console pulls the shared copy if it
  is newer than what this device last saw.
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
