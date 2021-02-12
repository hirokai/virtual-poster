DROP TABLE IF EXISTS email_to_user;

DROP TYPE IF EXISTS email_status;

DROP TABLE IF EXISTS comment_for_notification;

DROP TABLE IF EXISTS notification;

DELETE FROM schema_version;

INSERT INTO schema_version ("version")
    VALUES ('20210206');

