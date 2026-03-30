/// <summary>
/// Service for managing user accounts.
/// </summary>
public class SampleDocs {
    /// <summary>
    /// Create a new user with the given name and email.
    /// </summary>
    public User CreateUser(string name, string email) {
        return null;
    }

    /// <summary>
    /// Delete a user by their ID.
    /// </summary>
    public bool DeleteUser(int userId) {
        return false;
    }

    // Not a doc comment
    public void Logout() {}

    /// <summary>Maximum retry attempts</summary>
    private int maxRetries = 3;
}
