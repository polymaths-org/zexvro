-- Fresh reset: no destructive DROP statements. Payloads preserve legacy API fields.
PRAGMA foreign_keys = ON;
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL,
  data TEXT NOT NULL CHECK(json_valid(data)), created_at INTEGER NOT NULL,
  UNIQUE(owner_id, name)
);
CREATE TABLE memberships (
  identity TEXT NOT NULL, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('Owner','Admin','Developer','Finance','Viewer','Agent')),
  PRIMARY KEY(identity, workspace_id)
) WITHOUT ROWID;
CREATE INDEX memberships_workspace ON memberships(workspace_id);
CREATE TABLE records (
  kind TEXT NOT NULL, id TEXT NOT NULL, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  data TEXT NOT NULL CHECK(json_valid(data)), created_at INTEGER NOT NULL,
  PRIMARY KEY(kind,id)
) WITHOUT ROWID;
CREATE INDEX records_workspace ON records(kind, workspace_id, id);
CREATE TABLE user_memory (
  username TEXT PRIMARY KEY, data TEXT NOT NULL CHECK(json_valid(data))
) WITHOUT ROWID;
CREATE TABLE personal_records (
  username TEXT NOT NULL, kind TEXT NOT NULL, id TEXT NOT NULL,
  data TEXT NOT NULL CHECK(json_valid(data)), PRIMARY KEY(username,kind,id)
) WITHOUT ROWID;
CREATE TABLE audit_events (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  id TEXT NOT NULL, project_id TEXT, data TEXT NOT NULL CHECK(json_valid(data)),
  PRIMARY KEY(workspace_id,id)
) WITHOUT ROWID;
CREATE INDEX audit_project ON audit_events(workspace_id,project_id,id);
CREATE TABLE credit_balances (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL CHECK(balance >= 0), updated_at INTEGER NOT NULL
) WITHOUT ROWID;
CREATE TABLE credit_ledger (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  id TEXT NOT NULL, ref TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)),
  PRIMARY KEY(workspace_id,id), UNIQUE(workspace_id,ref)
) WITHOUT ROWID;
CREATE TABLE invites (
  token TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL, role TEXT NOT NULL, expires_at INTEGER NOT NULL,
  accepted_by TEXT, data TEXT NOT NULL CHECK(json_valid(data))
) WITHOUT ROWID;
CREATE INDEX invites_workspace ON invites(workspace_id);
CREATE INDEX invites_expiry ON invites(expires_at);
CREATE TABLE device_codes (
  device_code TEXT PRIMARY KEY, user_code TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL, token TEXT, username TEXT
) WITHOUT ROWID;
CREATE INDEX device_expiry ON device_codes(expires_at);

CREATE TRIGGER workspace_members_insert AFTER INSERT ON workspaces BEGIN
 DELETE FROM memberships WHERE workspace_id=NEW.id;
 INSERT INTO memberships(identity,workspace_id,role)
 SELECT identity,NEW.id,CASE MIN(rank) WHEN 0 THEN 'Owner' WHEN 1 THEN 'Admin' WHEN 2 THEN 'Developer' WHEN 3 THEN 'Finance' WHEN 4 THEN 'Viewer' ELSE 'Agent' END FROM (
 SELECT lower(NEW.owner_id) AS identity,0 AS rank
 UNION ALL
 SELECT lower(CAST(json_extract(m.value,'$.id') AS TEXT)), CASE json_extract(m.value,'$.role') WHEN 'Owner' THEN 0 WHEN 'Admin' THEN 1 WHEN 'Developer' THEN 2 WHEN 'Finance' THEN 3 WHEN 'Viewer' THEN 4 ELSE 5 END
 FROM json_each(NEW.data,'$.members') m WHERE json_extract(m.value,'$.status')='active'
 UNION ALL
 SELECT lower(CAST(json_extract(m.value,'$.email') AS TEXT)), CASE json_extract(m.value,'$.role') WHEN 'Owner' THEN 0 WHEN 'Admin' THEN 1 WHEN 'Developer' THEN 2 WHEN 'Finance' THEN 3 WHEN 'Viewer' THEN 4 ELSE 5 END
 FROM json_each(NEW.data,'$.members') m WHERE json_extract(m.value,'$.status')='active'
 ) WHERE identity IS NOT NULL AND identity<>'' GROUP BY identity;
END;

CREATE TRIGGER workspace_members_update AFTER UPDATE OF data ON workspaces BEGIN
 DELETE FROM memberships WHERE workspace_id=NEW.id;
 INSERT INTO memberships(identity,workspace_id,role)
 SELECT identity,NEW.id,CASE MIN(rank) WHEN 0 THEN 'Owner' WHEN 1 THEN 'Admin' WHEN 2 THEN 'Developer' WHEN 3 THEN 'Finance' WHEN 4 THEN 'Viewer' ELSE 'Agent' END FROM (
 SELECT lower(NEW.owner_id) AS identity,0 AS rank
 UNION ALL
 SELECT lower(CAST(json_extract(m.value,'$.id') AS TEXT)), CASE json_extract(m.value,'$.role') WHEN 'Owner' THEN 0 WHEN 'Admin' THEN 1 WHEN 'Developer' THEN 2 WHEN 'Finance' THEN 3 WHEN 'Viewer' THEN 4 ELSE 5 END
 FROM json_each(NEW.data,'$.members') m WHERE json_extract(m.value,'$.status')='active'
 UNION ALL
 SELECT lower(CAST(json_extract(m.value,'$.email') AS TEXT)), CASE json_extract(m.value,'$.role') WHEN 'Owner' THEN 0 WHEN 'Admin' THEN 1 WHEN 'Developer' THEN 2 WHEN 'Finance' THEN 3 WHEN 'Viewer' THEN 4 ELSE 5 END
 FROM json_each(NEW.data,'$.members') m WHERE json_extract(m.value,'$.status')='active'
 ) WHERE identity IS NOT NULL AND identity<>'' GROUP BY identity;
END;
