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
  key: 'sb_publishable_60QVktnGsJo_RPPzFGtITQ_pt3NC',
  /* A visitor never pushes, so this is the only mode it may use. */
  mode: 'pull',
  label: 'Ruli DH · shared register'
};
