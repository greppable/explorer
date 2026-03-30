// Test fixture for JavaScript src2gdlc mapping
import { readFileSync } from 'fs';
import path from 'path';

const MAX_RETRIES = 3;
let _internalCounter = 0;

export const API_VERSION = '2.0';

export class UserService {
  #secretKey;
  baseUrl;

  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.#secretKey = 'abc';
  }

  async getUser(id) {
    return { id };
  }

  async listUsers(page, limit = 10) {
    return [];
  }

  #validateInput(data) {
    return !!data;
  }

  static fromConfig(config) {
    return new UserService(config.baseUrl);
  }
}

export class AdminService extends UserService {
  async deleteUser(id) {
    return true;
  }
}

export function createService(options) {
  return new UserService(options.baseUrl);
}

function _helperFn(a, b, ...rest) {
  return [a, b, ...rest];
}
