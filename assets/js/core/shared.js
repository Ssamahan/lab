/* ============================================================================
   LAB SYSTEMS · SHARED REGISTER — the coordinates a visitor reads from
   ----------------------------------------------------------------------------
   These are NOT secrets. A Supabase publishable key is designed to be public: it
   identifies the project, and row-level security decides what it may touch. It is
   safe in a repository and safe in a browser; the secret key (`sb_secret_…`) is the
   one that must never appear here.

   Used for exactly one purpose: when somebody opens the app as a visitor, the
   console reads the shared register from this project — read-only, pull-only, never
   a write. Leave `endpoint` empty to switch that off, and a visitor sees only the
   sample register stored in their own browser.
   ========================================================================== */
window.LS_SHARED = {
  endpoint: 'https://lkjwztvhmzhasclmlocx.supabase.co',
  /* Read this key from the project, never re-typed from a screenshot: a publishable
     key is base62 and two characters that look alike (O and 0, p and P, Z and z) are
     enough for Supabase to answer 401 "Invalid API key" to every read and every write.
     That is what this line was wrong about until v6.9.106 — the register, the visitor
     copy and every sync on every device were all refused, silently, for a week. */
  key: 'sb_publishable_6OQVktnGsJo_RPpZfGtITQ_pt3NCdgJ',
  /* A visitor never pushes, so this is the only mode it may use. */
  mode: 'pull',
  label: 'Ruli DH · shared register',

  /* The laboratory's own devices use the same project, and they do not have to be set
     up one by one: a phone that has never seen this console still has to reach the
     live register, or the register is only as good as the one browser it lives in.
     These are the deployment's coordinates, used whenever a device has none of its
     own — Settings → Cloud sync still overrides them, per device. */
  device: {
    mode: 'push-pull',
    live: true,
    pollMs: 2500,
    pushMs: 700
  }
};
