-- Private D1 database only; not the shared Lab Systems register.
CREATE TABLE IF NOT EXISTS hiv_state (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
