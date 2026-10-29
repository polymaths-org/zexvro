-- Prevent repeated small patches from growing a user document without bound.
CREATE TRIGGER memory_size_insert BEFORE INSERT ON user_memory
WHEN length(CAST(NEW.data AS BLOB)) > 65536
BEGIN SELECT RAISE(ABORT,'memory_size_limit'); END;
CREATE TRIGGER memory_size_update BEFORE UPDATE ON user_memory
WHEN length(CAST(NEW.data AS BLOB)) > 65536
BEGIN SELECT RAISE(ABORT,'memory_size_limit'); END;
ALTER TABLE personal_records ADD COLUMN project_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.projectId')) VIRTUAL;
CREATE INDEX personal_project ON personal_records(username,kind,project_id,id);
CREATE UNIQUE INDEX note_commitment ON personal_records(username,json_extract(data,'$.commitment')) WHERE kind='note';
