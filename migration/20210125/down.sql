DROP TABLE schema_version;

DROP TABLE cell_visit_history;

DROP TYPE visit_history;

ALTER TABLE room
    DROP COLUMN IF EXISTS minimap_visibility,
    DROP COLUMN IF EXISTS move_log;

DROP TYPE minimap_visibility;

