// Package models contains the types for schema 'public'.
package models

// Code generated by xo. DO NOT EDIT.

// Vote represents a row from 'public.vote'.
type Vote struct {
	Person           string `json:"person" db:"person"`                       // person
	BlindedSignature string `json:"blinded_signature" db:"blinded_signature"` // blinded_signature

	// xo fields
	_exists, _deleted bool
}