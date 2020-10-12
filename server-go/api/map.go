package api

import (
	"encoding/json"
	"gin_test/model"
	"gin_test/models"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

func Maps(c *gin.Context) {
	log.Println(c.Request.Context().Value("requester"))
	rows, err := model.Db.Queryx(
		`
		SELECT
            room.id,
            room.name,
            count(c.poster_number) as poster_location_count,
            count(poster.id) as poster_count,
            max(c.x) as max_x,
            max(c.y) as max_y
        FROM
            room
            LEFT JOIN map_cell as c on room.id = c.room
            LEFT JOIN poster ON c.id = poster.location
            JOIN person_room_access AS a ON room.id = a.room
        WHERE
            a.person = $1
        GROUP BY
            room.id;`, GetRequester(c))
	if err != nil {
		log.Panic(err)
	}
	var rooms []models.Room = make([]models.Room, 0)

	var room models.Room
	for rows.Next() {
		var id, name string
		var poster_location_count, poster_count, max_x, max_y int64
		err := rows.Scan(&id, &name, &poster_location_count, &poster_count, &max_x, &max_y)
		if err != nil {
			log.Panic(err)
			continue
		}
		room = models.Room{ID: id, Name: name, PosterLocationCount: poster_location_count, PosterCount: poster_count, NumCols: max_x + 1, NumRows: max_y + 1}
		rooms = append(rooms, room)
	}

	c.JSON(http.StatusOK, rooms)
}

func Map(c *gin.Context) {
	roomId := c.Param("roomId")
	v, err := model.Client.Get("map_cache:" + roomId).Result()
	if v != "" {
		log.Println("Returning cache")
		c.Header("Content-Type", "application/json; charset=utf-8")
		c.String(http.StatusOK, v)
		return
	}

	rows, err := model.Db.Queryx("SELECT * FROM map_cell WHERE room=$1", roomId)
	if err != nil {
		log.Panic(err)
	}
	var people []models.MapCell = make([]models.MapCell, 0)

	var user models.MapCell
	for rows.Next() {
		err := rows.StructScan(&user)
		if err != nil {
			log.Panic(err)
			continue
		}
		people = append(people, user)
	}
	if len(people) == 0 {
		c.String(404, "Not found")
		return
	}

	rows, err = model.Db.Queryx("SELECT max(x) AS max_x, max(y) AS max_y FROM map_cell WHERE room=$1", c.Param("roomId"))
	if err != nil {
		log.Panic(err)
	}

	var max_x, max_y int64
	for rows.Next() {
		err = rows.Scan(&max_x, &max_y)
		if err != nil {
			log.Panic(err)
		}
	}

	numCols := max_x + 1
	numRows := max_y + 1

	cells := make([][]models.MapCell, numRows)
	for i := range cells {
		cells[i] = make([]models.MapCell, numCols)
	}
	for _, cell := range people {
		cells[cell.Y][cell.X] = cell
	}

	obj1 := map[string]interface{}{"cells": cells, "numCols": numCols, "numRows": numRows}
	obj := gin.H(obj1)
	s, err := json.Marshal(obj1)
	model.Client.Set("map_cache:"+roomId, s, 0)
	// log.Println(r)

	c.JSON(http.StatusOK, obj)
}

func MapGroups(c *gin.Context) {

	c.JSON(http.StatusOK, make([]int, 0))
}

func GetRequester(c *gin.Context) string {
	return c.Request.Context().Value("requester").(string)
}

func MapEnter(c *gin.Context) {
	roomId := c.Param("roomId")

	person := GetRequester(c)
	row := model.Db.QueryRowx("SELECT count(*) FROM person_position where person=$1 and room=$2;", person, roomId)

	var count int64
	err := row.Scan(&count)
	if err != nil {
		c.String(400, "Person not in room")
		return
	}

	var public_key string
	row = model.Db.QueryRowx("SELECT public_key FROM public_key WHERE person=$1;", person)
	row.Scan(&public_key)

	row = model.Db.QueryRowx("SELECT count(*) from room where id=$1", roomId)
	if err = row.Scan(&count); err != nil {
		log.Panic()
	}
	if count == 0 {
		c.JSON(200, gin.H{"ok": false, "status": "DoesNotExist"})
		return
	}
	row = model.Db.QueryRowx("SELECT count(*) FROM person_position where person=$1 and room=$2;", person, roomId)
	if err = row.Scan(&count); err != nil {
		log.Panic()
	}
	if count == 0 {
		h := model.AssignPosition(roomId, person)
		c.JSON(200, gin.H{"ok": h.Ok, "status": h.Status, "socket_url": "/ws", "socket_protocol": "WebSocket", "public_key": public_key})
	} else {
		c.JSON(http.StatusOK, gin.H{"ok": true, "status": "ComeBack", "socket_url": "/ws", "socket_protocol": "WebSocket", "public_key": public_key})
	}
}
