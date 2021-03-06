// Package models contains the types for schema 'public'.
package models

// Code generated by xo. DO NOT EDIT.

// PersonStat represents a row from 'public.person_stats'.
type PersonStat struct {
	Person        string `json:"person" db:"person"`                   // person
	WalkingSteps  int64  `json:"walking_steps" db:"walking_steps"`     // walking_steps
	ChatCount     int64  `json:"chat_count" db:"chat_count"`           // chat_count
	ChatCharCount int64  `json:"chat_char_count" db:"chat_char_count"` // chat_char_count

	// xo fields
	_exists, _deleted bool
}
