ALTER TABLE
    person
ALTER COLUMN
    email
SET
    NOT NULL;

ALTER TABLE
    person
ADD
    UNIQUE (email);

ALTER TABLE
    person_position
ADD
    UNIQUE (room,x,y);

ALTER TABLE comment_to_person RENAME COLUMN to_user TO person;

ALTER TABLE person_room_access RENAME COLUMN "user" TO person;

ALTER TABLE comment RENAME COLUMN "user" TO person;
