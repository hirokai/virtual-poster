CREATE TABLE people_group (
    id text PRIMARY KEY,
    room text REFERENCES room (id),
    "name" text NOT NULL,
    description text,
    UNIQUE (room, name)
);

CREATE TABLE person_in_people_group (
    people_group text REFERENCES people_group (id) NOT NULL,
    person_email text,
    person_id text REFERENCES person (id),
    CONSTRAINT check_email_or_id CHECK (person_email IS NOT NULL OR person_id IS NOT NULL)
);

ALTER TABLE room_access_code
    ADD CONSTRAINT room_access_code_code_key UNIQUE (code);

