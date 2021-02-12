ALTER TABLE
    person
ADD
    COLUMN "role" user_role;

UPDATE
    person
SET
    "role" = 'user';

ALTER TABLE
    person
ALTER COLUMN
    "role"
SET
NOT NULL;

CREATE TABLE token
(
    person text references person(id) primary key,
    token text not null,
    expire_at bigint not null
);

CREATE TABLE announce
(
    room text references room(id) primary key,
    "text" text not null,
    "marquee" boolean not null,
    period integer
)