CREATE TABLE person_profile (
    person text REFERENCES person (id),
    last_updated bigint NOT NULL,
    "key" text NOT NULL,
    content text,
    metadata jsonb,
    room text REFERENCES room (id),
    UNIQUE (person, room, "key")
);

