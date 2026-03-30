#include <string>
#include <vector>

namespace app {

/**
 * User data model.
 */
class UserService : public BaseService {
    // Before any access_specifier — C++ class default is private
    void defaultPrivateMethod() {}

public:
    /**
     * Creates a new user.
     */
    User createUser(const std::string& name, const std::string& email) {
        return User();
    }

    std::vector<User> listUsers(int limit) {
        return {};
    }

    bool validateInput(const std::string& input) {
        return true;
    }

private:
    std::string connectionString_;
    void loadCache() {}
};

enum class Status {
    Active,
    Inactive,
    Suspended
};

struct Point {
    double coord_x;
    double coord_y;
    void translate(double dx, double dy) {}
private:
    int point_id_;
};

// Free function in namespace — should be kind:'function', NOT 'method'
void helperFunc(int x) {}

} // namespace app
