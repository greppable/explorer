package main

// UserService handles user management operations.
type UserService struct {
	db *Database
}

// CreateUser creates a new user with the given name.
func (s *UserService) CreateUser(name string) (*User, error) {
	return nil, nil
}

// DeleteUser removes a user by ID. Returns an error if not found.
func (s *UserService) DeleteUser(id int) error {
	return nil
}

func (s *UserService) noDocsMethod() {}

// MaxRetries is the maximum number of retry attempts.
const MaxRetries = 3

// DefaultTimeout defines the default request timeout in seconds.
var DefaultTimeout = 30

func helperNoDoc() {}
