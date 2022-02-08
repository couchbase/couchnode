'use strict'

const assert = require('assert')
const gc = require('expose-gc/function')
const harness = require('./harness')

const H = harness

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
})
