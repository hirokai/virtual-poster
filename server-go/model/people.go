package model

import (
	"fmt"
	"time"
)

func AssignPosition(room string, person string) struct {
	Ok     bool
	Status string
} {
	var count int64
	row := Db.QueryRowx("SELECT count(*) from person_room_access where room=$1 and person=$2;", room, person)
	row.Scan(&count)
	if count == 0 {
		return struct {
			Ok     bool
			Status string
		}{Ok: false, Status: "NoAccess"}

	}
	direction := "up"
	last_updated := time.Now().UnixNano() / 1e6
	row = Db.QueryRowx(
		`INSERT INTO
				person_position (room, person, last_updated, x, y, direction)
			SELECT
				$1,
				$2,
				$3,
				x,
				y,
				$4
			FROM
				map_cell
			WHERE
				room = $1
				AND (x, y) NOT IN (
					SELECT
						x,
						y
					FROM
						person_position
					WHERE
						room = $1
				)
				AND kind NOT IN ('water', 'wall', 'poster', 'poster_seat')
			ORDER BY
				RANDOM()
			LIMIT
				1 RETURNING x, y;`, room, person, last_updated, direction)
	var x, y int
	if err = row.Scan(&x, &y); err != nil {
		return struct {
			Ok     bool
			Status string
		}{Ok: false, Status: "NoSpace"}
	}
	Client.Set(fmt.Sprintf("pos:%s:%s", room, person), fmt.Sprintf("%d:%d:%s", x, y, direction), 0)

	return struct {
		Ok     bool
		Status string
	}{Ok: true, Status: "New"}
}
