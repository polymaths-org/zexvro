CREATE TABLE nft_collections (
 id TEXT PRIMARY KEY, workspace_scope TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)),
 counter INTEGER NOT NULL DEFAULT 0 CHECK(counter BETWEEN 0 AND 4294967295)
);
CREATE INDEX nft_workspace ON nft_collections(workspace_scope,id);
CREATE TABLE nft_checkout (
 id TEXT PRIMARY KEY, collection_id TEXT NOT NULL REFERENCES nft_collections(id) ON DELETE CASCADE,
 idempotency_key TEXT NOT NULL UNIQUE, status TEXT NOT NULL, expires_at TEXT NOT NULL,
 data TEXT NOT NULL CHECK(json_valid(data))
);
CREATE INDEX nft_checkout_expiry ON nft_checkout(expires_at);
CREATE TABLE nft_minted (
 collection_id TEXT NOT NULL REFERENCES nft_collections(id) ON DELETE CASCADE,
 token_id INTEGER NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)),
 PRIMARY KEY(collection_id,token_id)
) WITHOUT ROWID;
CREATE TABLE gate_sites (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, site_key TEXT NOT NULL UNIQUE,
 secret_hash TEXT NOT NULL UNIQUE, data TEXT NOT NULL CHECK(json_valid(data))
);
CREATE INDEX gate_owner ON gate_sites(owner_id,id);
CREATE TABLE gate_origins (
 origin TEXT NOT NULL, site_id TEXT NOT NULL REFERENCES gate_sites(id) ON DELETE CASCADE,
 PRIMARY KEY(origin,site_id)
) WITHOUT ROWID;
CREATE INDEX gate_origin_site ON gate_origins(site_id);
CREATE TABLE gate_policies (
 site_id TEXT NOT NULL REFERENCES gate_sites(id) ON DELETE CASCADE, action TEXT NOT NULL,
 data TEXT NOT NULL CHECK(json_valid(data)), PRIMARY KEY(site_id,action)
) WITHOUT ROWID;
CREATE TABLE gate_agents (
 id TEXT PRIMARY KEY, site_id TEXT NOT NULL REFERENCES gate_sites(id) ON DELETE CASCADE,
 public_key TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)), UNIQUE(site_id,public_key)
);
CREATE INDEX gate_agents_site ON gate_agents(site_id,id);
CREATE TABLE gate_challenges (
 id TEXT PRIMARY KEY, site_id TEXT NOT NULL REFERENCES gate_sites(id) ON DELETE CASCADE,
 status TEXT NOT NULL, expires_at INTEGER NOT NULL, data TEXT NOT NULL CHECK(json_valid(data))
);
CREATE INDEX gate_challenge_expiry ON gate_challenges(expires_at);
CREATE TABLE gate_jti (
 jti TEXT PRIMARY KEY, expires_at INTEGER NOT NULL, remaining INTEGER NOT NULL CHECK(remaining>=0)
) WITHOUT ROWID;
CREATE INDEX gate_jti_expiry ON gate_jti(expires_at);
CREATE TABLE gate_webauthn (
 site_id TEXT NOT NULL REFERENCES gate_sites(id) ON DELETE CASCADE, credential_id TEXT NOT NULL,
 user_id TEXT NOT NULL, counter INTEGER NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)),
 PRIMARY KEY(site_id,credential_id)
) WITHOUT ROWID;
CREATE INDEX gate_credential_user ON gate_webauthn(site_id,user_id,credential_id);
