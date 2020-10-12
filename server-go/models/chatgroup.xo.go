// Package models contains the types for schema 'public'.
package models

// Code generated by xo. DO NOT EDIT.

// ChatGroup represents a row from 'public.chat_group'.
type ChatGroup struct {
	ID          string     `json:"id" db:"id"`                     // id
	Name        NullString `json:"name" db:"name"`                 // name
	LastUpdated int64      `json:"last_updated" db:"last_updated"` // last_updated
	Room        string     `json:"room" db:"room"`                 // room
	Location    NullString `json:"location" db:"location"`         // location
	Color       NullString `json:"color" db:"color"`               // color
	Kind        ChatType   `json:"kind" db:"kind"`                 // kind

	// xo fields
	_exists, _deleted bool
}