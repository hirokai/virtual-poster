package model

import (
	"gin_test/models"
	"strings"
)

type Comment struct {
	ID          string            `json:"id" db:"id"`                     // id
	Timestamp   int64             `json:"timestamp" db:"timestamp"`       // timestamp
	LastUpdated int64             `json:"last_updated" db:"last_updated"` // last_updated
	Person      string            `json:"person" db:"person"`             // person
	Text        string            `json:"text" db:"text"`                 // text
	Room        models.NullString `json:"room" db:"room"`                 // room
	X           models.NullInt64  `json:"x" db:"x"`                       // x
	Y           models.NullInt64  `json:"y" db:"y"`                       // y
	Kind        string            `json:"kind" db:"kind"`                 // kind
	ReplyTo     models.NullString `json:"reply_to" db:"reply_to"`         // reply_to
	Texts       []EncryptedEntry  `json:"texts"`
	// xo fields
	_exists, _deleted bool
}

type EncryptedEntry struct {
	To        string `json:"to"`
	Text      string `json:"text"`
	Encrypted bool   `json:"encrypted"`
}

type CommentRDB struct {
	Mode        string            `json:"mode" db:"mode"`
	Id          string            `json:"id" db:"id"`
	Person      string            `json:"person" db:"person"`
	X           int32             `json:"x" db:"x"`
	Y           int32             `json:"y" db:"y"`
	To_e        BoolList          `db:"to_e"`
	To_c        StringList        `db:"to_c"`
	To          StringList        `db:"to"`
	Timestamp   int64             `db:"timestamp"`
	LastUpdated int64             `db:"last_updated"`
	Kind        string            `json:"kind" db:"kind"`
	Text        string            `json:"text" db:"text"`
	ReplyTo     models.NullString `json:"reply_to" db:"reply_to"`
}

type StringList []string

func (list *StringList) Scan(src interface{}) error {
	if data, ok := src.([]byte); ok && len(data) > 0 {
		s := string(data)
		var inside_quote = false
		var escaped = false
		var tokens = make([]string, 0)
		var s_accum = make([]byte, 0)
		for i := 0; i < len(s); i++ {
			if s[i] == '"' && !escaped && !inside_quote {
				inside_quote = true
			} else if s[i] == '"' && !escaped && inside_quote {
				inside_quote = false
			} else if s[i] == '\\' && !escaped {
				escaped = true
			} else if s[i] == ',' && !escaped {
				if inside_quote {
					s_accum = append(s_accum, s[i])
				} else {
					tokens = append(tokens, string(s_accum))
					s_accum = make([]byte, 0)
				}
			} else if s[i] == '{' && !escaped {
				if inside_quote {

					s_accum = append(s_accum, s[i])
				} else {
					s_accum = make([]byte, 0)
				}
			} else if s[i] == '}' && !escaped {
				if inside_quote {
					s_accum = append(s_accum, s[i])
				} else {
					tokens = append(tokens, string(s_accum))
					s_accum = make([]byte, 0)
				}
			} else {
				escaped = false
				s_accum = append(s_accum, s[i])
			}

		}

		*list = tokens
	}
	return nil
}

type BoolList []bool

func (list *BoolList) Scan(src interface{}) error {
	if data, ok := src.([]byte); ok && len(data) > 0 {
		s := string(data)
		// if err := json.Unmarshal(data, list); err != nil {
		// 	return err
		// }
		bs := make([]bool, 0)
		for _, s1 := range strings.Split(s[1:len(s)-1], ",") {
			var b bool
			if s1 == "t" {
				b = true
			} else {
				b = false
			}
			bs = append(bs, b)
		}
		*list = bs
	}
	return nil
}
