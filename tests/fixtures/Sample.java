package com.example;

import java.util.List;
import java.util.Optional;

public class Sample extends BaseService implements Serializable {

    private String dbPath;
    public static final int MAX_SIZE = 100;

    public Optional<Object> getUser(int userId) {
        return Optional.empty();
    }

    public List<Object> listUsers(int limit) {
        return List.of();
    }

    protected boolean validate(String input) {
        return true;
    }

    private void loadCache() {
    }
}

enum Status {
    ACTIVE,
    INACTIVE,
    PENDING
}
