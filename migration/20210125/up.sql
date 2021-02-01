CREATE TYPE minimap_visibility AS ENUM (
    'all_initial',
    'map_initial',
    'all_only_visited',
    'map_only_visited'
);

ALTER TABLE room
    ADD COLUMN minimap_visibility minimap_visibility DEFAULT 'all_initial',
    ADD COLUMN move_log boolean DEFAULT 't';

CREATE TYPE visit_history AS ENUM (
    'visited',
    'seen',
    'state_0',
    'state_1',
    'state_2',
    'state_3',
    'state_4',
    'state_5'
);

CREATE TABLE cell_visit_history (
    person text REFERENCES person (id),
    "location" text REFERENCES map_cell (id),
    last_updated bigint NOT NULL,
    state visit_history NOT NULL,
    PRIMARY KEY (person, "location")
);

CREATE TABLE schema_version (
    "version" text NOT NULL,
    minor_version text
);

INSERT INTO schema_version ("version")
    VALUES ('20210125');

