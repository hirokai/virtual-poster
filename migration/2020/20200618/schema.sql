DROP TABLE IF EXISTS comment_to_poster;

DROP TABLE IF EXISTS poster;

DROP TABLE IF EXISTS map_cell;

DROP TABLE IF EXISTS person_room_access;

DROP TABLE IF EXISTS comment_to_person;

DROP TABLE IF EXISTS comment;

DROP TABLE IF EXISTS person_position;

DROP TABLE IF EXISTS person_stats;

DROP TABLE IF EXISTS stat_encountered;

DROP TABLE IF EXISTS person;

DROP TABLE IF EXISTS room;

DROP TYPE IF EXISTS user_role;

DROP TYPE IF EXISTS direction;

CREATE TYPE user_role AS ENUM ('user', 'admin');

CREATE TYPE direction AS ENUM ('left', 'up', 'down', 'right', 'none');

CREATE TABLE room (id text primary key, "name" text not null);

CREATE TABLE map_cell (
	id text primary key,
	room text references room(id) not null,
	x integer not null,
	y integer not null,
	kind text not null,
	poster_number integer,
	custom_image text,
	unique (room, x, y)
);

CREATE TABLE person (
	id text primary key,
	last_updated bigint not null,
	name text not null,
	avatar text,
	email text
);

CREATE TABLE person_position (
	person text not null references person(id),
	room text references room(id) not null,
	last_updated bigint not null,
	x integer not null,
	y integer not null,
	direction direction not null,
	primary key(person, room)
);

CREATE TABLE person_stats (
	person text primary key references person(id),
	walking_steps bigint not null,
	chat_count bigint not null,
	chat_char_count bigint not null
);

CREATE TABLE stat_encountered (
	person text references person(id),
	encountered text references person(id),
	primary key(person, encountered)
);

CREATE TABLE person_room_access (
	room text references room(id) not null,
	"user" text references person(id) not null,
	"role" user_role not null,
	primary key(room, "user")
);

CREATE TABLE comment (
	id text primary key,
	"timestamp" bigint not null,
	last_updated bigint not null,
	"user" text references person(id) not null,
	"text" text not null,
	room text references room(id),
	x integer,
	y integer,
	kind text
);

CREATE TABLE comment_to_person (
	comment text references comment(id),
	to_user text references person(id),
	primary key(comment, to_user)
);

CREATE TABLE poster (
	id text primary key,
	last_updated bigint not null,
	location text references map_cell(id),
	title text,
	author text references person(id)
);

CREATE TABLE comment_to_poster (
	comment text references comment(id),
	poster text references poster(id),
	primary key(comment, poster)
);

INSERT into
	room (id, "name")
values
	('default', 'Public room');

INSERT into
	room (id, "name")
values
	('coitohoku', 'COI東北全体会議');