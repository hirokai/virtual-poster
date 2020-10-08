package api

import (
	"gin_test/model"
	"gin_test/models"
	"log"

	"github.com/gin-gonic/gin"
)

type MapPosterData struct {
	ID               string             `json:"id" db:"id"`                                 // id
	LastUpdated      int64              `json:"last_updated" db:"last_updated"`             // last_updated
	Location         string             `json:"location" db:"location"`                     // location
	Title            models.NullString  `json:"title" db:"title"`                           // title
	Author           string             `json:"author" db:"author"`                         // author
	AccessLog        bool               `json:"access_log" db:"access_log"`                 // access_log
	AuthorOnlineOnly bool               `json:"author_online_only" db:"author_online_only"` // author_online_only
	X                int64              `json:"x"`
	Y                int64              `json:"y"`
	PosterNumber     int64              `json:"poster_number"`
	CustomImage      *models.NullString `json:"custom_image,omitempty"`

	// xo fields
	_exists, _deleted bool
}

func MapPosters(c *gin.Context) {
	roomId := c.Param("roomId")
	rows, _ := model.Db.Queryx(`
	SELECT
		p.id,
		p.last_updated,
		p.location,
		p.title,
		p.author,
		p.access_log,
		p.author_online_only,
		c.x,
		c.y,
		c.poster_number,
		c.custom_image
	from
		poster as p
		join map_cell as c on p.location = c.id
	where
		location in (
			SELECT
				id
			from
				map_cell
			where
				room = $1
	);`, roomId)
	var posters []MapPosterData = make([]MapPosterData, 0)
	var id, author, location string
	var title models.NullString
	var custom_image *string
	var last_updated, x, y, poster_number int64
	var access_log, author_online_only bool
	if rows.Next() {
		err := rows.Scan(&id, &last_updated, &location, &title, &author, &access_log, &author_online_only, &x, &y, &poster_number, &custom_image)
		if err != nil {
			log.Panic("DB error", err)
		}
		posters = append(posters, MapPosterData{ID: id, Location: location, X: x, Y: y, PosterNumber: poster_number, Author: author, Title: title, LastUpdated: last_updated, AuthorOnlineOnly: author_online_only, AccessLog: access_log})
	}
	c.JSON(200, posters)
}
