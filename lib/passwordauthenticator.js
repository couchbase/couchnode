'use strict';

/**
 * PasswordAuthenticator provides an authenticator implementation
 * which uses a Role Based Access Control Username and Password.
 */
class PasswordAuthenticator {
  /**
   *
   * @param {string} username
   * @param {string} password
   */
  constructor(username, password) {
    this.username = username;
    this.password = password;
  }
}

module.exports = PasswordAuthenticator;
