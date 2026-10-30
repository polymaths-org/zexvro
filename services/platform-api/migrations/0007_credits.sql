CREATE TABLE platform_admins (account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE) WITHOUT ROWID;
CREATE TABLE promo_codes (
 code TEXT PRIMARY KEY, amount INTEGER NOT NULL CHECK(amount BETWEEN 1 AND 1000000),
 remaining INTEGER NOT NULL CHECK(remaining>=0), starts_at INTEGER NOT NULL DEFAULT 0,
 expires_at INTEGER, status TEXT NOT NULL DEFAULT 'active', data TEXT NOT NULL CHECK(json_valid(data))
) WITHOUT ROWID;
CREATE TABLE promo_redemptions (
 code TEXT NOT NULL REFERENCES promo_codes(code), workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 created_at INTEGER NOT NULL, PRIMARY KEY(code,workspace_id)
) WITHOUT ROWID;
CREATE TRIGGER credit_ledger_validate BEFORE INSERT ON credit_ledger
WHEN json_type(NEW.data,'$.delta') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM credit_ledger WHERE workspace_id=NEW.workspace_id AND ref=NEW.ref)
BEGIN
 SELECT CASE WHEN json_type(NEW.data,'$.delta')<>'integer' OR abs(json_extract(NEW.data,'$.delta'))>1000000 THEN RAISE(ABORT,'credit_invalid_amount') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM credit_balances WHERE workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'credit_account_missing') END;
 SELECT CASE WHEN (SELECT balance FROM credit_balances WHERE workspace_id=NEW.workspace_id)+json_extract(NEW.data,'$.delta')<0 THEN RAISE(ABORT,'credit_insufficient') END;
END;
CREATE TRIGGER credit_ledger_apply AFTER INSERT ON credit_ledger
WHEN json_type(NEW.data,'$.delta')='integer'
BEGIN
 UPDATE credit_balances SET balance=balance+json_extract(NEW.data,'$.delta'),updated_at=json_extract(NEW.data,'$.createdAt') WHERE workspace_id=NEW.workspace_id;
END;
CREATE TRIGGER promo_validate BEFORE INSERT ON promo_redemptions
BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM promo_codes WHERE code=NEW.code AND status='active' AND remaining>0 AND starts_at<=NEW.created_at AND (expires_at IS NULL OR expires_at>NEW.created_at)) THEN RAISE(ABORT,'promo_invalid_or_exhausted') END;
END;
CREATE TRIGGER promo_apply AFTER INSERT ON promo_redemptions
BEGIN
 UPDATE promo_codes SET remaining=remaining-1 WHERE code=NEW.code;
 INSERT INTO credit_ledger(workspace_id,id,ref,data)
 SELECT NEW.workspace_id,printf('%013d_promo_%s',NEW.created_at,lower(hex(randomblob(12)))),'promo:'||NEW.code,
 json_object('type','promo','amount',p.amount,'delta',p.amount,'balanceAfter',b.balance+p.amount,'reason','promo:'||NEW.code,'createdAt',NEW.created_at,'workspaceId',NEW.workspace_id,'ref','promo:'||NEW.code)
 FROM promo_codes p JOIN credit_balances b ON b.workspace_id=NEW.workspace_id WHERE p.code=NEW.code;
END;
