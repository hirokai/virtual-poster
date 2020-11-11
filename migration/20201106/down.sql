DROP TABLE room_access_code;

ALTER TABLE person_room_access
    DROP CONSTRAINT person_room_access_pkey;

ALTER TABLE person_room_access
    ADD COLUMN person text REFERENCES person (id);

UPDATE
    person_room_access
SET
    person = person.id
FROM
    person
WHERE
    person_room_access.email = person.email;

ALTER TABLE person_room_access
    ALTER COLUMN person SET NOT NULL;

ALTER TABLE person_room_access
    DROP COLUMN email,
    DROP COLUMN added_by;

ALTER TABLE person_room_access
    ADD CONSTRAINT person_room_access_pkey PRIMARY KEY (room, person);


ALTER TABLE room
    DROP COLUMN allow_poster_assignment;

ALTER TABLE poster
    DROP COLUMN file_uploaded;
