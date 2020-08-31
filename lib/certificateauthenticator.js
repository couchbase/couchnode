'use strict';

/**
 * CertificateAuthenticator provides an authenticator implementation
 * which uses TLS Certificate Authentication.
 */
class CertificateAuthenticator {
  /**
   *
   * @param {string} certificatePath
   * @param {string} keyPath
   */
  constructor(certificatePath, keyPath) {
    this.certificatePath = certificatePath;
    this.keyPath = keyPath;
  }
}

module.exports = CertificateAuthenticator;
