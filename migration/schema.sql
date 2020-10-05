DROP TABLE IF EXISTS poster_viewer;

DROP TABLE IF EXISTS vote;

DROP TABLE IF EXISTS public_key;

DROP TABLE IF EXISTS announce;

DROP TABLE IF EXISTS person_in_chat_group;

DROP TABLE IF EXISTS chat_group;

DROP TABLE IF EXISTS comment_to_poster;

DROP TABLE IF EXISTS poster;

DROP TABLE IF EXISTS map_cell;

DROP TABLE IF EXISTS person_room_access;

DROP TABLE IF EXISTS comment_to_person;

DROP TABLE IF EXISTS comment;

DROP TABLE IF EXISTS person_position;

DROP TABLE IF EXISTS person_stats;

DROP TABLE IF EXISTS stat_encountered;

DROP TABLE IF EXISTS token;

DROP TABLE IF EXISTS person;

DROP TABLE IF EXISTS room;

DROP TYPE IF EXISTS user_role;

DROP TYPE IF EXISTS direction;

DROP TYPE IF EXISTS chat_type;

CREATE TYPE chat_type AS ENUM ('poster', 'people');

CREATE TYPE user_role AS ENUM ('user', 'admin');

CREATE TYPE direction AS ENUM ('left', 'up', 'down', 'right', 'none');

CREATE TABLE room (id text primary key, "name" text not null);

CREATE TABLE announce (
	room text references room(id) primary key,
	"text" text not null,
	"marquee" boolean not null,
	period integer
);

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
	email text not null unique,
	"role" user_role not null
);

CREATE TABLE person_position (
	person text not null references person(id),
	room text references room(id) not null,
	last_updated bigint not null,
	x integer not null,
	y integer not null,
	direction direction not null,
	primary key(person, room),
	unique (room, x, y)
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
	person text references person(id) not null,
	"role" user_role not null,
	primary key(room, person)
);

CREATE TABLE comment (
	id text primary key,
	"timestamp" bigint not null,
	last_updated bigint not null,
	person text references person(id) not null,
	"text" text not null,
	room text references room(id),
	x integer,
	y integer,
	kind text,
	reply_to text references comment(id)
);

CREATE TABLE comment_to_person (
	comment text references comment(id) not null,
	person text references person(id) not null,
	comment_encrypted text not null,
	"encrypted" boolean not null,
	primary key(comment, person)
);

CREATE TABLE poster (
	id text primary key,
	last_updated bigint not null,
	location text unique references map_cell(id),
	title text,
	author text references person(id),
	access_log boolean,
	author_online_only boolean,
);

CREATE TABLE comment_to_poster (
	comment text references comment(id),
	poster text references poster(id),
	primary key(comment, poster)
);

CREATE TABLE token (
	person text references person(id) primary key,
	token text not null,
	expire_at bigint not null
);

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

CREATE TABLE public_key (
	person text references person(id) primary key,
	public_key text not null
);

CREATE TABLE vote (
	person text references person(id) primary key,
	blinded_signature text not null
);

CREATE TABLE poster_viewer (
	poster text references poster(id) not null,
	person text references person(id) not null,
	joined_time bigint not null,
	left_time bigint,
	last_active bigint
);