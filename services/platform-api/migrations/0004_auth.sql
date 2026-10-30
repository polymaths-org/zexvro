CREATE TABLE accounts (
  id TEXT PRIMARY KEY, username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL, recovery_hash TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL
);
CREATE TABLE sessions (
  access_hash TEXT PRIMARY KEY, refresh_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  version INTEGER NOT NULL, access_expires INTEGER NOT NULL,
  refresh_expires INTEGER NOT NULL, created_at INTEGER NOT NULL
) WITHOUT ROWID;
CREATE INDEX sessions_user ON sessions(user_id,created_at);
CREATE INDEX sessions_expiry ON sessions(refresh_expires);
