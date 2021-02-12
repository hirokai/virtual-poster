ALTER TABLE
    room
ADD
    COLUMN room_owner text references person(id);
