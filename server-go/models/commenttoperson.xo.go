// Package models contains the types for schema 'public'.
package models

// Code generated by xo. DO NOT EDIT.

import (
	"database/sql"
)

// CommentToPerson represents a row from 'public.comment_to_person'.
type CommentToPerson struct {
	Comment          string       `json:"comment" db:"comment"`                     // comment
	Person           string       `json:"person" db:"person"`                       // person
	CommentEncrypted NullString   `json:"comment_encrypted" db:"comment_encrypted"` // comment_encrypted
	Encrypted        sql.NullBool `json:"encrypted" db:"encrypted"`                 // encrypted

	// xo fields
	_exists, _deleted bool
}