package model

import (
	"log"

	"github.com/go-redis/redis"
	"github.com/jmoiron/sqlx"
)

var Db *sqlx.DB
var err error
var Client *redis.Client
var ClientSessions *redis.Client

func Init() (*sqlx.DB, *redis.Client) {
	Db, err = sqlx.Connect("postgres", "postgres://postgres@localhost/virtual_poster?sslmode=disable")
	if err != nil {
		log.Fatalln(err)
	}
	log.Println("Connected to PostgreSQL")
	Client = redis.NewClient(&redis.Options{
		Addr:     "localhost:6379",
		Password: "", // no password set
		DB:       0,  // use default DB
	})
	ClientSessions = redis.NewClient(&redis.Options{
		Addr:     "localhost:6379",
		Password: "", // no password set
		DB:       3,  // use default DB
	})
	log.Println("Connected to Redis")
	return Db, Client
}
