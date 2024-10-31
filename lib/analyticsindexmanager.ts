import { Cluster } from './cluster'
import {
  CppManagementAnalyticsDataset,
  CppManagementAnalyticsIndex,
  CppManagementAnalyticsCouchbaseRemoteLink,
  CppManagementAnalyticsS3ExternalLink,
  CppManagementAnalyticsAzureBlobExternalLink,
} from './binding'
import { InvalidArgumentError } from './errors'
import {
  errorFromCpp,
  encryptionSettingsFromCpp,
  encryptionSettingsToCpp,
} from './bindingutilities'
import { NodeCallback, PromiseHelper } from './utilities'

/**
 * Represents the type of an analytics link.
 *
 * @category Analytics
 */
export enum AnalyticsLinkType {
  /**
   * Indicates that the link is for S3.
   */
  S3External = 's3',

  /**
   * Indicates that the link is for Azure.
   */
  AzureBlobExternal = 'azureblob',

  /**
   * Indicates that the link is for a remote Couchbase cluster.
   */
  CouchbaseRemote = 'couchbase',
}

/**
 * Represents what level of encryption to use for analytics remote links.
 *
 * @category Analytics
 */
export enum AnalyticsEncryptionLevel {
  /**
   * Indicates that no encryption should be used.
   */
  None = 'none',

  /**
   * Indicates that half encryption should be used.
   */
  Half = 'half',

  /**
   * Indicates that full encryption should be used.
   */
  Full = 'full',
}

/**
 * Contains a specific dataset configuration for the analytics service.
 *
 * @category Management
 */
export class AnalyticsDataset {
  /**
   * The name of the dataset.
   */
  name: string

  /**
   * The name of the dataverse that this dataset exists within.
   */
  dataverseName: string

  /**
   * The name of the link that is associated with this dataset.
   */
  linkName: string

  /**
   * The name of the bucket that this dataset includes.
   */
  bucketName: string

  /**
   * @internal
   */
  constructor(data: AnalyticsDataset) {
    this.name = data.name
    this.dataverseName = data.dataverseName
    this.linkName = data.linkName
    this.bucketName = data.bucketName
  }
}

/**
 * Contains a specific index configuration for the analytics service.
 *
 * @category Management
 */
export class AnalyticsIndex {
  /**
   * The name of the index.
   */
  name: string

  /**
   * The name of the dataset this index belongs to.
   */
  datasetName: string

  /**
   * The name of the dataverse this index belongs to.
   */
  dataverseName: string

  /**
   * Whether or not this is a primary index or not.
   */
  isPrimary: boolean

  /**
   * @internal
   */
  constructor(data: AnalyticsIndex) {
    this.name = data.name
    this.datasetName = data.datasetName
    this.dataverseName = data.dataverseName
    this.isPrimary = data.isPrimary
  }
}

/**
 * Specifies encryption options for an analytics remote link.
 */
export interface ICouchbaseAnalyticsEncryptionSettings {
  /**
   * Specifies what level of encryption should be used.
   */
  encryptionLevel: AnalyticsEncryptionLevel

  /**
   * Provides a certificate to use for connecting when encryption level is set
   * to full.  Required when encryptionLevel is set to Full.
   */
  certificate?: Buffer

  /**
   * Provides a client certificate to use for connecting when encryption level
   * is set to full.  Cannot be set if a username/password are used.
   */
  clientCertificate?: Buffer

  /**
   * Provides a client key to use for connecting when encryption level is set
   * to full.  Cannot be set if a username/password are used.
   */
  clientKey?: Buffer
}

/**
 * Includes information about an analytics remote links encryption.
 */
export class CouchbaseAnalyticsEncryptionSettings
  implements ICouchbaseAnalyticsEncryptionSettings
{
  /**
   * Specifies what level of encryption should be used.
   */
  encryptionLevel: AnalyticsEncryptionLevel

  /**
   * Provides a certificate to use for connecting when encryption level is set
   * to full.  Required when encryptionLevel is set to Full.
   */
  certificate?: Buffer

  /**
   * Provides a client certificate to use for connecting when encryption level
   * is set to full.  Cannot be set if a username/password are used.
   */
  clientCertificate?: Buffer

  /**
   * Provides a client key to use for connecting when encryption level is set
   * to full.  Cannot be set if a username/password are used.
   */
  clientKey?: Buffer

  /**
   * @internal
   */
  constructor(data: CouchbaseAnalyticsEncryptionSettings) {
    this.encryptionLevel = data.encryptionLevel
    this.certificate = data.certificate
    this.clientCertificate = data.clientCertificate
    this.clientKey = data.clientKey
  }
}

/**
 * Provides a base class for specifying options for an analytics link.
 *
 * @category Management
 */
export interface IAnalyticsLink {
  /**
   * Specifies what type of analytics link this represents.
   */
  linkType: AnalyticsLinkType

  /**
   * The dataverse that this link belongs to.
   */
  dataverse: string

  /**
   * The name of this link.
   */
  name: string
}

/**
 * This is a base class for specific link configurations for the analytics service.
 */
export abstract class AnalyticsLink implements IAnalyticsLink {
  /**
   * @internal
   */
  constructor() {
    this.linkType = '' as AnalyticsLinkType
    this.dataverse = ''
    this.name = ''
  }

  /**
   * Specifies what type of analytics link this represents.
   */
  linkType: AnalyticsLinkType

  /**
   * The dataverse that this link belongs to.
   */
  dataverse: string

  /**
   * The name of this link.
   */
  name: string

  /**
   * Validates the link.
   */
  abstract validate(): void

  /**
   * @internal
   */
  static _toHttpData(data: IAnalyticsLink): any {
    if (data.linkType === AnalyticsLinkType.CouchbaseRemote) {
      return CouchbaseRemoteAnalyticsLink._toHttpData(
        new CouchbaseRemoteAnalyticsLink(data as ICouchbaseRemoteAnalyticsLink)
      )
    } else if (data.linkType === AnalyticsLinkType.S3External) {
      return S3ExternalAnalyticsLink._toHttpData(
        new S3ExternalAnalyticsLink(data as IS3ExternalAnalyticsLink)
      )
    } else if (data.linkType === AnalyticsLinkType.AzureBlobExternal) {
      return AzureExternalAnalyticsLink._toHttpData(
        new AzureExternalAnalyticsLink(data as IAzureExternalAnalyticsLink)
      )
    } else {
      throw new Error('invalid link type')
    }
  }

  /**
   * @internal
   */
  static _fromHttpData(data: any): AnalyticsLink {
    if (data.type === 'couchbase') {
      return CouchbaseRemoteAnalyticsLink._fromHttpData(data)
    } else if (data.type === 's3') {
      return S3ExternalAnalyticsLink._fromHttpData(data)
    } else if (data.type === 'azure') {
      return AzureExternalAnalyticsLink._fromHttpData(data)
    } else {
      throw new Error('invalid link type')
    }
  }
}

/**
 * Provides options for configuring an analytics remote couchbase cluster link.
 */
export interface ICouchbaseRemoteAnalyticsLink extends IAnalyticsLink {
  /**
   * Specifies what type of analytics link this represents.
   */
  linkType: AnalyticsLinkType.CouchbaseRemote

  /**
   * The dataverse that this link belongs to.
   */
  dataverse: string

  /**
   * The name of this link.
   */
  name: string

  /**
   * The hostname of the target Couchbase cluster.
   */
  hostname: string

  /**
   * The encryption settings to be used for the link.
   */
  encryption?: ICouchbaseAnalyticsEncryptionSettings

  /**
   * The username to use for authentication with the remote cluster.  Optional
   * if client-certificate authentication
   * (@see ICouchbaseAnalyticsEncryptionSettings.clientCertificate) is being used.
   */
  username?: string

  /**
   * The password to use for authentication with the remote cluster.  Optional
   * if client-certificate authentication
   * (@see ICouchbaseAnalyticsEncryptionSettings.clientCertificate) is being used.
   */
  password?: string
}

/**
 * Provides information about a analytics remote Couchbase link.
 */
export class CouchbaseRemoteAnalyticsLink
  extends AnalyticsLink
  implements ICouchbaseRemoteAnalyticsLink
{
  /**
   * Specifies what type of analytics link this represents.
   */
  linkType: AnalyticsLinkType.CouchbaseRemote

  /**
   * The dataverse that this link belongs to.
   */
  dataverse: string

  /**
   * The name of this link.
   */
  name: string

  /**
   * The hostname of the target Couchbase cluster.
   */
  hostname: string

  /**
   * The encryption settings to be used for the link.
   */
  encryption?: CouchbaseAnalyticsEncryptionSettings

  /**
   * The username to use for authentication with the remote cluster.  Optional
   * if client-certificate authentication
   * (@see ICouchbaseAnalyticsEncryptionSettings.clientCertificate) is being used.
   */
  username?: string

  /**
   * The password to use for authentication with the remote cluster.  Optional
   * if client-certificate authentication
   * (@see ICouchbaseAnalyticsEncryptionSettings.clientCertificate) is being used.
   */
  password?: string

  /**
   * Validates the CouchbaseRemoteAnalyticsLink.
   */
  validate(): void {
    if (!this.dataverse) {
      throw new InvalidArgumentError(
        new Error(
          'Must provide a dataverse for the CouchbaseRemoteAnalyticsLink.'
        )
      )
    }
    if (!this.name) {
      throw new InvalidArgumentError(
        new Error('Must provide a name for the CouchbaseRemoteAnalyticsLink.')
      )
    }
    if (!this.hostname) {
      throw new InvalidArgumentError(
        new Error(
          'Must provide a hostname for the CouchbaseRemoteAnalyticsLink.'
        )
      )
    }
    if (this.encryption) {
      if (
        [AnalyticsEncryptionLevel.None, AnalyticsEncryptionLevel.Half].includes(
          this.encryption.encryptionLevel
        )
      ) {
        if (!this.username || !this.password) {
          throw new InvalidArgumentError(
            new Error(
              'When encryption level is half or none, username and password must be set for the CouchbaseRemoteAnalyticsLink.'
            )
          )
        }
      } else {
        if (
          !this.encryption.certificate ||
          this.encryption.certificate.length == 0
        ) {
          throw new InvalidArgumentError(
            new Error(
              'When encryption level full, a certificate must be set for the CouchbaseRemoteAnalyticsLink.'
            )
          )
        }
        const clientCertificateInvalid =
          !this.encryption.clientCertificate ||
          this.encryption.clientCertificate.length == 0
        const clientKeyInvalid =
          !this.encryption.clientKey || this.encryption.clientKey.length == 0
        if (clientCertificateInvalid || clientKeyInvalid) {
          throw new InvalidArgumentError(
            new Error(
              'When encryption level full, a client key and certificate must be set for the CouchbaseRemoteAnalyticsLink.'
            )
          )
        }
      }
    }
  }

  /**
   * @internal
   */
  constructor(data: ICouchbaseRemoteAnalyticsLink) {
    super()
    this.linkType = AnalyticsLinkType.CouchbaseRemote

    this.dataverse = data.dataverse
    this.name = data.name
    this.hostname = data.hostname
    this.encryption = data.encryption
    this.username = data.username
    this.password = data.password
  }

  /**
   * @internal
   */
  static _toCppData(
    data: CouchbaseRemoteAnalyticsLink
  ): CppManagementAnalyticsCouchbaseRemoteLink {
    data.validate()
    return {
      link_name: data.name,
      dataverse: data.dataverse,
      hostname: data.hostname,
      username: data.hostname,
      password: data.password,
      encryption: encryptionSettingsToCpp(data.encryption),
    }
  }

  /**
   * @internal
   */
  static _fromCppData(
    data: CppManagementAnalyticsCouchbaseRemoteLink
  ): CouchbaseRemoteAnalyticsLink {
    return new CouchbaseRemoteAnalyticsLink({
      linkType: AnalyticsLinkType.CouchbaseRemote,
      dataverse: data.dataverse,
      name: data.link_name,
      hostname: data.hostname,
      encryption: encryptionSettingsFromCpp(data.encryption),
      username: data.username,
      password: undefined,
    })
  }
}

/**
 * Provides options for configuring an analytics remote S3 link.
 */
export interface IS3ExternalAnalyticsLink extends IAnalyticsLink {
  /**
   * Specifies what type of analytics link this represents.
   */
  linkType: AnalyticsLinkType.S3External

  /**
   * The dataverse that this link belongs to.
   */
  dataverse: string

  /**
   * The name of this link.
   */
  name: string

  /**
   * The AWS S3 access key.
   */
  accessKeyId: string

  /**
   * The AWS S3 secret key.
   */
  secretAccessKey?: string

  /**
   * The AWS S3 token if temporary credentials are provided.  Only available
   * in Couchbase Server 7.0 and above.
   */
  sessionToken?: string

  /**
   * The AWS S3 region.
   */
  region: string

  /**
   * The AWS S3 service endpoint.
   */
  serviceEndpoint?: string
}

/**
 * Provides information about a analytics remote S3 link.
 */
export class S3ExternalAnalyticsLink
  extends AnalyticsLink
  implements IS3ExternalAnalyticsLink
{
  /**
   * Specifies what type of analytics link this represents.
   */
  linkType: AnalyticsLinkType.S3External

  /**
   * The dataverse that this link belongs to.
   */
  dataverse: string

  /**
   * The name of this link.
   */
  name: string

  /**
   * The AWS S3 access key.
   */
  accessKeyId: string

  /**
   * The AWS S3 secret key.
   */
  secretAccessKey?: string

  /**
   * The AWS S3 token if temporary credentials are provided.  Only available
   * in Couchbase Server 7.0 and above.
   */
  sessionToken?: string

  /**
   * The AWS S3 region.
   */
  region: string

  /**
   * The AWS S3 service endpoint.
   */
  serviceEndpoint?: string

  /**
   * @internal
   */
  constructor(data: IS3ExternalAnalyticsLink) {
    super()
    this.linkType = AnalyticsLinkType.S3External

    this.dataverse = data.dataverse
    this.name = data.name
    this.accessKeyId = data.accessKeyId
    this.secretAccessKey = data.secretAccessKey
    this.sessionToken = data.sessionToken
    this.region = data.region
    this.serviceEndpoint = data.serviceEndpoint
  }

  /**
   * Validates the S3ExternalAnalyticsLink.
   */
  validate(): void {
    if (!this.dataverse) {
      throw new InvalidArgumentError(
        new Error('Must provide a dataverse for the S3ExternalAnalyticsLink.')
      )
    }
    if (!this.name) {
      throw new InvalidArgumentError(
        new Error('Must provide a name for the S3ExternalAnalyticsLink.')
      )
    }
    if (!this.accessKeyId) {
      throw new InvalidArgumentError(
        new Error(
          'Must provide an accessKeyId for the S3ExternalAnalyticsLink.'
        )
      )
    }
    if (!this.secretAccessKey) {
      throw new InvalidArgumentError(
        new Error(
          'Must provide an secretAccessKey for the S3ExternalAnalyticsLink.'
        )
      )
    }
    if (!this.region) {
      throw new InvalidArgumentError(
        new Error('Must provide an region for the S3ExternalAnalyticsLink.')
      )
    }
  }

  /**
   * @internal
   */
  static _toCppData(
    data: S3ExternalAnalyticsLink
  ): CppManagementAnalyticsS3ExternalLink {
    data.validate()
    return {
      link_name: data.name,
      dataverse: data.dataverse,
      access_key_id: data.accessKeyId,
      secret_access_key: data.secretAccessKey as string,
      session_token: data.sessionToken,
      region: data.region,
      service_endpoint: data.serviceEndpoint,
    }
  }

  /**
   * @internal
   */
  static _fromCppData(
    data: CppManagementAnalyticsS3ExternalLink
  ): S3ExternalAnalyticsLink {
    return new S3ExternalAnalyticsLink({
      name: data.link_name,
      linkType: AnalyticsLinkType.S3External,
      dataverse: data.dataverse,
      accessKeyId: data.access_key_id,
      secretAccessKey: undefined,
      sessionToken: undefined,
      region: data.region,
      serviceEndpoint: data.service_endpoint,
    })
  }
}

/**
 * Provides options for configuring an analytics remote Azure link.
 */
export interface IAzureExternalAnalyticsLink extends IAnalyticsLink {
  /**
   * Specifies what type of analytics link this represents.
   */
  linkType: AnalyticsLinkType.AzureBlobExternal

  /**
   * The dataverse that this link belongs to.
   */
  dataverse: string

  /**
   * The name of this link.
   */
  name: string

  /**
   * The connection string to use to connect to the external Azure store.
   */
  connectionString?: string

  /**
   * The Azure blob storage account name.
   */
  accountName?: string

  /**
   * The Azure blob storage account key.
   */
  accountKey?: string

  /**
   * The shared access signature to use for authentication.
   */
  sharedAccessSignature?: string

  /**
   * The Azure blob storage endpoint.
   */
  blobEndpoint?: string

  /**
   * The Azure blob endpoint suffix.
   */
  endpointSuffix?: string
}

/**
 * Provides information about a analytics remote S3 link.
 */
export class AzureExternalAnalyticsLink
  extends AnalyticsLink
  implements IAzureExternalAnalyticsLink
{
  /**
   * Specifies what type of analytics link this represents.
   */
  linkType: AnalyticsLinkType.AzureBlobExternal

  /**
   * The dataverse that this link belongs to.
   */
  dataverse: string

  /**
   * The name of this link.
   */
  name: string

  /**
   * The connection string to use to connect to the external Azure store.
   */
  connectionString?: string

  /**
   * The Azure blob storage account name.
   */
  accountName?: string

  /**
   * The Azure blob storage account key.
   */
  accountKey?: string

  /**
   * The shared access signature to use for authentication.
   */
  sharedAccessSignature?: string

  /**
   * The Azure blob storage endpoint.
   */
  blobEndpoint?: string

  /**
   * The Azure blob endpoint suffix.
   */
  endpointSuffix?: string

  /**
   * @internal
   */
  constructor(data: IAzureExternalAnalyticsLink) {
    super()
    this.linkType = AnalyticsLinkType.AzureBlobExternal

    this.dataverse = data.dataverse
    this.name = data.name
    this.connectionString = data.connectionString
    this.accountName = data.accountName
    this.accountKey = data.accountKey
    this.sharedAccessSignature = data.sharedAccessSignature
    this.blobEndpoint = data.blobEndpoint
    this.endpointSuffix = data.endpointSuffix
  }

  /**
   * Validates the AzureExternalAnalyticsLink.
   */
  validate(): void {
    if (!this.dataverse) {
      throw new InvalidArgumentError(
        new Error(
          'Must provide a dataverse for the AzureExternalAnalyticsLink.'
        )
      )
    }
    if (!this.name) {
      throw new InvalidArgumentError(
        new Error('Must provide a name for the AzureExternalAnalyticsLink.')
      )
    }
    if (!this.connectionString) {
      const missingAcctNameAndKey = !(this.accountName && this.accountKey)
      const missingAcctNameAndSharedAccessSignature = !(
        this.accountName && this.sharedAccessSignature
      )
      if (missingAcctNameAndKey && missingAcctNameAndSharedAccessSignature) {
        throw new InvalidArgumentError(
          new Error(
            'If not providing connectionString, accountName and either accountKey' +
              ' or sharedAccessSignature must be provided for the AzureExternalAnalyticsLink.'
          )
        )
      }
    }
  }

  /**
   * @internal
   */
  static _toCppData(
    data: AzureExternalAnalyticsLink
  ): CppManagementAnalyticsAzureBlobExternalLink {
    data.validate()
    return {
      link_name: data.name,
      dataverse: data.dataverse,
      connection_string: data.connectionString,
      account_name: data.accountName,
      account_key: data.accountKey,
      shared_access_signature: data.sharedAccessSignature,
      blob_endpoint: data.blobEndpoint,
      endpoint_suffix: data.endpointSuffix,
    }
  }

  /**
   * @internal
   */
  static _fromCppData(
    data: CppManagementAnalyticsAzureBlobExternalLink
  ): AzureExternalAnalyticsLink {
    return new AzureExternalAnalyticsLink({
      name: data.link_name,
      linkType: AnalyticsLinkType.AzureBlobExternal,
      dataverse: data.dataverse,
      connectionString: undefined,
      accountName: data.account_name,
      accountKey: undefined,
      sharedAccessSignature: undefined,
      blobEndpoint: data.blob_endpoint,
      endpointSuffix: data.endpoint_suffix,
    })
  }
}

/**
 * @category Management
 */
export interface CreateAnalyticsDataverseOptions {
  /**
   * Whether or not the call should ignore the dataverse already existing when
   * determining whether the call was successful.
   */
  ignoreIfExists?: boolean

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface DropAnalyticsDataverseOptions {
  /**
   * Whether or not the call should ignore the dataverse not existing when
   * determining whether the call was successful.
   */
  ignoreIfNotExists?: boolean

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface CreateAnalyticsDatasetOptions {
  /**
   * Whether or not the call should ignore the dataset already existing when
   * determining whether the call was successful.
   */
  ignoreIfExists?: boolean

  /**
   * The name of the dataverse the dataset should belong to.
   */
  dataverseName?: string

  /**
   * A conditional expression to limit the indexes scope.
   */
  condition?: string

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface DropAnalyticsDatasetOptions {
  /**
   * Whether or not the call should ignore the dataset already existing when
   * determining whether the call was successful.
   */
  ignoreIfNotExists?: boolean

  /**
   * The name of the dataverse the dataset belongs to.
   */
  dataverseName?: string

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface GetAllAnalyticsDatasetsOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface CreateAnalyticsIndexOptions {
  /**
   * Whether or not the call should ignore the dataverse not existing when
   * determining whether the call was successful.
   */
  ignoreIfExists?: boolean

  /**
   * The name of the dataverse the index should belong to.
   */
  dataverseName?: string

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface DropAnalyticsIndexOptions {
  /**
   * Whether or not the call should ignore the index already existing when
   * determining whether the call was successful.
   */
  ignoreIfNotExists?: boolean

  /**
   * The name of the dataverse the index belongs to.
   */
  dataverseName?: string

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface GetAllAnalyticsIndexesOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface ConnectAnalyticsLinkOptions {
  /**
   * Whether or not the call should attempt to force the link connection.
   */
  force?: boolean

  /**
   * The name of the dataverse the link belongs to.
   */
  dataverseName?: string

  /**
   * The name of the link to connect.
   */
  linkName?: string

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface DisconnectAnalyticsLinkOptions {
  /**
   * The name of the dataverse the link belongs to.
   */
  dataverseName?: string

  /**
   * The name of the link to connect.
   */
  linkName?: string

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface GetPendingAnalyticsMutationsOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface CreateAnalyticsLinkOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface ReplaceAnalyticsLinkOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface DropAnalyticsLinkOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface GetAllAnalyticsLinksOptions {
  /**
   * The name of a dataverse to filter the links list to.
   */
  dataverse?: string

  /**
   * The name of a specific link to fetch.
   */
  name?: string

  /**
   * The type of link to filter the links list to.
   */
  linkType?: AnalyticsLinkType

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * AnalyticsIndexManager provides an interface for performing management
 * operations against the analytics service of the cluster.
 *
 * @category Management
 */
export class AnalyticsIndexManager {
  private _cluster: Cluster

  /**
   * @internal
   */
  constructor(cluster: Cluster) {
    this._cluster = cluster
  }

  /**
   * Creates a new dataverse.
   *
   * @param dataverseName The name of the dataverse to create.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async createDataverse(
    dataverseName: string,
    options?: CreateAnalyticsDataverseOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const timeout = options.timeout || this._cluster.managementTimeout
    const ignoreIfExists = options.ignoreIfExists || false

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementAnalyticsDataverseCreate(
        {
          dataverse_name: dataverseName,
          timeout: timeout,
          ignore_if_exists: ignoreIfExists,
        },
        (cppErr) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }
          wrapCallback(err)
        }
      )
    }, callback)
  }

  /**
   * Drops a previously created dataverse.
   *
   * @param dataverseName The name of the dataverse to drop.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async dropDataverse(
    dataverseName: string,
    options?: DropAnalyticsDataverseOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const timeout = options.timeout || this._cluster.managementTimeout
    const ignoreIfNotExists = options.ignoreIfNotExists || false

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementAnalyticsDataverseDrop(
        {
          dataverse_name: dataverseName,
          timeout: timeout,
          ignore_if_does_not_exist: ignoreIfNotExists,
        },
        (cppErr) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }
          wrapCallback(err)
        }
      )
    }, callback)
  }

  /**
   * Creates a new dataset.
   *
   * @param bucketName The name of the bucket to create this dataset of.
   * @param datasetName The name of the new dataset.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async createDataset(
    bucketName: string,
    datasetName: string,
    options?: CreateAnalyticsDatasetOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[2]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const dataverseName = options.dataverseName || 'Default'
    const ignoreIfExists = options.ignoreIfExists || false
    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementAnalyticsDatasetCreate(
        {
          dataverse_name: dataverseName,
          dataset_name: datasetName,
          bucket_name: bucketName,
          condition: options?.condition,
          timeout: timeout,
          ignore_if_exists: ignoreIfExists,
        },
        (cppErr) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }
          wrapCallback(err)
        }
      )
    }, callback)
  }

  /**
   * Drops a previously created dataset.
   *
   * @param datasetName The name of the dataset to drop.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async dropDataset(
    datasetName: string,
    options?: DropAnalyticsDatasetOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const dataverseName = options.dataverseName || 'Default'
    const ignoreIfNotExists = options.ignoreIfNotExists || false
    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementAnalyticsDatasetDrop(
        {
          dataverse_name: dataverseName,
          dataset_name: datasetName,
          timeout: timeout,
          ignore_if_does_not_exist: ignoreIfNotExists,
        },
        (cppErr) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }
          wrapCallback(err)
        }
      )
    }, callback)
  }

  /**
   * Returns a list of all existing datasets.
   *
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async getAllDatasets(
    options?: GetAllAnalyticsDatasetsOptions,
    callback?: NodeCallback<AnalyticsDataset[]>
  ): Promise<AnalyticsDataset[]> {
    if (options instanceof Function) {
      callback = arguments[0]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementAnalyticsDatasetGetAll(
        {
          timeout: timeout,
        },
        (cppErr, resp) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }
          const dataSets = resp.datasets.map(
            (dataset: CppManagementAnalyticsDataset) =>
              new AnalyticsDataset({
                name: dataset.name,
                dataverseName: dataset.dataverse_name,
                linkName: dataset.link_name,
                bucketName: dataset.bucket_name,
              })
          )
          wrapCallback(null, dataSets)
        }
      )
    }, callback)
  }

  /**
   * Creates a new index.
   *
   * @param datasetName The name of the dataset to create this index on.
   * @param indexName The name of index to create.
   * @param fields A map of fields that the index should contain.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async createIndex(
    datasetName: string,
    indexName: string,
    fields: { [key: string]: string },
    options?: CreateAnalyticsIndexOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[3]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const dataverseName = options.dataverseName || 'Default'
    const ignoreIfExists = options.ignoreIfExists || false
    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementAnalyticsIndexCreate(
        {
          dataverse_name: dataverseName,
          dataset_name: datasetName,
          index_name: indexName,
          fields: fields,
          timeout: timeout,
          ignore_if_exists: ignoreIfExists,
        },
        (cppErr) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }
          wrapCallback(err)
        }
      )
    }, callback)
  }

  /**
   * Drops a previously created index.
   *
   * @param datasetName The name of the dataset containing the index to drop.
   * @param indexName The name of the index to drop.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async dropIndex(
    datasetName: string,
    indexName: string,
    options?: DropAnalyticsIndexOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[2]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const dataverseName = options.dataverseName || 'Default'
    const ignoreIfNotExists = options.ignoreIfNotExists || false
    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementAnalyticsIndexDrop(
        {
          dataverse_name: dataverseName,
          dataset_name: datasetName,
          index_name: indexName,
          timeout: timeout,
          ignore_if_does_not_exist: ignoreIfNotExists,
        },
        (cppErr) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }
          wrapCallback(err)
        }
      )
    }, callback)
  }

  /**
   * Returns a list of all existing indexes.
   *
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async getAllIndexes(
    options?: GetAllAnalyticsIndexesOptions,
    callback?: NodeCallback<AnalyticsIndex[]>
  ): Promise<AnalyticsIndex[]> {
    if (options instanceof Function) {
      callback = arguments[0]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementAnalyticsIndexGetAll(
        {
          timeout: timeout,
        },
        (cppErr, resp) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }
          const indexes = resp.indexes.map(
            (index: CppManagementAnalyticsIndex) =>
              new AnalyticsIndex({
                name: index.name,
                dataverseName: index.dataverse_name,
                datasetName: index.dataset_name,
                isPrimary: index.is_primary,
              })
          )
          wrapCallback(null, indexes)
        }
      )
    }, callback)
  }

  // TODO(JSCBC-1293):  Remove deprecated path
  /**
   * Connects a not yet connected link.
   *
   * @param linkStr The name of the link to connect.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   * @deprecated Use the other overload instead.
   */
  async connectLink(
    linkStr: string,
    options?: ConnectAnalyticsLinkOptions,
    callback?: NodeCallback<void>
  ): Promise<void>
  /**
   * Connects a not yet connected link.
   *
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async connectLink(
    options?: ConnectAnalyticsLinkOptions,
    callback?: NodeCallback<void>
  ): Promise<void>
  /**
   * @internal
   */
  async connectLink(): Promise<void> {
    if (typeof arguments[0] === 'string') {
      return this._connectLinkDeprecated(
        arguments[0],
        arguments[1],
        arguments[2]
      )
    } else {
      return this._connectLink(arguments[0], arguments[1])
    }
  }

  // TODO(JSCBC-1293):  Remove deprecated path
  /**
   * @internal
   */
  async _connectLinkDeprecated(
    linkStr: string,
    options?: ConnectAnalyticsLinkOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const force = options.force || false
    const timeout = options.timeout || this._cluster.managementTimeout

    let qs = 'CONNECT LINK ' + linkStr
    if (force) {
      qs += ' WITH {"force": true}'
    }

    return PromiseHelper.wrapAsync(async () => {
      await this._cluster.analyticsQuery(qs, {
        timeout: timeout,
      })
    }, callback)
  }

  /**
   * @internal
   */
  async _connectLink(
    options?: ConnectAnalyticsLinkOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const dataverseName = options.dataverseName || 'Default'
    const linkName = options.linkName || 'Local'
    const force = options.force || false
    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementAnalyticsLinkConnect(
        {
          dataverse_name: dataverseName,
          link_name: linkName,
          timeout: timeout,
          force: force,
        },
        (cppErr) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }
          wrapCallback(err)
        }
      )
    }, callback)
  }

  // TODO(JSCBC-1293):  Remove deprecated path
  /**
   * Disconnects a previously connected link.
   *
   * @param linkStr The name of the link to disconnect.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   * @deprecated Use the other overload instead.
   */
  async disconnectLink(
    linkStr: string,
    options?: DisconnectAnalyticsLinkOptions,
    callback?: NodeCallback<void>
  ): Promise<void>
  /**
   * Disconnects a previously connected link.
   *
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async disconnectLink(
    options?: DisconnectAnalyticsLinkOptions,
    callback?: NodeCallback<void>
  ): Promise<void>
  /**
   * @internal
   */
  async disconnectLink(): Promise<void> {
    if (typeof arguments[0] === 'string') {
      return this._disconnectLinkDeprecated(
        arguments[0],
        arguments[1],
        arguments[2]
      )
    } else {
      return this._disconnectLink(arguments[0], arguments[1])
    }
  }

  // TODO(JSCBC-1293):  Remove deprecated path
  /**
   * @internal
   */
  async _disconnectLinkDeprecated(
    linkStr: string,
    options?: DisconnectAnalyticsLinkOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }
    const qs = 'DISCONNECT LINK ' + linkStr
    const timeout = options.timeout || this._cluster.managementTimeout
    return PromiseHelper.wrapAsync(async () => {
      await this._cluster.analyticsQuery(qs, {
        timeout: timeout,
      })
    }, callback)
  }

  /**
   * @internal
   */
  async _disconnectLink(
    options?: DisconnectAnalyticsLinkOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }
    const dataverseName = options.dataverseName || 'Default'
    const linkName = options.linkName || 'Local'
    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementAnalyticsLinkDisconnect(
        {
          dataverse_name: dataverseName,
          link_name: linkName,
          timeout: timeout,
        },
        (cppErr) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }
          wrapCallback(err)
        }
      )
    }, callback)
  }

  /**
   * Returns a list of all pending mutations.
   *
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async getPendingMutations(
    options?: GetPendingAnalyticsMutationsOptions,
    callback?: NodeCallback<{ [k: string]: { [k: string]: number } }>
  ): Promise<{ [k: string]: { [k: string]: number } }> {
    if (options instanceof Function) {
      callback = arguments[0]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementAnalyticsGetPendingMutations(
        {
          timeout: timeout,
        },
        (cppErr, resp) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }
          const stats = {
            stats: resp.stats,
          }
          wrapCallback(null, stats)
        }
      )
    }, callback)
  }

  /**
   * Creates a new analytics remote link.
   *
   * @param link The settings for the link to create.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async createLink(
    link: IAnalyticsLink,
    options?: CreateAnalyticsLinkOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const timeout = options.timeout || this._cluster.managementTimeout

    if (link.linkType == AnalyticsLinkType.CouchbaseRemote) {
      return PromiseHelper.wrap((wrapCallback) => {
        this._cluster.conn.managementAnalyticsLinkCreateCouchbaseRemoteLink(
          {
            link: CouchbaseRemoteAnalyticsLink._toCppData(
              new CouchbaseRemoteAnalyticsLink(
                link as ICouchbaseRemoteAnalyticsLink
              )
            ),
            timeout: timeout,
          },
          (cppErr) => {
            const err = errorFromCpp(cppErr)
            if (err) {
              return wrapCallback(err, null)
            }
            wrapCallback(err)
          }
        )
      }, callback)
    } else if (link.linkType == AnalyticsLinkType.S3External) {
      return PromiseHelper.wrap((wrapCallback) => {
        this._cluster.conn.managementAnalyticsLinkCreateS3ExternalLink(
          {
            link: S3ExternalAnalyticsLink._toCppData(
              new S3ExternalAnalyticsLink(link as IS3ExternalAnalyticsLink)
            ),
            timeout: timeout,
          },
          (cppErr) => {
            const err = errorFromCpp(cppErr)
            if (err) {
              return wrapCallback(err, null)
            }
            wrapCallback(err)
          }
        )
      }, callback)
    } else if (link.linkType == AnalyticsLinkType.AzureBlobExternal) {
      return PromiseHelper.wrap((wrapCallback) => {
        this._cluster.conn.managementAnalyticsLinkCreateAzureBlobExternalLink(
          {
            link: AzureExternalAnalyticsLink._toCppData(
              new AzureExternalAnalyticsLink(
                link as IAzureExternalAnalyticsLink
              )
            ),
            timeout: timeout,
          },
          (cppErr) => {
            const err = errorFromCpp(cppErr)
            if (err) {
              return wrapCallback(err, null)
            }
            wrapCallback(err)
          }
        )
      }, callback)
    } else {
      throw new Error('invalid link type')
    }
  }

  /**
   * Replaces an existing analytics remote link.
   *
   * @param link The settings for the updated link.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async replaceLink(
    link: IAnalyticsLink,
    options?: ReplaceAnalyticsLinkOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const timeout = options.timeout || this._cluster.managementTimeout

    if (link.linkType == AnalyticsLinkType.CouchbaseRemote) {
      return PromiseHelper.wrap((wrapCallback) => {
        this._cluster.conn.managementAnalyticsLinkReplaceCouchbaseRemoteLink(
          {
            link: CouchbaseRemoteAnalyticsLink._toCppData(
              new CouchbaseRemoteAnalyticsLink(
                link as ICouchbaseRemoteAnalyticsLink
              )
            ),
            timeout: timeout,
          },
          (cppErr) => {
            const err = errorFromCpp(cppErr)
            if (err) {
              return wrapCallback(err, null)
            }
            wrapCallback(err)
          }
        )
      }, callback)
    } else if (link.linkType == AnalyticsLinkType.S3External) {
      return PromiseHelper.wrap((wrapCallback) => {
        this._cluster.conn.managementAnalyticsLinkReplaceS3ExternalLink(
          {
            link: S3ExternalAnalyticsLink._toCppData(
              new S3ExternalAnalyticsLink(link as IS3ExternalAnalyticsLink)
            ),
            timeout: timeout,
          },
          (cppErr) => {
            const err = errorFromCpp(cppErr)
            if (err) {
              return wrapCallback(err, null)
            }
            wrapCallback(err)
          }
        )
      }, callback)
    } else if (link.linkType == AnalyticsLinkType.AzureBlobExternal) {
      return PromiseHelper.wrap((wrapCallback) => {
        this._cluster.conn.managementAnalyticsLinkReplaceAzureBlobExternalLink(
          {
            link: AzureExternalAnalyticsLink._toCppData(
              new AzureExternalAnalyticsLink(
                link as IAzureExternalAnalyticsLink
              )
            ),
            timeout: timeout,
          },
          (cppErr) => {
            const err = errorFromCpp(cppErr)
            if (err) {
              return wrapCallback(err, null)
            }
            wrapCallback(err)
          }
        )
      }, callback)
    } else {
      throw new Error('invalid link type')
    }
  }

  /**
   * Drops an existing analytics remote link.
   *
   * @param linkName The name of the link to drop.
   * @param dataverseName The dataverse containing the link to drop.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async dropLink(
    linkName: string,
    dataverseName: string,
    options?: DropAnalyticsLinkOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[2]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementAnalyticsLinkDrop(
        {
          dataverse_name: dataverseName,
          link_name: linkName,
          timeout: timeout,
        },
        (cppErr) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }
          wrapCallback(err)
        }
      )
    }, callback)
  }

  /**
   * Returns a list of existing analytics remote links.
   *
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async getAllLinks(
    options?: GetAllAnalyticsLinksOptions,
    callback?: NodeCallback<AnalyticsLink[]>
  ): Promise<AnalyticsLink[]> {
    if (options instanceof Function) {
      callback = arguments[0]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const dataverseName = options.dataverse
    const linkName = options.name
    const linkType = options.linkType
    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementAnalyticsLinkGetAll(
        {
          link_type: linkType,
          link_name: linkName,
          dataverse_name: dataverseName,
          timeout: timeout,
        },
        (cppErr, resp) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }
          const links: AnalyticsLink[] = []
          resp.couchbase.forEach(
            (link: CppManagementAnalyticsCouchbaseRemoteLink) => {
              links.push(CouchbaseRemoteAnalyticsLink._fromCppData(link))
            }
          )
          resp.s3.forEach((link: CppManagementAnalyticsS3ExternalLink) => {
            links.push(S3ExternalAnalyticsLink._fromCppData(link))
          })
          resp.azure_blob.forEach(
            (link: CppManagementAnalyticsAzureBlobExternalLink) => {
              links.push(AzureExternalAnalyticsLink._fromCppData(link))
            }
          )
          wrapCallback(null, links)
        }
      )
    }, callback)
  }
}
