class UserService:
    """Service for managing user accounts."""

    def create_user(self, name: str, email: str) -> User:
        """Create a new user account with the given name and email."""
        pass

    def delete_user(self, user_id: int) -> bool:
        """Delete a user by their ID. Returns True if successful."""
        pass

    def no_docs_method(self):
        pass

def calculate_age(birth_date: str) -> int:
    """Calculate age from a birth date string in ISO format."""
    pass

def helper_no_docs():
    pass

MAX_CONNECTIONS = 100
