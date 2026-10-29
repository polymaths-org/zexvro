ALTER TABLE nft_collections ADD COLUMN minted_count INTEGER NOT NULL DEFAULT 0;
UPDATE nft_collections SET minted_count=(SELECT count(*) FROM nft_minted WHERE collection_id=nft_collections.id);
CREATE TRIGGER nft_minted_insert AFTER INSERT ON nft_minted BEGIN
 UPDATE nft_collections SET minted_count=minted_count+1 WHERE id=NEW.collection_id;
END;
CREATE TRIGGER nft_minted_delete AFTER DELETE ON nft_minted BEGIN
 UPDATE nft_collections SET minted_count=minted_count-1 WHERE id=OLD.collection_id;
END;
