DROP TABLE IF EXISTS poster_comment_read;

DROP TABLE IF EXISTS chat_event_recipient;

DROP TABLE IF EXISTS chat_event;

DROP TYPE IF EXISTS chat_event_type;

DROP TABLE IF EXISTS poster_viewer;

DROP TABLE IF EXISTS vote;

DROP TABLE IF EXISTS public_key;

DROP TABLE IF EXISTS announce;

DROP TABLE IF EXISTS person_in_chat_group;

DROP TABLE IF EXISTS chat_group;

DROP TABLE IF EXISTS comment_to_poster;

DROP TABLE IF EXISTS poster;

DROP TABLE IF EXISTS map_cell;

DROP TABLE IF EXISTS person_room_access;

DROP TABLE IF EXISTS comment_to_person;

DROP TABLE IF EXISTS comment;

DROP TABLE IF EXISTS person_position;

DROP TABLE IF EXISTS person_stats;

DROP TABLE IF EXISTS stat_encountered;

DROP TABLE IF EXISTS token;

DROP TABLE IF EXISTS person_profile;

DROP TABLE IF EXISTS room;

DROP TABLE IF EXISTS person;

DROP TYPE IF EXISTS user_role;

DROP TYPE IF EXISTS direction;

DROP TYPE IF EXISTS chat_type;

CREATE TYPE chat_type AS ENUM (
    'poster',
    'people'
);

CREATE TYPE user_role AS ENUM (
    'user',
    'admin'
);

CREATE TYPE direction AS ENUM (
    'left',
    'up',
    'down',
    'right',
    'none'
);

CREATE TABLE person (
    id text PRIMARY KEY,
    last_updated bigint NOT NULL,
    name text NOT NULL,
    avatar text,
    email text NOT NULL UNIQUE,
    "role" user_role NOT NULL
);

CREATE TYPE minimap_visibility AS ENUM (
    'all_initial',
    'map_initial',
    'all_only_visited',
    'map_only_visited'
);

CREATE TABLE room (
    id text PRIMARY KEY,
    "name" text NOT NULL,
    room_owner text REFERENCES person (id),
    allow_poster_assignment boolean NOT NULL,
    minimap_visibility minimap_visibility DEFAULT 'all_initial',
    move_log boolean DEFAULT 't'
);

CREATE TABLE person_profile (
    person text REFERENCES person (id),
    last_updated bigint NOT NULL,
    "key" text NOT NULL,
    content text,
    metadata jsonb,
    room text REFERENCES room (id),
    UNIQUE (person, room, "key")
);

CREATE TABLE room_access_code (
    code text NOT NULL UNIQUE,
    room text REFERENCES room (id) NOT NULL,
    active boolean NOT NULL,
    granted_right text NOT NULL,
    timestamp bigint NOT NULL,
    expires bigint
);

CREATE TABLE announce (
    room text REFERENCES room (id) PRIMARY KEY,
    "text" text NOT NULL,
    "marquee" boolean NOT NULL,
    period integer
);

CREATE TABLE map_cell (
    id text PRIMARY KEY,
    room text REFERENCES room (id) NOT NULL,
    x integer NOT NULL,
    y integer NOT NULL,
    kind text NOT NULL,
    no_initial_position boolean,
    poster_number text,
    custom_image text,
    link_url text,
    UNIQUE (room, x, y),
    UNIQUE (room, poster_number)
);

CREATE TABLE person_position (
    person text NOT NULL REFERENCES person (id),
    room text REFERENCES room (id) NOT NULL,
    last_updated bigint NOT NULL,
    x integer NOT NULL,
    y integer NOT NULL,
    direction direction NOT NULL,
    PRIMARY KEY (person, room),
    UNIQUE (room, x, y)
);

CREATE TABLE person_stats (
    person text REFERENCES person (id) NOT NULL,
    room text REFERENCES room (id) NOT NULL,
    walking_steps bigint NOT NULL DEFAULT 0,
    viewed_posters integer NOT NULL DEFAULT 0,
    explored_cells integer NOT NULL DEFAULT 0,
    chat_count bigint NOT NULL DEFAULT 0,
    chat_char_count bigint NOT NULL DEFAULT 0,
    PRIMARY KEY (person, room)
);

CREATE TABLE stat_encountered (
    person text REFERENCES person (id),
    encountered text REFERENCES person (id),
    PRIMARY KEY (person, encountered)
);

CREATE TABLE person_room_access (
    room text REFERENCES room (id) NOT NULL,
    email text NOT NULL,
    added_by text,
    "role" user_role NOT NULL,
    PRIMARY KEY (room, email)
);

CREATE TABLE people_group (
    id text PRIMARY KEY,
    room text REFERENCES room (id),
    "name" text NOT NULL,
    description text,
    UNIQUE (room, name)
);

CREATE TABLE person_in_people_group (
    people_group text REFERENCES people_group (id) NOT NULL,
    person_email text NOT NULL,
    PRIMARY KEY (people_group, person_email)
);

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

CREATE TABLE comment (
    id text PRIMARY KEY,
    "timestamp" bigint NOT NULL,
    last_updated bigint NOT NULL,
    person text REFERENCES person (id) NOT NULL,
    "text" text NOT NULL,
    room text REFERENCES room (id),
    x integer,
    y integer,
    kind text,
    reply_to text REFERENCES comment (id)
);

CREATE TABLE comment_to_person (
    comment text REFERENCES comment (id) NOT NULL,
    person text REFERENCES person (id) NOT NULL,
    comment_encrypted text NOT NULL,
    "encrypted" boolean NOT NULL,
    read boolean NOT NULL,
    PRIMARY KEY (comment, person)
);

CREATE TABLE poster (
    id text PRIMARY KEY,
    last_updated bigint NOT NULL,
    location text UNIQUE REFERENCES map_cell (id),
    title text,
    author text REFERENCES person (id),
    access_log boolean,
    author_online_only boolean,
    file_uploaded boolean NOT NULL,
    file_size integer,
    watermark integer
);

CREATE TABLE comment_to_poster (
    comment text REFERENCES comment (id),
    poster text REFERENCES poster (id),
    PRIMARY KEY (comment, poster)
);

CREATE TABLE token (
    person text REFERENCES person (id) PRIMARY KEY,
    token text NOT NULL,
    expire_at bigint NOT NULL
);

CREATE TABLE chat_group (
    id text PRIMARY KEY,
    name text,
    last_updated bigint NOT NULL,
    room text NOT NULL REFERENCES room (id),
    location text REFERENCES map_cell (id),
    color varchar(100),
    kind chat_type NOT NULL
);

CREATE TABLE person_in_chat_group (
    person text REFERENCES person (id),
    chat text REFERENCES chat_group (id),
    PRIMARY KEY (person, chat)
);

CREATE TABLE public_key (
    person text REFERENCES person (id) PRIMARY KEY,
    public_key text NOT NULL
);

CREATE TABLE vote (
    person text REFERENCES person (id) PRIMARY KEY,
    blinded_signature text NOT NULL
);

CREATE TABLE poster_viewer (
    poster text REFERENCES poster (id) NOT NULL,
    person text REFERENCES person (id) NOT NULL,
    joined_time bigint NOT NULL,
    left_time bigint,
    last_active bigint,
    access_log boolean NOT NULL
);

CREATE TYPE chat_event_type AS ENUM (
    'new',
    'join',
    'add',
    'leave',
    'kick',
    'dissolve',
    'start_overhear',
    'end_overhear',
    'set_private'
);

CREATE TABLE chat_event (
    id text PRIMARY KEY,
    room text REFERENCES room (id) NOT NULL,
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

CREATE TABLE poster_comment_read (
    comment text REFERENCES comment (id) NOT NULL,
    person text REFERENCES person (id) NOT NULL,
    read boolean NOT NULL,
    PRIMARY KEY (comment, person)
);

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

CREATE TABLE notification (
    id text PRIMARY KEY,
    person text REFERENCES person (id) NOT NULL ON DELETE CASCADE,
    room text REFERENCES room (id) ON DELETE CASCADE,
    "timestamp" bigint NOT NULL,
    kind text NOT NULL,
    resolved_time bigint,
    superseded_by text REFERENCES notification (id) ON DELETE CASCADE
);

CREATE TABLE comment_for_notification (
    "notification" text NOT NULL REFERENCES notification (id) ON DELETE CASCADE,
    "comment" text NOT NULL REFERENCES "comment" (id) ON DELETE CASCADE,
    "read" boolean DEFAULT 'f',
    PRIMARY KEY (notification, "comment")
);

CREATE TYPE email_status AS ENUM (
    'queued',
    'sending',
    'sent',
    'failed'
);

CREATE TABLE email_to_user (
    id text PRIMARY KEY,
    send_from text,
    send_to text NOT NULL,
    subject text NOT NULL,
    body text NOT NULL,
    body_html text,
    "timestamp" bigint NOT NULL,
    "status" email_status NOT NULL,
    "notification" text REFERENCES "notification" (id) NOT NULL ON DELETE CASCADE,
    retry_count integer NOT NULL DEFAULT 0
);

CREATE TABLE schema_version (
    "version" text NOT NULL,
    minor_version text
);

INSERT INTO schema_version ("version")
    VALUES ('20210208');

