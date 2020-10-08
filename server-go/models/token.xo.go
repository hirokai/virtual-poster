// Package models contains the types for schema 'public'.
package models

// Code generated by xo. DO NOT EDIT.

// Token represents a row from 'public.token'.
type Token struct {
	Person   string `json:"person" db:"person"`       // person
	Token    string `json:"token" db:"token"`         // token
	ExpireAt int64  `json:"expire_at" db:"expire_at"` // expire_at

	// xo fields
	_exists, _deleted bool
}
