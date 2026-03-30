using System;
using System.Collections.Generic;

namespace SampleApp
{
    /// <summary>
    /// User management service.
    /// </summary>
    public class UserService : BaseService, IUserService
    {
        private string _connectionString;
        public static readonly int MaxRetries = 3;

        /// <summary>
        /// Creates a new user in the system.
        /// </summary>
        public User CreateUser(string name, string email)
        {
            return new User();
        }

        public List<User> ListUsers(int limit)
        {
            return new List<User>();
        }

        protected bool ValidateInput(string input)
        {
            return true;
        }

        private void LoadCache()
        {
        }
    }

    public interface IUserService
    {
        User CreateUser(string name, string email);
    }

    public enum UserStatus
    {
        Active,
        Inactive,
        Suspended
    }
}
