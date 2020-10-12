package main

import (
	"bytes"
	"context"
	"gin_test/api"
	"gin_test/model"
	"io/ioutil"
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis"
	"github.com/jmoiron/sqlx"

	_ "github.com/lib/pq"
)

var db *sqlx.DB
var client *redis.Client
var FastifyPort string
var JesterPort string = "5050"

// Generate structs from schema
// https://gift-tech.co.jp/articles/golang-xo-sqlx/
// xo "postgres://postgres@localhost/virtual_poster?sslmode=disable" -o models --template-path templates/

func main() {

	FastifyPort = os.Getenv("REST_NODE_PORT")
	if FastifyPort == "" {
		FastifyPort = "3030"
	}

	db, client = model.Init()

	// engine := gin.New()
	// engine.Use(gin.Recovery())
	engine := gin.Default()
	engine.GET("/api/ping", func(c *gin.Context) {
		c.String(200, "pong\n")
	})
	authedRoutes := engine.Group("/api")
	authedRoutes.Use(authedRoute())
	{
		authedRoutes.GET("/maps", api.Maps)
		authedRoutes.GET("/maps/:roomId", api.Map)
		authedRoutes.POST("/maps/:roomId/enter", api.MapEnter)
		authedRoutes.GET("/maps/:roomId/posters", api.MapPosters)
		authedRoutes.GET("/maps/:roomId/comments", api.MapComments)
	}
	fastifyRoutes := engine.Group("/api")
	fastifyRoutes.Use(stubRoute("Fastify"))
	{
		fastifyRoutes.GET("/blind_sign/key_pair", api.Stub)
		fastifyRoutes.POST("/blind_sign/sign", api.Stub)
		fastifyRoutes.GET("/blind_sign/verify", api.Stub)
		fastifyRoutes.PATCH("/comments/:commentId", api.Stub)
		fastifyRoutes.DELETE("/comments/:commentId", api.Stub)
		fastifyRoutes.POST("/comments/:commentId/reply", api.Stub)
		fastifyRoutes.GET("/groups", api.Stub)
		fastifyRoutes.POST("/id_token", api.Stub)
		fastifyRoutes.POST("/logout", api.Stub)
		fastifyRoutes.POST("/latency_report", api.Stub)
		fastifyRoutes.POST("/maps/:roomId/groups/:groupId/join", api.Stub)
		fastifyRoutes.POST("/maps/:roomId/groups/:groupId/leave", api.Stub)
		fastifyRoutes.POST("/maps/:roomId/groups/:groupId/people", api.Stub)
		fastifyRoutes.GET("/maps/:roomId/groups", api.Stub)
		fastifyRoutes.POST("/maps/:roomId/groups", api.Stub)
		fastifyRoutes.GET("/maps/:roomId/people/:userId/groups", api.Stub)
		fastifyRoutes.GET("/maps/:roomId/people/:userId/poster", api.Stub)
		fastifyRoutes.POST("/maps/:roomId/people/:userId/poster/file", api.Stub)
		fastifyRoutes.POST("/maps/:roomId/poster_slots/:posterNumber", api.Stub)
		fastifyRoutes.DELETE("/maps/:roomId/poster_slots/:posterNumber", api.Stub)
		fastifyRoutes.POST("/maps/:roomId/groups/:groupId/comments", api.Stub)
		fastifyRoutes.POST("/maps/:roomId/posters/:posterId/approach", api.Stub)
		fastifyRoutes.POST("/maps/:roomId/posters/:posterId/enter", api.Stub)
		fastifyRoutes.POST("/maps/:roomId/posters/:posterId/leave", api.Stub)
		fastifyRoutes.GET("/maps/:roomId/posters/:posterId/history", api.Stub)
		fastifyRoutes.GET("/people/:userId", api.Stub)
		fastifyRoutes.GET("/people", api.Stub)
		fastifyRoutes.POST("/people", api.Stub)
		fastifyRoutes.DELETE("/people/:userId", api.Stub)
		fastifyRoutes.GET("/people_multi/:userIds", api.Stub)
		fastifyRoutes.PATCH("/posters/:posterId/comments/:commentId", api.Stub)
		fastifyRoutes.DELETE("/posters/:posterId/comments/:commentId", api.Stub)
		fastifyRoutes.GET("/people/:userId/posters", api.Stub)
		fastifyRoutes.GET("/posters/:posterId/file", api.Stub)
		fastifyRoutes.POST("/posters/:posterId/file", api.Stub)
		fastifyRoutes.DELETE("/posters/:posterId/file", api.Stub)
		fastifyRoutes.GET("/posters/:posterId/comments", api.Stub)
		fastifyRoutes.POST("/posters/:posterId/comments", api.Stub)
		fastifyRoutes.GET("/posters", api.Stub)
		fastifyRoutes.GET("/public_key", api.Stub)
		fastifyRoutes.POST("/public_key", api.Stub)
		fastifyRoutes.POST("/people/:userId/access_code", api.Stub)
		fastifyRoutes.PATCH("/posters/:posterId", api.Stub)
		fastifyRoutes.POST("/posters/:posterId/comments/:commentId/reply", api.Stub)
		fastifyRoutes.GET("/people/:userId/comments", api.Stub)
		fastifyRoutes.POST("/register", api.Stub)
		fastifyRoutes.GET("/socket_url", api.Stub)
	}

	jesterRoutes := engine.Group("/api")
	jesterRoutes.Use(stubRoute("Jester"))
	{
		jesterRoutes.GET("/maps/:roomId/people", api.Stub)
	}

	// engine.GET("/api/maps/:roomId/comments", api.MapComments)
	// engine.GET("/api/maps/:roomId/posters", api.MapPosters)

	engine.Run(":3000")
}

func authedRoute() gin.HandlerFunc {

	return func(c *gin.Context) {

		c.Header("X-Powered-By", "Gin")
		cookie, _ := c.Cookie("virtual_poster_session_id")
		v, _ := model.ClientSessions.Get("cookie:uid:" + cookie).Result()
		log.Println("Auth: '" + v + "'")
		debug_as := c.Query("debug_as")
		debug_token := c.Query("debug_token")
		if debug_as != "" && debug_token != "" {
			c.Request = c.Request.WithContext(context.WithValue(c.Request.Context(), "requester", debug_as))
			c.Next()
			return
		} else {
			if v != "" {
				c.Request = c.Request.WithContext(context.WithValue(c.Request.Context(), "requester", v))
			}
			if v == "" {
				c.String(403, "Unauthorized\n")
				c.Abort()
			} else {
				c.Next()
			}
		}
	}
}

func stubRoute(backend string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var port string
		if backend == "Fastify" {
			port = FastifyPort
			c.Header("X-Powered-By", "Fastify via Gin")
		} else {
			port = JesterPort
			c.Header("X-Powered-By", "Jester via Gin")
		}
		url := "http://localhost:" + port + c.Request.URL.String()
		log.Println("Route Not found, redirecting to "+backend+".", url)
		cookie, _ := c.Cookie("virtual_poster_session_id")
		b, _ := ioutil.ReadAll(c.Request.Body)
		req, _ := http.NewRequest(c.Request.Method, url, bytes.NewReader(b))
		defer c.Request.Body.Close()
		if len(b) > 0 {
			req.Header.Set("Content-Type", "application/json")
		}
		req.AddCookie(&http.Cookie{
			Name:  "virtual_poster_session_id",
			Value: cookie,
		})
		client := new(http.Client)
		resp, _ := client.Do(req)
		b, _ = ioutil.ReadAll(resp.Body)
		// if err == nil {
		// 	fmt.Println(string(b))
		// }
		defer resp.Body.Close()
		m := resp.Header["Set-Cookie"]
		if len(m) > 0 {
			c.Header("Set-Cookie", m[0])
		}
		c.Status(resp.StatusCode)
		c.String(resp.StatusCode, string(b))
	}
}
