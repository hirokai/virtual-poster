ALTER TABLE map_cell
    ALTER COLUMN poster_number TYPE integer
    USING poster_number::integer;

ALTER TABLE map_cell
    DROP CONSTRAINT map_cell_room_poster_number_key;

DELETE FROM schema_version;

INSERT INTO schema_version ("version")
    VALUES ('20210208');

