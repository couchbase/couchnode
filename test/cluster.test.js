'use strict'

const assert = require('assert')
const harness = require('./harness')

const H = harness

describe('#Cluster', function () {
  it.skip('should queue operations until connected', async () => {
    var cluster = await H.lib.Cluster.connect(H.connStr, H.connOpts)
    var bucket = cluster.bucket(H.bucketName)
    var coll = bucket.defaultCollection()

    await coll.insert(H.genTestKey(), 'bar')

    cluster.close()
  })

  it('should error queued operations after failed connected', async () => {
    var cluster = await H.lib.Cluster.connect(H.connStr, H.connOpts)
    var bucket = cluster.bucket('invalid-bucket')
    var coll = bucket.defaultCollection()

    await H.throwsHelper(async () => {
      await coll.query('SELECT * FROM default')
    }, Error)

    await H.throwsHelper(async () => {
      await coll.insert(H.genTestKey(), 'bar')
    }, Error)

    cluster.close()
  })

  it.skip('should successfully close an unconnected cluster and error ops', async () => {
    var cluster = await H.lib.Cluster.connect(H.connStr, H.connOpts)
    var bucket = cluster.bucket(H.bucketName)
    var coll = bucket.defaultCollection()

    var getProm = coll.insert(H.genTestKey(), 'bar')

    cluster.close()

    await H.throwsHelper(async () => {
      await getProm
    }, Error)
  })

  it.skip('should error ops after close and ignore superfluous closes', async () => {
    var cluster = await H.lib.Cluster.connect(H.connStr, H.connOpts)
    var bucket = cluster.bucket(H.bucketName)
    var coll = bucket.defaultCollection()

    await coll.insert(H.genTestKey(), 'bar')

    cluster.close()
    cluster.close()
    cluster.close()
    cluster.close()

    await H.throwsHelper(async () => {
      await coll.insert(H.genTestKey(), 'bar')
    }, Error)

    cluster.close()
    cluster.close()
  })

  it('lcbVersion property should work', function () {
    assert(typeof H.lib.lcbVersion === 'string')
  })
})
