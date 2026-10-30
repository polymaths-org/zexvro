ALTER TABLE device_codes ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE device_codes ADD COLUMN account_version INTEGER;
