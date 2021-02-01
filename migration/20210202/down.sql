DROP TABLE IF EXISTS person_in_people_group;

DROP TABLE IF EXISTS people_group;

ALTER TABLE room_access_code
    DROP CONSTRAINT room_access_code_code_key;

