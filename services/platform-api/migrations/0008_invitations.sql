ALTER TABLE invites ADD COLUMN id TEXT;
ALTER TABLE invites ADD COLUMN revoked INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX invites_id ON invites(workspace_id,id);
