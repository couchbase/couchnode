import { describe, expect } from 'vitest'

import type {
  IAnalyticsLink,
  ICouchbaseAnalyticsEncryptionSettings,
} from '../../../lib/analyticsindexmanager'
import {
  AnalyticsEncryptionLevel,
  AnalyticsLinkType,
} from '../../../lib/analyticsindexmanager'
import type { Cluster } from '../../../lib/cluster'
import {
  DataverseNotFoundError,
  InvalidArgumentError,
  LinkExistsError,
  LinkNotFoundError,
} from '../../../lib/errors'
import { AssertCtx, withCtx } from '../../asserts/ctx'
import { expectThrows } from '../../asserts/errors'
import { assertRowCount } from '../../asserts/rows'
import { ServerFeature } from '../../infra/capabilities'
import { awaitCallback } from '../../infra/callbacks'
import { TestEnv } from '../../infra/env'
import { CollectionStrategy } from '../../infra/requirements'
import { defineSuite } from '../../infra/suite'

// Most tests never reach the server: `#invalidargument` is 22 definitions,
// each missing one required field, that the SDK must reject before sending. A
// table makes the missing field easier to audit than 22 hand-written tests.
//
// The suite is gated at collection time, so the dataverse drop needs no
// feature check of its own.
//
// Definitions come from factories, so no test leaves a field such as
// `dataverse` or `region` set for the next. `#link-create-replace-drop` does
// rely on order: create, duplicate, replace, count, drop.

/**
 * Not one of the SDK's concrete link interfaces: most definitions below omit a
 * required field on purpose, which those interfaces reject at compile time.
 */
interface LinkDefinition extends IAnalyticsLink {
  readonly accountName?: string
  readonly accountKey?: string
  readonly sharedAccessSignature?: string
  readonly accessKeyId?: string
  readonly secretAccessKey?: string
  readonly region?: string
  readonly hostname?: string
  readonly username?: string
  readonly password?: string
  readonly encryption?: ICouchbaseAnalyticsEncryptionSettings
}

interface InvalidLink {
  readonly omits: string
  readonly link: LinkDefinition
}

const INVALID_AZURE_LINKS: readonly InvalidLink[] = [
  {
    omits: 'no dataverse',
    link: {
      linkType: AnalyticsLinkType.AzureBlobExternal,
      name: 'azurebloblink',
      dataverse: '',
      accountName: 'myaccount',
      accountKey: 'myaccountkey',
    },
  },
  {
    omits: 'no name',
    link: {
      linkType: AnalyticsLinkType.AzureBlobExternal,
      name: '',
      dataverse: 'Default',
      accountName: 'myaccount',
      accountKey: 'myaccountkey',
    },
  },
  {
    omits: 'no credentials',
    link: {
      linkType: AnalyticsLinkType.AzureBlobExternal,
      name: 'azurebloblink',
      dataverse: 'Default',
    },
  },
  {
    omits: 'an account name and no key',
    link: {
      linkType: AnalyticsLinkType.AzureBlobExternal,
      name: 'azurebloblink',
      dataverse: 'Default',
      accountName: 'myaccount',
    },
  },
  {
    omits: 'a key and no account name',
    link: {
      linkType: AnalyticsLinkType.AzureBlobExternal,
      name: 'azurebloblink',
      dataverse: 'Default',
      accountKey: 'myaccountkey',
    },
  },
  {
    omits: 'a shared access signature and no account name',
    link: {
      linkType: AnalyticsLinkType.AzureBlobExternal,
      name: 'azurebloblink',
      dataverse: 'Default',
      sharedAccessSignature: 'sharedaccesssignature',
    },
  },
]

const INVALID_S3_LINKS: readonly InvalidLink[] = [
  {
    omits: 'no dataverse',
    link: {
      linkType: AnalyticsLinkType.S3External,
      name: 's3link',
      dataverse: '',
      accessKeyId: 'accesskey',
      region: 'us-west-2',
      secretAccessKey: 'supersecretkey',
    },
  },
  {
    omits: 'no name',
    link: {
      linkType: AnalyticsLinkType.S3External,
      name: '',
      dataverse: 'Default',
      accessKeyId: 'accesskey',
      region: 'us-west-2',
      secretAccessKey: 'supersecretkey',
    },
  },
  {
    omits: 'no access key id',
    link: {
      linkType: AnalyticsLinkType.S3External,
      name: 's3link',
      dataverse: 'Default',
      region: 'us-west-2',
      secretAccessKey: 'supersecretkey',
    },
  },
  {
    omits: 'no region',
    link: {
      linkType: AnalyticsLinkType.S3External,
      name: 's3link',
      dataverse: 'Default',
      accessKeyId: 'accesskey',
      secretAccessKey: 'supersecretkey',
    },
  },
  {
    omits: 'no secret access key',
    link: {
      linkType: AnalyticsLinkType.S3External,
      name: 's3link',
      dataverse: 'Default',
      accessKeyId: 'accesskey',
      region: 'us-west-2',
    },
  },
]

const INVALID_COUCHBASE_LINKS: readonly InvalidLink[] = [
  {
    omits: 'no dataverse',
    link: {
      linkType: AnalyticsLinkType.CouchbaseRemote,
      name: 'cbremotelink',
      dataverse: '',
      hostname: 'localhost',
      encryption: { encryptionLevel: AnalyticsEncryptionLevel.None },
      username: 'Admin',
      password: 'password',
    },
  },
  {
    omits: 'no name',
    link: {
      linkType: AnalyticsLinkType.CouchbaseRemote,
      name: '',
      dataverse: 'Default',
      hostname: 'localhost',
      encryption: { encryptionLevel: AnalyticsEncryptionLevel.None },
      username: 'Admin',
      password: 'password',
    },
  },
  {
    omits: 'no hostname',
    link: {
      linkType: AnalyticsLinkType.CouchbaseRemote,
      name: 'cbremotelink',
      dataverse: 'Default',
      hostname: '',
      encryption: { encryptionLevel: AnalyticsEncryptionLevel.None },
      username: 'Admin',
      password: 'password',
    },
  },
  {
    omits: 'no encryption and no username',
    link: {
      linkType: AnalyticsLinkType.CouchbaseRemote,
      name: 'cbremotelink',
      dataverse: 'Default',
      hostname: 'localhost',
      encryption: { encryptionLevel: AnalyticsEncryptionLevel.None },
      password: 'password',
    },
  },
  {
    omits: 'no encryption and no password',
    link: {
      linkType: AnalyticsLinkType.CouchbaseRemote,
      name: 'cbremotelink',
      dataverse: 'Default',
      hostname: 'localhost',
      encryption: { encryptionLevel: AnalyticsEncryptionLevel.None },
      username: 'Admin',
    },
  },
  {
    omits: 'half encryption and no username',
    link: {
      linkType: AnalyticsLinkType.CouchbaseRemote,
      name: 'cbremotelink',
      dataverse: 'Default',
      hostname: 'localhost',
      encryption: { encryptionLevel: AnalyticsEncryptionLevel.Half },
      password: 'password',
    },
  },
  {
    omits: 'half encryption and no password',
    link: {
      linkType: AnalyticsLinkType.CouchbaseRemote,
      name: 'cbremotelink',
      dataverse: 'Default',
      hostname: 'localhost',
      encryption: { encryptionLevel: AnalyticsEncryptionLevel.Half },
      username: 'Admin',
    },
  },
  {
    omits: 'full encryption and no certificate',
    link: {
      linkType: AnalyticsLinkType.CouchbaseRemote,
      name: 'cbremotelink',
      dataverse: 'Default',
      hostname: 'localhost',
      encryption: { encryptionLevel: AnalyticsEncryptionLevel.Full },
    },
  },
  {
    omits: 'a certificate and no credentials or client certificate',
    link: {
      linkType: AnalyticsLinkType.CouchbaseRemote,
      name: 'cbremotelink',
      dataverse: 'Default',
      hostname: 'localhost',
      encryption: {
        encryptionLevel: AnalyticsEncryptionLevel.Full,
        certificate: Buffer.from('certificate', 'utf-8'),
      },
    },
  },
  {
    omits: 'a client certificate and no client key',
    link: {
      linkType: AnalyticsLinkType.CouchbaseRemote,
      name: 'cbremotelink',
      dataverse: 'Default',
      hostname: 'localhost',
      encryption: {
        encryptionLevel: AnalyticsEncryptionLevel.Full,
        certificate: Buffer.from('certificate', 'utf-8'),
        clientCertificate: Buffer.from('clientcertificate', 'utf-8'),
      },
    },
  },
  {
    omits: 'a client key and no client certificate',
    link: {
      linkType: AnalyticsLinkType.CouchbaseRemote,
      name: 'cbremotelink',
      dataverse: 'Default',
      hostname: 'localhost',
      encryption: {
        encryptionLevel: AnalyticsEncryptionLevel.Full,
        certificate: Buffer.from('certificate', 'utf-8'),
        clientKey: Buffer.from('clientkey', 'utf-8'),
      },
    },
  },
]

function azureLink(dataverse: string): LinkDefinition {
  return {
    linkType: AnalyticsLinkType.AzureBlobExternal,
    name: 'azurebloblink',
    dataverse,
    accountName: 'myaccount',
    accountKey: 'myaccountkey',
  }
}

function couchbaseLink(dataverse: string): LinkDefinition {
  return {
    linkType: AnalyticsLinkType.CouchbaseRemote,
    name: 'cbremotelink',
    dataverse,
    hostname: 'localhost',
    encryption: { encryptionLevel: AnalyticsEncryptionLevel.None },
    username: 'Admin',
    password: 'password',
  }
}

function s3Link(dataverse: string, region = 'us-west-2'): LinkDefinition {
  return {
    linkType: AnalyticsLinkType.S3External,
    name: 's3link',
    dataverse,
    accessKeyId: 'accesskey',
    region,
    secretAccessKey: 'supersecretkey',
  }
}

/** A second link in the same dataverse, so `getAllLinks` has two to count. */
function extraS3Link(dataverse: string): LinkDefinition {
  return {
    linkType: AnalyticsLinkType.S3External,
    name: 'extras3link',
    dataverse,
    accessKeyId: 'extraaccesskey',
    region: 'us-west-2',
    secretAccessKey: 'supersecretkey',
  }
}

const LINK_FACTORIES: readonly ((dataverse: string) => LinkDefinition)[] = [
  azureLink,
  couchbaseLink,
  s3Link,
]

const EXPECTED_LINK_COUNT = 2

const MISSING_DATAVERSE = 'notadataverse'

// Created on first use rather than in a hook, so the `#invalidargument` tests,
// which never touch it, do not pay for it.

let dataverse: Promise<string> | undefined

function dataverseFor(env: TestEnv, cluster: Cluster): Promise<string> {
  if (dataverse) {
    return dataverse
  }

  const pending = createDataverse(env, cluster)
  dataverse = pending
  return pending.catch((err) => {
    dataverse = undefined
    throw err
  })
}

async function createDataverse(
  env: TestEnv,
  cluster: Cluster
): Promise<string> {
  const name = env.key()
  // Registered before the create, so a half-successful create is cleaned up.
  env.registerCleanup(async () => {
    await cluster
      .analyticsIndexes()
      .dropDataverse(name, { ignoreIfNotExists: true })
  })

  await cluster.analyticsIndexes().createDataverse(name)
  return name
}

function linkCtx(link: LinkDefinition, op: string): AssertCtx {
  return {
    op,
    extra: `link=${link.linkType}/${link.name || '<unnamed>'}`,
  }
}

async function runRejectsLink(
  env: TestEnv,
  cluster: Cluster,
  link: LinkDefinition
): Promise<void> {
  await expectThrows(
    () => cluster.analyticsIndexes().createLink(link),
    InvalidArgumentError,
    undefined,
    env.ctx(linkCtx(link, 'createLink'))
  )
}

async function runDataverseNotFound(
  env: TestEnv,
  cluster: Cluster,
  link: LinkDefinition
): Promise<void> {
  const manager = cluster.analyticsIndexes()
  const c = env.ctx(linkCtx(link, 'link management'))

  await expectThrows(
    () => manager.createLink(link),
    DataverseNotFoundError,
    undefined,
    c
  )
  await expectThrows(
    () => manager.replaceLink(link),
    DataverseNotFoundError,
    undefined,
    c
  )
  await expectThrows(
    () => manager.dropLink(link.name, link.dataverse),
    DataverseNotFoundError,
    undefined,
    c
  )
}

async function runReplaceMissingLink(
  env: TestEnv,
  cluster: Cluster,
  make: (dataverse: string) => LinkDefinition
): Promise<void> {
  const link = make(await dataverseFor(env, cluster))
  await expectThrows(
    () => cluster.analyticsIndexes().replaceLink(link),
    LinkNotFoundError,
    undefined,
    env.ctx(linkCtx(link, 'replaceLink'))
  )
}

async function runDropMissingLink(
  env: TestEnv,
  cluster: Cluster,
  make: (dataverse: string) => LinkDefinition
): Promise<void> {
  const link = make(await dataverseFor(env, cluster))
  await expectThrows(
    () => cluster.analyticsIndexes().dropLink(link.name, link.dataverse),
    LinkNotFoundError,
    undefined,
    env.ctx(linkCtx(link, 'dropLink'))
  )
}

defineSuite(
  '#analyticslinks',
  {
    features: [ServerFeature.Analytics],
    collection: CollectionStrategy.DefaultCollection,
  },
  ({ test }) => {
    // Regression guard (JSCBC-1468): each title names the omitted field, so a
    // failure says which definition failed.
    describe('#invalidargument', () => {
      for (const { omits, link } of INVALID_AZURE_LINKS) {
        test(`should fail with InvalidArgument error for azureblob links (${omits})`, async ({
          cluster,
          env,
        }) => {
          await runRejectsLink(env, cluster, link)
        })
      }

      for (const { omits, link } of INVALID_S3_LINKS) {
        test(`should fail with InvalidArgument error for s3 links (${omits})`, async ({
          cluster,
          env,
        }) => {
          await runRejectsLink(env, cluster, link)
        })
      }

      for (const { omits, link } of INVALID_COUCHBASE_LINKS) {
        test(`should fail with InvalidArgument error for couchbase links (${omits})`, async ({
          cluster,
          env,
        }) => {
          await runRejectsLink(env, cluster, link)
        })
      }
    })

    describe('#dataversenotfound', () => {
      for (const make of LINK_FACTORIES) {
        const link = make(MISSING_DATAVERSE)
        test(`should fail with DataVerseNotFound error for ${link.linkType} link`, async ({
          cluster,
          env,
        }) => {
          await runDataverseNotFound(env, cluster, link)
        })
      }
    })

    describe('#linknotfound', () => {
      for (const make of LINK_FACTORIES) {
        const linkType = make('').linkType

        test(`should fail to replace with LinkNotFound error for ${linkType} link`, async ({
          cluster,
          env,
        }) => {
          await runReplaceMissingLink(env, cluster, make)
        })

        test(`should fail to drop with LinkNotFound error for ${linkType} link`, async ({
          cluster,
          env,
        }) => {
          await runDropMissingLink(env, cluster, make)
        })
      }
    })

    describe('#link-create-replace-drop', () => {
      // S3 is the only type creatable without a second cluster or an Azure
      // account.
      const linkType = AnalyticsLinkType.S3External

      test(`should create link for ${linkType} link`, async ({
        cluster,
        env,
      }) => {
        const name = await dataverseFor(env, cluster)
        await cluster.analyticsIndexes().createLink(s3Link(name))
        await cluster.analyticsIndexes().createLink(extraS3Link(name))
      })

      test(`should fail to create with LinkExists error for ${linkType} link`, async ({
        cluster,
        env,
      }) => {
        const link = s3Link(await dataverseFor(env, cluster))
        await expectThrows(
          () => cluster.analyticsIndexes().createLink(link),
          LinkExistsError,
          undefined,
          env.ctx(linkCtx(link, 'createLink'))
        )
      })

      test(`should replace link for ${linkType} link`, async ({
        cluster,
        env,
      }) => {
        const name = await dataverseFor(env, cluster)
        await cluster.analyticsIndexes().replaceLink(s3Link(name, 'eu-west-2'))
      })

      test(`should get all ${linkType} links`, async ({ cluster, env }) => {
        const name = await dataverseFor(env, cluster)
        const links = await cluster
          .analyticsIndexes()
          .getAllLinks({ dataverse: name, linkType })

        const c = env.ctx({ op: 'getAllLinks', extra: `dataverse=${name}` })
        expect(
          Array.isArray(links),
          withCtx('getAllLinks did not return an array', c)
        ).toBe(true)
        assertRowCount(links, EXPECTED_LINK_COUNT, c)
      })

      test(`should drop link for ${linkType} link`, async ({
        cluster,
        env,
      }) => {
        const name = await dataverseFor(env, cluster)
        const manager = cluster.analyticsIndexes()
        await manager.dropLink(s3Link(name).name, name)
        await manager.dropLink(extraS3Link(name).name, name)
      })
    })

    // The subject is the callback overload. `awaitCallback` lets the callback
    // settle the wait while a throw fails the test instead of timing it out.
    describe('#link-connect-disconnect', () => {
      test('should successfully connect a link via deprecated path w/ callback', async ({
        cluster,
        env,
      }) => {
        const name = await dataverseFor(env, cluster)
        await awaitCallback<void>((cb) =>
          cluster.analyticsIndexes().connectLink(`\`${name}\`.Local`, cb)
        )
      })

      test('should successfully disconnect a link via deprecated path w/ callback', async ({
        cluster,
        env,
      }) => {
        const name = await dataverseFor(env, cluster)
        await awaitCallback<void>((cb) =>
          cluster.analyticsIndexes().disconnectLink(`\`${name}\`.Local`, cb)
        )
      })

      test('should successfully connect a default link w/ callback', async ({
        cluster,
      }) => {
        await awaitCallback<void>((cb) =>
          cluster.analyticsIndexes().connectLink({}, cb)
        )
      })

      test('should successfully disconnect a default link w/ callback', async ({
        cluster,
      }) => {
        await awaitCallback<void>((cb) =>
          cluster.analyticsIndexes().disconnectLink({}, cb)
        )
      })

      test('should successfully connect a link w/ callback', async ({
        cluster,
        env,
      }) => {
        const name = await dataverseFor(env, cluster)
        await awaitCallback<void>((cb) =>
          cluster
            .analyticsIndexes()
            .connectLink({ dataverseName: name, linkName: 'Local' }, cb)
        )
      })

      test('should successfully disconnect a link w/ callback', async ({
        cluster,
        env,
      }) => {
        const name = await dataverseFor(env, cluster)
        await awaitCallback<void>((cb) =>
          cluster
            .analyticsIndexes()
            .disconnectLink({ dataverseName: name, linkName: 'Local' }, cb)
        )
      })
    })
  }
)
