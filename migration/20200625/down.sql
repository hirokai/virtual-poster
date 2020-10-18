ALTER TABLE
    person DROP CONSTRAINT person_email_key;

ALTER TABLE    person DROP CONSTRAINT person_position_room_x_y_key;

ALTER TABLE
    person
ALTER COLUMN
    email DROP NOT NULL;

ALTER TABLE
    comment_to_person RENAME COLUMN person TO to_user;

ALTER TABLE
    person_room_access RENAME COLUMN person TO "user";

ALTER TABLE
    comment RENAME COLUMN person TO "user";