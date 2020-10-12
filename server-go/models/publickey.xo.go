// Package models contains the types for schema 'public'.
package models

// Code generated by xo. DO NOT EDIT.

// PublicKey represents a row from 'public.public_key'.
type PublicKey struct {
	Person    string `json:"person" db:"person"`         // person
	PublicKey string `json:"public_key" db:"public_key"` // public_key

	// xo fields
	_exists, _deleted bool
}