DROP TABLE public_key;

ALTER TABLE
    comment_to_person
DROP
    COLUMN comment_encrypted;

ALTER TABLE
    comment_to_person
DROP
    COLUMN "encrypted";