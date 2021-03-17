/**
 * IPasswordAuthenticator specifies an authenticator which uses an RBAC
 * username and password to authenticate with the cluster.
 *
 * @category Authentication
 */
export interface IPasswordAuthenticator {
  /**
   * The username to authenticate with.
   */
  username: string

  /**
   * The password to autehnticate with.
   */
  password: string
}

/**
 * IPasswordAuthenticator specifies an authenticator which uses an SSL
 * certificate and key to authenticate with the cluster.
 *
 * @category Authentication
 */
export interface ICertificateAuthenticator {
  /**
   * The path to the certificate which should be used for certificate authentication.
   */
  certificatePath: string

  /**
   * The path to the key which should be used for certificate authentication.
   */
  keyPath: string
}

/**
 * PasswordAuthenticator implements a simple IPasswordAuthenticator.
 *
 * @category Authentication
 */
export class PasswordAuthenticator implements IPasswordAuthenticator {
  /**
   * The username that will be used to authenticate with.
   */
  username: string

  /**
   * The password that will be used to authenticate with.
   */
  password: string

  /**
   * Constructs this PasswordAuthenticator with the passed username and password.
   *
   * @param username The username to initialize this authenticator with.
   * @param password The password to initialize this authenticator with.
   */
  constructor(username: string, password: string) {
    this.username = username
    this.password = password
  }
}

/**
 * CertificateAuthenticator implements a simple ICertificateAuthenticator.
 *
 * @category Authentication
 */
export class CertificateAuthenticator implements ICertificateAuthenticator {
  /**
   * The path to the certificate which should be used for certificate authentication.
   */
  certificatePath: string

  /**
   * The path to the key which should be used for certificate authentication.
   */
  keyPath: string

  /**
   * Constructs this CertificateAuthenticator with the passed certificate and key paths.
   *
   * @param certificatePath The certificate path to initialize this authenticator with.
   * @param keyPath The key path to initialize this authenticator with.
   */
  constructor(certificatePath: string, keyPath: string) {
    this.certificatePath = certificatePath
    this.keyPath = keyPath
  }
}

/**
 * Represents any of the valid authenticators that could be passed to the SDK.
 *
 * @category Authentication
 */
export type Authenticator = IPasswordAuthenticator | ICertificateAuthenticator
