CREATE TABLE poster_viewer (
    poster text references poster(id) not null,
    person text references person(id) not null,
    joined_time bigint not null,
    left_time bigint,
    last_active bigint
);