ALTER TABLE poster
    ADD COLUMN attr1_key text,
    ADD COLUMN attr1_val text,
    ADD COLUMN attr2_key text,
    ADD COLUMN attr2_val text,
    ADD COLUMN attr3_key text,
    ADD COLUMN attr3_val text,
    ADD COLUMN attr4_key text,
    ADD COLUMN attr4_val text,
    ADD COLUMN attr5_key text,
    ADD COLUMN attr5_val text;

DELETE FROM schema_version;

INSERT INTO schema_version ("version")
    VALUES ('20210208c');

