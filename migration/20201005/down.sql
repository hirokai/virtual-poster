ALTER TABLE
    poster
DROP
    COLUMN access_log,
DROP
    COLUMN author_online_only;

ALTER TABLE
    poster_viewer
DROP
    COLUMN access_log;
