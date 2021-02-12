DROP TABLE IF EXISTS people_interaction;

DELETE FROM person_stats;

ALTER TABLE person_stats
    DROP COLUMN room,
    DROP COLUMN viewed_posters,
    DROP COLUMN explored_cells;

ALTER TABLE person_stats
    DROP CONSTRAINT person_stats_pkey;

ALTER TABLE person_stats
    ADD PRIMARY KEY person;

DELETE FROM schema_version;

INSERT INTO schema_version ("version")
    VALUES ('20210202');

