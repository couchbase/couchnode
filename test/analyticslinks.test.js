'use strict'

const assert = require('chai').assert
const {
  AnalyticsLinkType,
  AnalyticsEncryptionLevel,
} = require('../lib/analyticsindexmanager')
const H = require('./harness')

describe('#analyticslinks', function () {
  let dvName

  before(async function () {
    H.skipIfMissingFeature(this, H.Features.Analytics)
    this.timeout(10000)
    dvName = H.genTestKey()
    await H.c.analyticsIndexes().createDataverse(dvName)
  })

  after(async function () {
    if (H.supportsFeature(H.Features.Analytics)) {
      this.timeout(10000)
      await H.c.analyticsIndexes().dropDataverse(dvName)
    }
  })

  /* eslint-disable mocha/no-setup-in-describe */
  describe('#invalidargument', function () {
    const azurelinks = [
      {
        linkType: AnalyticsLinkType.AzureBlobExternal,
        name: 'azurebloblink',
        dataverse: '',
        accountName: 'myaccount',
        accountKey: 'myaccountkey',
      },
      {
        linkType: AnalyticsLinkType.AzureBlobExternal,
        name: '',
        dataverse: 'Default',
        accountName: 'myaccount',
        accountKey: 'myaccountkey',
      },
      {
        linkType: AnalyticsLinkType.AzureBlobExternal,
        name: 'azurebloblink',
        dataverse: 'Default',
      },
      {
        linkType: AnalyticsLinkType.AzureBlobExternal,
        name: 'azurebloblink',
        dataverse: 'Default',
        accountName: 'myaccount',
      },
      {
        linkType: AnalyticsLinkType.AzureBlobExternal,
        name: 'azurebloblink',
        dataverse: 'Default',
        accountKey: 'myaccountkey',
      },
      {
        linkType: AnalyticsLinkType.AzureBlobExternal,
        name: 'azurebloblink',
        dataverse: 'Default',
        sharedAccessSignature: 'sharedaccesssignature',
      },
    ]

    const s3links = [
      {
        linkType: AnalyticsLinkType.S3External,
        name: 's3link',
        dataverse: '',
        accessKeyId: 'accesskey',
        region: 'us-west-2',
        secretAccessKey: 'supersecretkey',
      },
      {
        linkType: AnalyticsLinkType.S3External,
        name: '',
        dataverse: 'Default',
        accessKeyId: 'accesskey',
        region: 'us-west-2',
        secretAccessKey: 'supersecretkey',
      },
      {
        linkType: AnalyticsLinkType.S3External,
        name: 's3link',
        dataverse: 'Default',
        region: 'us-west-2',
        secretAccessKey: 'supersecretkey',
      },
      {
        linkType: AnalyticsLinkType.S3External,
        name: 's3link',
        dataverse: 'Default',
        accessKeyId: 'accesskey',
        secretAccessKey: 'supersecretkey',
      },
      {
        linkType: AnalyticsLinkType.S3External,
        name: 's3link',
        dataverse: 'Default',
        accessKeyId: 'accesskey',
        region: 'us-west-2',
      },
    ]

    const cblinks = [
      {
        linkType: AnalyticsLinkType.CouchbaseRemote,
        name: 'cbremotelink',
        dataverse: '',
        hostname: 'localhost',
        encryption: {
          encryptionLevel: AnalyticsEncryptionLevel.None,
        },
        username: 'Admin',
        password: 'password',
      },
      {
        linkType: AnalyticsLinkType.CouchbaseRemote,
        name: '',
        dataverse: 'Default',
        hostname: 'localhost',
        encryption: {
          encryptionLevel: AnalyticsEncryptionLevel.None,
        },
        username: 'Admin',
        password: 'password',
      },
      {
        linkType: AnalyticsLinkType.CouchbaseRemote,
        name: 'cbremotelink',
        dataverse: 'Default',
        hostname: '',
        encryption: {
          encryptionLevel: AnalyticsEncryptionLevel.None,
        },
        username: 'Admin',
        password: 'password',
      },
      {
        linkType: AnalyticsLinkType.CouchbaseRemote,
        name: 'cbremotelink',
        dataverse: 'Default',
        hostname: 'localhost',
        encryption: {
          encryptionLevel: AnalyticsEncryptionLevel.None,
        },
        password: 'password',
      },
      {
        linkType: AnalyticsLinkType.CouchbaseRemote,
        name: 'cbremotelink',
        dataverse: 'Default',
        hostname: 'localhost',
        encryption: {
          encryptionLevel: AnalyticsEncryptionLevel.None,
        },
        username: 'Admin',
      },
      {
        linkType: AnalyticsLinkType.CouchbaseRemote,
        name: 'cbremotelink',
        dataverse: 'Default',
        hostname: 'localhost',
        encryption: {
          encryptionLevel: AnalyticsEncryptionLevel.Half,
        },
        password: 'password',
      },
      {
        linkType: AnalyticsLinkType.CouchbaseRemote,
        name: 'cbremotelink',
        dataverse: 'Default',
        hostname: 'localhost',
        encryption: {
          encryptionLevel: AnalyticsEncryptionLevel.Half,
        },
        username: 'Admin',
      },
      {
        linkType: AnalyticsLinkType.CouchbaseRemote,
        name: 'cbremotelink',
        dataverse: 'Default',
        hostname: 'localhost',
        encryption: {
          encryptionLevel: AnalyticsEncryptionLevel.Full,
        },
      },
      {
        linkType: AnalyticsLinkType.CouchbaseRemote,
        name: 'cbremotelink',
        dataverse: 'Default',
        hostname: 'localhost',
        encryption: {
          encryptionLevel: AnalyticsEncryptionLevel.Full,
          certificate: Buffer.from('certificate', 'utf-8'),
        },
      },
      {
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
      {
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
    ]

    azurelinks.forEach((link) => {
      it(`should fail with InvalidArgument error for azureblob links`, async function () {
        await H.throwsHelper(async () => {
          await H.c.analyticsIndexes().createLink(link)
        }, H.lib.InvalidArgumentError)
      })
    })

    s3links.forEach((link) => {
      it(`should fail with InvalidArgument error for s3 links`, async function () {
        await H.throwsHelper(async () => {
          await H.c.analyticsIndexes().createLink(link)
        }, H.lib.InvalidArgumentError)
      })
    })

    cblinks.forEach((link) => {
      it(`should fail with InvalidArgument error for couchbase links`, async function () {
        await H.throwsHelper(async () => {
          await H.c.analyticsIndexes().createLink(link)
        }, H.lib.InvalidArgumentError)
      })
    })
  })

  /* eslint-disable mocha/no-setup-in-describe */
  describe('#dataversenotfound', function () {
    const links = [
      {
        linkType: AnalyticsLinkType.AzureBlobExternal,
        name: 'azurebloblink',
        dataverse: 'notadataverse',
        accountName: 'myaccount',
        accountKey: 'myaccountkey',
      },
      {
        linkType: AnalyticsLinkType.CouchbaseRemote,
        name: 'cbremotelink',
        dataverse: 'notadataverse',
        hostname: 'localhost',
        encryption: {
          encryptionLevel: AnalyticsEncryptionLevel.None,
        },
        username: 'Admin',
        password: 'password',
      },
      {
        linkType: AnalyticsLinkType.S3External,
        name: 's3link',
        dataverse: 'notadataverse',
        accessKeyId: 'accesskey',
        region: 'us-west-2',
        secretAccessKey: 'supersecretkey',
      },
    ]

    links.forEach((link) => {
      it(`should fail with DataVerseNotFound error for ${link.linkType} link`, async function () {
        await H.throwsHelper(async () => {
          await H.c.analyticsIndexes().createLink(link)
        }, H.lib.DataverseNotFoundError)
        await H.throwsHelper(async () => {
          await H.c.analyticsIndexes().replaceLink(link)
        }, H.lib.DataverseNotFoundError)
        await H.throwsHelper(async () => {
          await H.c.analyticsIndexes().dropLink(link.name, link.dataverse)
        }, H.lib.DataverseNotFoundError)
      })
    })
  })

  /* eslint-disable mocha/no-setup-in-describe */
  describe('#linknotfound', function () {
    const links = [
      {
        linkType: AnalyticsLinkType.AzureBlobExternal,
        name: 'azurebloblink',
        dataverse: undefined,
        accountName: 'myaccount',
        accountKey: 'myaccountkey',
      },
      {
        linkType: AnalyticsLinkType.CouchbaseRemote,
        name: 'cbremotelink',
        dataverse: undefined,
        hostname: 'localhost',
        encryption: {
          encryptionLevel: AnalyticsEncryptionLevel.None,
        },
        username: 'Admin',
        password: 'password',
      },
      {
        linkType: AnalyticsLinkType.S3External,
        name: 's3link',
        dataverse: undefined,
        accessKeyId: 'accesskey',
        region: 'us-west-2',
        secretAccessKey: 'supersecretkey',
      },
    ]

    links.forEach((link) => {
      it(`should fail to replace with LinkNotFound error for ${link.linkType} link`, async function () {
        // have to set the dataversname after it has been defined
        link.dataverse = dvName
        await H.throwsHelper(async () => {
          await H.c.analyticsIndexes().replaceLink(link)
        }, H.lib.LinkNotFoundError)
      })

      it(`should fail tod drop with LinkNotFound error for ${link.linkType} link`, async function () {
        // have to set the dataversname after it has been defined
        link.dataverse = dvName
        await H.throwsHelper(async () => {
          await H.c.analyticsIndexes().dropLink(link.name, link.dataverse)
        }, H.lib.LinkNotFoundError)
      }).timeout(5000)
    })
  })

  /* eslint-disable mocha/no-setup-in-describe */
  describe('#link-create-replace-drop', function () {
    const extraLink = {
      linkType: AnalyticsLinkType.S3External,
      name: 'extras3link',
      dataverse: undefined,
      accessKeyId: 'extraaccesskey',
      region: 'us-west-2',
      secretAccessKey: 'supersecretkey',
    }

    // can only test w/ S3 (at least easily)
    // have to set the dataversname after it has been defined (e.g. w/in the specific test)
    const links = [
      {
        linkType: AnalyticsLinkType.S3External,
        name: 's3link',
        dataverse: undefined,
        accessKeyId: 'accesskey',
        region: 'us-west-2',
        secretAccessKey: 'supersecretkey',
      },
    ]

    links.forEach((link) => {
      it(`should create link for ${link.linkType} link`, async function () {
        link.dataverse = dvName
        extraLink.dataverse = dvName
        await H.c.analyticsIndexes().createLink(link)
        await H.c.analyticsIndexes().createLink(extraLink)
      }).timeout(5000)

      it(`should fail to create with LinkExists error for ${link.linkType} link`, async function () {
        link.dataverse = dvName
        await H.throwsHelper(async () => {
          await H.c.analyticsIndexes().createLink(link)
        }, H.lib.LinkExistsError)
      })

      it(`should replace link for ${link.linkType} link`, async function () {
        link.dataverse = dvName
        link.region = 'eu-west-2'
        await H.c.analyticsIndexes().replaceLink(link)
      }).timeout(5000)

      it(`should get all ${link.linkType} links`, async function () {
        const linkResult = await H.c
          .analyticsIndexes()
          .getAllLinks({ dataverse: dvName, linkType: link.linkType })
        assert.isArray(linkResult)
        assert.lengthOf(linkResult, 2)
      }).timeout(5000)

      it(`should drop link for ${link.linkType} link`, async function () {
        link.dataverse = dvName
        extraLink.dataverse = dvName
        await H.c.analyticsIndexes().dropLink(link.name, link.dataverse)
        await H.c
          .analyticsIndexes()
          .dropLink(extraLink.name, extraLink.dataverse)
      }).timeout(5000)
    })
  })

  /* eslint-disable mocha/no-setup-in-describe */
  describe('#link-connect-disconnect', function () {
    // TODO(JSCBC-1293):  Remove deprecated path
    it('should successfully connect a link via deprecated path w/ callback', function (done) {
      const linkStr = '`' + dvName + '`.Local'
      H.c.analyticsIndexes().connectLink(linkStr, (err) => {
        if (err) {
          done(err)
        } else {
          done()
        }
      })
    }).timeout(10000)

    // TODO(JSCBC-1293):  Remove deprecated path
    it('should successfully disconnect a link via deprecated path w/ callback', function (done) {
      const linkStr = '`' + dvName + '`.Local'
      H.c.analyticsIndexes().disconnectLink(linkStr, (err) => {
        if (err) {
          done(err)
        } else {
          done()
        }
      })
    })

    it('should successfully connect a default link w/ callback', function (done) {
      H.c.analyticsIndexes().connectLink({}, (err) => {
        if (err) {
          done(err)
        } else {
          done()
        }
      })
    }).timeout(10000)

    it('should successfully disconnect a default link w/ callback', function (done) {
      H.c.analyticsIndexes().disconnectLink({}, (err) => {
        if (err) {
          done(err)
        } else {
          done()
        }
      })
    })

    it('should successfully connect a link w/ callback', function (done) {
      H.c
        .analyticsIndexes()
        .connectLink({ dataverseName: dvName, linkName: 'Local' }, (err) => {
          if (err) {
            done(err)
          } else {
            done()
          }
        })
    }).timeout(10000)

    it('should successfully disconnect a link w/ callback', function (done) {
      H.c
        .analyticsIndexes()
        .disconnectLink({ dataverseName: dvName, linkName: 'Local' }, (err) => {
          if (err) {
            done(err)
          } else {
            done()
          }
        })
    })
  })
})
