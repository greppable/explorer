require 'json'
require_relative 'base_service'

# User management service.
class UserService < BaseService
  # Creates a new user.
  def create_user(name, email)
    User.new(name: name, email: email)
  end

  def list_users(limit)
    []
  end

  attr_accessor :name, :email

  protected

  def validate_input(input)
    true
  end

  attr_writer :status

  private

  def load_cache
  end

  attr_reader :connection_string

  private def secret_helper(x)
    x * 2
  end
end

module Helpers
  def self.format_name(name)
    name.strip
  end
end

MAX_RETRIES = 3
