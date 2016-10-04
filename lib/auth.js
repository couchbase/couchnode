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
