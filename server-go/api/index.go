package api

import "github.com/gin-gonic/gin"

func Stub(c *gin.Context) {
	c.String(200, "")
}
