CREATE TABLE public_key (
	person text references person(id) primary key,
    public_key text not null
);

ALTER TABLE
    comment_to_person
ADD
    COLUMN comment_encrypted text;

ALTER TABLE
    comment_to_person
ADD
    COLUMN "encrypted" boolean;