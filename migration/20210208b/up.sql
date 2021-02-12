ALTER TABLE map_cell
    ALTER COLUMN poster_number TYPE text;

ALTER TABLE map_cell
    ADD CONSTRAINT map_cell_room_poster_number_key UNIQUE (room, poster_number);

DELETE FROM schema_version;

INSERT INTO schema_version ("version")
    VALUES ('20210208b');

