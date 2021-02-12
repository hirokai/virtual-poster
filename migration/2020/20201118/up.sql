ALTER TABLE poster
    ADD COLUMN file_size integer;


ALTER TABLE
    comment_to_person
ADD
    COLUMN read boolean;

UPDATE
    comment_to_person
SET
    read = false;

ALTER TABLE
    comment_to_person
ALTER COLUMN
    read
SET
    NOT NULL;
