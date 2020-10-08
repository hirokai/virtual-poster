package models

import (
	"database/sql"
	"encoding/json"
)

type NullInt64 struct {
	sql.NullInt64
}

func (s NullInt64) MarshalJSON() ([]byte, error) {
	return json.Marshal(s.Int64)
	// if s.Valid {
	// } else {
	// 	return []byte(0), nil
	// }
}

func (s *NullInt64) UnmarshalJSON(data []byte) error {
	var str int64
	if err := json.Unmarshal(data, &str); err != nil {
		return err
	}
	s.Int64 = str
	s.Valid = true
	return nil
}

type NullString struct {
	sql.NullString
}

func (s NullString) MarshalJSON() ([]byte, error) {
	if s.Valid {
		return json.Marshal(s.String)
	} else {
		return json.Marshal(nil)
	}
}

func (s *NullString) UnmarshalJSON(data []byte) error {
	var str string
	if err := json.Unmarshal(data, &str); err != nil {
		return err
	}
	s.String = str
	s.Valid = true
	return nil
}
