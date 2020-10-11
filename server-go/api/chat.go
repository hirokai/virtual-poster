package api

import (
	"gin_test/model"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

func MapComments(c *gin.Context) {
	roomId := c.Param("roomId")
	person := "UrOXPyH_iL"
	rows, err := model.Db.Queryx(`
	SELECT
            'from_me' AS mode,
            c.id AS id,
            c.person,
            c.x,
            c.y,
            array_agg(cp.encrypted) AS to_e,
            array_agg(cp.person) AS to,
            array_agg(cp.comment_encrypted) AS to_c,
            c.timestamp,
            c.last_updated,
            c.kind,
            c.text,
            c.reply_to
        FROM
            comment AS c
            LEFT JOIN comment_to_person AS cp ON c.id = cp.comment
        WHERE
            c.person = $1
            AND room = $2
            AND kind = 'person'
        GROUP BY
            c.id,
            c.x,
            c.y,
            c.text,
            c.timestamp,
            c.last_updated,
            c.person,
            c.kind,
            c.text
        ORDER BY
            c.timestamp;`, person, roomId)
	if err != nil {
		log.Panic(err)
	}
	var comments []model.Comment = make([]model.Comment, 0)

	for rows.Next() {
		var c model.CommentRDB
		//rows.Scanの代わりにrows.StructScanを使う
		err := rows.StructScan(&c)
		if err != nil {
			log.Panic(err)
			continue
		}
		texts := make([]model.EncryptedEntry, 0)
		for i := range c.To {
			texts = append(texts, model.EncryptedEntry{To: c.To[i], Encrypted: c.To_e[i], Text: c.To_c[i]})
		}
		comment1 := model.Comment{ID: c.Id, Timestamp: c.Timestamp, LastUpdated: c.LastUpdated, Person: c.Person, Kind: c.Kind, Texts: texts, ReplyTo: c.ReplyTo}
		comments = append(comments, comment1)
	}

	c.JSON(http.StatusOK, comments)
}
