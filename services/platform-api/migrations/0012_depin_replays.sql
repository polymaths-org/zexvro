-- Shared atomic paid-request replay claims, retained only until expiry.
CREATE TABLE depin_replays (key TEXT PRIMARY KEY, expires_at INTEGER NOT NULL) WITHOUT ROWID;
CREATE INDEX depin_replay_expiry ON depin_replays(expires_at);
