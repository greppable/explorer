/**
 * Service for managing user accounts.
 */
public class UserService {
    /**
     * Create a new user with the given name and email.
     * @param name the user's display name
     * @param email the user's email address
     * @return the created User object
     */
    public User createUser(String name, String email) {
        return null;
    }

    /**
     * Delete a user by their ID. Returns true if successful.
     */
    public boolean deleteUser(int userId) {
        return false;
    }

    // Not a Javadoc comment
    public void logout() {}

    /** Maximum retry attempts */
    private int maxRetries = 3;
}
