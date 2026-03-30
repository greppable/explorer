#include <stdio.h>
#include <stdlib.h>

/** Maximum number of connections allowed. */
#define MAX_CONNECTIONS 100

/**
 * User data structure.
 */
typedef struct {
    int id;
    char *name;
    char *email;
} User;

/**
 * Creates a new user with the given name.
 */
User *create_user(const char *name, const char *email) {
    User *user = malloc(sizeof(User));
    return user;
}

int delete_user(int user_id) {
    return 0;
}

static void internal_helper(void) {
}

/**
 * Opaque connection handle.
 */
typedef struct Connection Connection;
