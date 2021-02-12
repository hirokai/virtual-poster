BEGIN;

ALTER TABLE
    poster
ADD
    COLUMN access_log boolean,
ADD
    COLUMN author_online_only boolean;

UPDATE
    poster
SET
    access_log = false,
    author_online_only = false;

ALTER TABLE
    poster
ALTER COLUMN
    access_log
SET
    NOT NULL,
ALTER COLUMN
    author_online_only
SET
    NOT NULL;

ALTER TABLE
    poster_viewer
ADD
    COLUMN access_log boolean;

UPDATE
    poster_viewer
SET
    access_log = false;

ALTER TABLE
    poster
ALTER COLUMN
    access_log
SET
    NOT NULL;

COMMIT;