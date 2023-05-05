'use strict'

const assert = require('assert')
const gc = require('expose-gc/function')
const { Cluster } = require('../lib/cluster')
var { knownProfiles } = require('../lib/configProfile')
const harness = require('./harness')

const H = harness

class TestProfile {
  apply(options) {
    const timeouts = {
      kvTimeout: 5000,
      kvDurableTimeout: 10000,
      analyticsTimeout: 60000,
      managementTimeout: 60000,
      queryTimeout: 60000,
      searchTimeout: 60000,
      viewTimeout: 60000,
    }
    // the profile should override previously set values
    options.timeouts = { ...options.timeouts, ...timeouts }
  }
}

describe('#Cluster', function () {
  it('should queue operations until connected', async function () {
    var cluster = await H.lib.Cluster.connect(H.connStr, H.connOpts)
    var bucket = cluster.bucket(H.bucketName)
    var coll = bucket.defaultCollection()

    await coll.insert(H.genTestKey(), 'bar')

    await cluster.close()
  })

  it('should successfully gc connections', async function () {
    var cluster = await H.lib.Cluster.connect(H.connStr, H.connOpts)
    var bucket = cluster.bucket(H.bucketName)
    var coll = bucket.defaultCollection()
    await coll.insert(H.genTestKey(), 'bar')
    await cluster.close()

    gc()
  })

  it('should successfully close an unconnected cluster and error ops', async function () {
    var cluster = await H.lib.Cluster.connect(H.connStr, H.connOpts)
    var bucket = cluster.bucket(H.bucketName)
    var coll = bucket.defaultCollection()

    await cluster.close()

    await H.throwsHelper(async () => {
      await coll.insert(H.genTestKey(), 'bar')
    }, Error)
  })

  it('should error ops after close and ignore superfluous closes', async function () {
    var cluster = await H.lib.Cluster.connect(H.connStr, H.connOpts)
    var bucket = cluster.bucket(H.bucketName)
    var coll = bucket.defaultCollection()

    await coll.insert(H.genTestKey(), 'bar')

    await cluster.close()
    await cluster.close()
    await cluster.close()
    await cluster.close()

    await H.throwsHelper(async () => {
      await coll.insert(H.genTestKey(), 'bar')
    }, Error)

    await cluster.close()
    await cluster.close()
  })

  it('lcbVersion property should work', function () {
    assert(typeof H.lib.lcbVersion === 'string')
  })

  it('should error with AuthenticationFailureError', async function () {
    if (!H._usingMock) {
      let connOpts = { ...H.connOpts }
      connOpts.username = 'wrongUsername'
      await H.throwsHelper(async () => {
        await H.lib.Cluster.connect(H.connStr, connOpts)
      }, H.lib.AuthenticationFailureError)
    } else {
      this.skip()
    }
  })

  it('should use wanDevelopment config profile', async function () {
    const cluster = await H.lib.Cluster.connect(H.connStr, {
      ...H.connOpts,
      configProfile: 'wanDevelopment',
    })
    assert.strictEqual(cluster.kvTimeout, 20000)
    assert.strictEqual(cluster.kvDurableTimeout, 20000)
    assert.strictEqual(cluster.analyticsTimeout, 120000)
    assert.strictEqual(cluster.managementTimeout, 120000)
    assert.strictEqual(cluster.queryTimeout, 120000)
    assert.strictEqual(cluster.searchTimeout, 120000)
    assert.strictEqual(cluster.viewTimeout, 120000)
    assert.strictEqual(cluster.bootstrapTimeout, 120000)
    assert.strictEqual(cluster.connectTimeout, 20000)
    assert.strictEqual(cluster.resolveTimeout, 20000)
  })

  it('should error when config profile is not registered', function () {
    assert.throws(
      () => {
        new Cluster(H.connStr, { ...H.connOpts, configProfile: 'testProfile' })
      },
      { name: 'Error', message: 'testProfile is not a registered profile.' }
    )
  })

  it('should use custom config profile', async function () {
    knownProfiles.registerProfile('testProfile', new TestProfile())
    const cluster = await H.lib.Cluster.connect(H.connStr, {
      ...H.connOpts,
      configProfile: 'testProfile',
    })
    assert.strictEqual(cluster.kvTimeout, 5000)
    assert.strictEqual(cluster.kvDurableTimeout, 10000)
    assert.strictEqual(cluster.analyticsTimeout, 60000)
    assert.strictEqual(cluster.managementTimeout, 60000)
    assert.strictEqual(cluster.queryTimeout, 60000)
    assert.strictEqual(cluster.searchTimeout, 60000)
    assert.strictEqual(cluster.viewTimeout, 60000)
  })
})
