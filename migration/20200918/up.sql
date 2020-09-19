ALTER TABLE
    comment
ADD
    COLUMN reply_to text references comment(id);