CREATE TABLE notification (
    id text PRIMARY KEY,
    person text NOT NULL REFERENCES person (id) ON DELETE CASCADE,
    room text REFERENCES room (id) ON DELETE CASCADE,
    "timestamp" bigint NOT NULL,
    kind text NOT NULL,
    resolved_time bigint,
    email_sent boolean NOT NULL DEFAULT 'f',
    app_notified boolean NOT NULL DEFAULT 'f',
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
    "notification" text REFERENCES "notification" (id) ON DELETE CASCADE,
    retry_count integer NOT NULL DEFAULT 0
);

DELETE FROM schema_version;

INSERT INTO schema_version ("version")
    VALUES ('20210208');

