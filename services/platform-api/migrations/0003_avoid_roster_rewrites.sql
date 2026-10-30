-- Settings/name updates must not rewrite all membership rows.
DROP TRIGGER workspace_members_update;
CREATE TRIGGER workspace_members_update AFTER UPDATE OF data ON workspaces
WHEN json_extract(OLD.data,'$.members') IS NOT json_extract(NEW.data,'$.members')
BEGIN
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
