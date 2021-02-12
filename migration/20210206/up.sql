ALTER TABLE person_stats
    ADD COLUMN room text REFERENCES room (id) NOT NULL,
    ADD COLUMN viewed_posters integer NOT NULL DEFAULT 0,
    ADD COLUMN explored_cells integer NOT NULL DEFAULT 0,
    ALTER COLUMN walking_steps SET DEFAULT 0,
    ALTER COLUMN chat_count SET DEFAULT 0,
    ALTER COLUMN chat_char_count SET DEFAULT 0;

ALTER TABLE person_stats
    DROP CONSTRAINT person_stats_pkey;

ALTER TABLE person_stats
    ADD PRIMARY KEY (person, room);

INSERT INTO person_stats (person, room, walking_steps, viewed_posters, explored_cells, chat_count, chat_char_count)
SELECT
    person.id AS person,
    room.id AS room,
    0,
    0,
    0,
    0,
    0
FROM
    person,
    room;

CREATE TABLE people_interaction (
    person1 text REFERENCES person (id) NOT NULL,
    person2 text REFERENCES person (id) NOT NULL,
    room text REFERENCES room (id) NOT NULL,
    chat_sessions integer NOT NULL DEFAULT 0,
    chat_messages integer NOT NULL DEFAULT 0,
    PRIMARY KEY (person1, person2, room),
    CHECK (person1 < person2)
);

DELETE FROM schema_version;

INSERT INTO schema_version ("version")
    VALUES ('20210206');

