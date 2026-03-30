<?php

namespace App\Services;

use App\Models\User;
use App\Contracts\UserServiceInterface;

/**
 * User management service.
 */
class UserService extends BaseService implements UserServiceInterface
{
    private string $connectionString;
    public static int $maxRetries = 3;

    /**
     * Creates a new user in the system.
     */
    public function createUser(string $name, string $email): User
    {
        return new User();
    }

    public function listUsers(int $limit): array
    {
        return [];
    }

    protected function validateInput(string $input): bool
    {
        return true;
    }

    private function loadCache(): void
    {
    }
}

interface UserServiceInterface
{
    public function createUser(string $name, string $email): User;
}

trait Cacheable
{
    public function clearCache(): void
    {
    }
}

enum UserStatus: string
{
    case Active = 'active';
    case Inactive = 'inactive';
    case Suspended = 'suspended';
}

function helper_function(string $input): string
{
    return $input;
}
