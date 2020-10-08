package api

import (
	"gin_test/model"
	"gin_test/models"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

func People(c *gin.Context) {

	v, err := model.Client.Get("uid:UPRCdexmcIrw").Result()
	log.Println(v)

	rows, err := model.Db.Queryx("SELECT * FROM person")
	if err != nil {
		log.Fatal(err)
	}
	var people []models.Person = make([]models.Person, 0)

	var user models.Person
	for rows.Next() {

		//rows.Scanの代わりにrows.StructScanを使う
		err := rows.StructScan(&user)
		if err != nil {
			log.Panic(err)
			continue
		}
		people = append(people, user)
	}

	c.JSON(http.StatusOK, people)
}
