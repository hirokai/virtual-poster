CREATE TABLE poster_comment_read (
    comment text REFERENCES comment (id) NOT NULL,
    person text REFERENCES person (id) NOT NULL,
    read boolean NOT NULL,
    PRIMARY KEY (comment, person)
);

