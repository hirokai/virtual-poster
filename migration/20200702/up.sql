CREATE TABLE vote (
    person text references person(id) primary key,
    blinded_signature text not null
);