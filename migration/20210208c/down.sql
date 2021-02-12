ALTER TABLE poster
    DROP COLUMN attr1_key,
    DROP COLUMN attr1_val,
    DROP COLUMN attr2_key,
    DROP COLUMN attr2_val,
    DROP COLUMN attr3_key,
    DROP COLUMN attr3_val,
    DROP COLUMN attr4_key,
    DROP COLUMN attr4_val,
    DROP COLUMN attr5_key,
    DROP COLUMN attr5_val;

DELETE FROM schema_version;

INSERT INTO schema_version ("version")
    VALUES ('20210208b');

