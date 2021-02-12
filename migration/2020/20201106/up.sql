CREATE TABLE room_access_code (
    code text NOT NULL,
    room text REFERENCES room (id) NOT NULL,
    active boolean NOT NULL,
    granted_right text NOT NULL,
    timestamp bigint NOT NULL,
    expires bigint
);

ALTER TABLE person_room_access
    DROP CONSTRAINT person_room_access_pkey;

ALTER TABLE person_room_access
    ADD COLUMN email text,
    ADD COLUMN added_by text;

UPDATE
    person_room_access
SET
    email = person.email
FROM
    person
WHERE
    person_room_access.person = person.id;

ALTER TABLE person_room_access
    DROP COLUMN person;

ALTER TABLE person_room_access
    ALTER COLUMN email SET NOT NULL;

ALTER TABLE person_room_access
    ADD CONSTRAINT person_room_access_pkey PRIMARY KEY (room, email);

ALTER TABLE room
    ADD COLUMN allow_poster_assignment boolean;

UPDATE
    room
SET
    allow_poster_assignment = 'f';

ALTER TABLE room
    ALTER COLUMN allow_poster_assignment SET NOT NULL;

ALTER TABLE poster
    ADD COLUMN file_uploaded boolean;

UPDATE
    poster
SET
    file_uploaded = 'f';

ALTER TABLE poster
    ALTER COLUMN file_uploaded SET NOT NULL;