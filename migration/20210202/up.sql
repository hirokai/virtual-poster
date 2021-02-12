CREATE TABLE people_group (
    id text PRIMARY KEY,
    room text REFERENCES room (id),
    "name" text NOT NULL,
    description text,
    UNIQUE (room, "name")
);

CREATE TABLE person_in_people_group (
    people_group text REFERENCES people_group (id) NOT NULL,
    person_email text NOT NULL,
    PRIMARY KEY (people_group, person_email)
);

ALTER TABLE room_access_code
    ADD CONSTRAINT room_access_code_code_key UNIQUE (code);

CREATE TABLE map_region (
    room text REFERENCES room (id) NOT NULL,
    "name" text NOT NULL,
    description text,
    x1 integer NOT NULL,
    y1 integer NOT NULL,
    x2 integer NOT NULL,
    y2 integer NOT NULL,
    UNIQUE (room, "name")
);

CREATE TABLE map_rule (
    room text NOT NULL,
    group_name text NOT NULL,
    region_name text NOT NULL,
    -- room text REFERENCES people_group (room) NOT NULL,
    -- group_name text REFERENCES people_group ("name") NOT NULL,
    -- region_name text REFERENCES map_region ("name") NOT NULL,
    operation text NOT NULL,
    allow boolean NOT NULL,
    rule_order integer NOT NULL,
    UNIQUE (room, group_name, region_name, operation),
    UNIQUE (room, rule_order)
);

DELETE FROM schema_version;

INSERT INTO schema_version ("version")
    VALUES ('20210202');

