CREATE TYPE chat_event_type AS ENUM (
    'new',
    'join',
    'add',
    'leave',
    'dissolve',
    'start_overhear',
    'end_overhear',
    'set_private'
);

CREATE TABLE chat_event (
    id text PRIMARY KEY,
    "chat_group" text NOT NULL,
    person text NOT NULL,
    event_type chat_event_type NOT NULL,
    event_data json,
    "timestamp" bigint NOT NULL
);

CREATE TABLE chat_event_recipient (
    event text REFERENCES chat_event (id) NOT NULL,
    person text REFERENCES person (id) NOT NULL,
    PRIMARY KEY (event, person)
);

