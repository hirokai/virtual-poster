CREATE TYPE chat_type AS ENUM ('poster', 'people');

CREATE TABLE chat_group (
    id text primary key,
    name text,
    last_updated bigint not null,
    room text not null references room(id),
    location text references map_cell(id),
    color varchar(100),
    kind chat_type not null
);

CREATE TABLE person_in_chat_group (
    person text references person(id),
    chat text references chat_group(id),
    primary key (person, chat)
);