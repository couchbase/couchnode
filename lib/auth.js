'use strict';

/**
 * Authenticator for using classic authentication.
 *
 * @param {Object.<string, string>} buckets
 *  Map of bucket names to passwords.
 * @param {string} [username]
 *  Cluster administration username.
 * @param {string} [password]
 *  Cluster administration password.
 * @constructor
 *
 * @since 2.2.3
 * @uncommitted
 */
function ClassicAuthenticator(buckets, username, password) {
  this.buckets = buckets;
  this.username = username;
  this.password = password;
}

module.exports.ClassicAuthenticator = ClassicAuthenticator;

/**
 * Authenticator for performing role-based authentication.
 *
 * @param {string} [username]
 *  RBAC username.
 * @param {string} [password]
 *  RBAC password.
 * @constructor
 *
 * @since 2.3.3
 * @uncommitted
 */
function PasswordAuthenticator(username, password) {
  this.username = username;
  this.password = password;
}

module.exports.PasswordAuthenticator = PasswordAuthenticator;

/**
 * Authenticator for performing certificate-based authentication.
 *
 * @constructor
 *
 * @since 2.4.4
 * @uncommitted
 */
function CertAuthenticator() {
  this.username = '';
  this.password = '';
}

module.exports.CertAuthenticator = CertAuthenticator;
