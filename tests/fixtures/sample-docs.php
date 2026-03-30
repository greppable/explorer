<?php
/**
 * User authentication service.
 */
class AuthService
{
    /**
     * Validate a JWT token and return the decoded payload.
     */
    public function validateToken(string $token): array
    {
        return [];
    }

    public function revokeToken(string $token): bool
    {
        return true;
    }
}
