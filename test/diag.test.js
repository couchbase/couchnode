'use strict'

const assert = require('chai').assert
const H = require('./harness')

describe('#diagnostics', function () {
  describe('#info', function () {
    it('should fetch diagnostics data on a cluster successfully', async function () {
      var testCluster = await H.newCluster()

      // We put this in a try-catch block to enable us to capture the case
      // where the cluster does not support G3CP, and thus cluster-level
      // diagnostics are not possible.
      var res
      try {
        res = await testCluster.diagnostics()
      } catch (_e) {
        res = {
          id: '',
          version: 2,
          sdk: '',
          services: {},
        }
      }
      assert.isObject(res)
      assert.isString(res.id)
      assert.equal(res.version, 2)
      assert.isString(res.sdk)
      assert.isObject(res.services)

      await testCluster.close()
    })

    it('should fetch diagnostics data with a bucket open successfully', async function () {
      var res = await H.c.diagnostics()
      assert.isObject(res)
      assert.isString(res.id)
      assert.equal(res.version, 2)
      assert.isString(res.sdk)
      assert.isObject(res.services)
    })

    it('should ping a cluster successfully', async function () {
      var res = await H.c.ping({
        serviceTypes: [H.lib.ServiceType.KeyValue],
      })
      assert.isObject(res)
      assert.isString(res.id)
      assert.equal(res.version, 2)
      assert.isString(res.sdk)
      assert.isObject(res.services)
    })

    it('should ping a bucket successfully', async function () {
      var res = await H.b.ping({
        serviceTypes: [H.lib.ServiceType.KeyValue],
      })
      assert.isObject(res)
      assert.isString(res.id)
      assert.equal(res.version, 2)
      assert.isString(res.sdk)
      assert.isObject(res.services)
    })

    it('should ping a new cluster successfully', async function () {
      var cluster = await H.lib.Cluster.connect(H.connStr, H.connOpts)

      var res = await cluster.ping({
        serviceTypes: [H.lib.ServiceType.KeyValue],
      })
      assert.isObject(res)
      assert.isString(res.id)
      assert.equal(res.version, 2)
      assert.isString(res.sdk)
      assert.isObject(res.services)

      await cluster.close()
    })

    it('should ping a new bucket successfully', async function () {
      var cluster = await H.lib.Cluster.connect(H.connStr, H.connOpts)
      var bucket = cluster.bucket(H.bucketName)

      var res = await bucket.ping({
        serviceTypes: [H.lib.ServiceType.KeyValue],
      })
      assert.isObject(res)
      assert.isString(res.id)
      assert.equal(res.version, 2)
      assert.isString(res.sdk)
      assert.isObject(res.services)

      await cluster.close()
    })
  })

  describe('#waitUntilReady', function () {
    it('should wait until a cluster is ready', async function () {
      var res = await H.c.waitUntilReady(1500)
      assert.isUndefined(res)
    })

    it('should wait until a bucket is ready', async function () {
      var res = await H.b.waitUntilReady(1500)
      assert.isUndefined(res)
    })

    it('should wait until ready for a desired state of Online', async function () {
      var res = await H.c.waitUntilReady(1500, {
        desiredState: H.lib.ClusterState.Online,
      })
      assert.isUndefined(res)
    })

    it('should wait until ready for a desired state of Degraded', async function () {
      var res = await H.c.waitUntilReady(1500, {
        desiredState: H.lib.ClusterState.Degraded,
      })
      assert.isUndefined(res)
    })

    it('should wait for explicit bucket scoped KV', async function () {
      var res = await H.b.waitUntilReady(1500, {
        serviceTypes: [H.lib.ServiceType.KeyValue],
      })
      assert.isUndefined(res)
    })

    it('should resolve immediately when only KV is requested at cluster scope', async function () {
      var res = await H.c.waitUntilReady(1500, {
        serviceTypes: [H.lib.ServiceType.KeyValue],
      })
      assert.isUndefined(res)
    })

    it('should emit a warn when filtering services at cluster scope', async function () {
      this.timeout(5000)
      var warnings = []
      var cluster = await H.lib.Cluster.connect(H.connStr, {
        ...H.connOpts,
        logger: {
          warn: (message) => warnings.push(message),
        },
      })
      try {
        await cluster.waitUntilReady(1500, {
          serviceTypes: [H.lib.ServiceType.KeyValue],
        })
        assert.isTrue(
          warnings.some(
            (m) =>
              m.includes('ignoring') &&
              m.includes('kv') &&
              m.includes('cluster scope')
          ),
          'expected a warn about ignoring kv at cluster scope, got: ' +
            warnings.join(' | ')
        )
      } finally {
        await cluster.close()
      }
    })

    it('should support node style callbacks', async function () {
      await new Promise((resolve, reject) => {
        H.c.waitUntilReady(1500, (err, res) => {
          if (err) {
            reject(err)
            return
          }
          try {
            assert.isUndefined(res)
            resolve()
          } catch (e) {
            reject(e)
          }
        })
      })
    })

    it('should wait until a new cluster is ready', async function () {
      this.timeout(15000)
      var cluster = await H.lib.Cluster.connect(H.connStr, H.connOpts)
      try {
        var res = await cluster.waitUntilReady(10000)
        assert.isUndefined(res)
      } finally {
        await cluster.close()
      }
    })

    it('should raise InvalidArgument for a non positive timeout', async function () {
      await H.throwsHelper(async () => {
        await H.c.waitUntilReady(-1)
      }, H.lib.InvalidArgumentError)
    })

    it('should raise InvalidArgument for an Offline desired state', async function () {
      await H.throwsHelper(async () => {
        await H.c.waitUntilReady(1500, {
          desiredState: H.lib.ClusterState.Offline,
        })
      }, H.lib.InvalidArgumentError)
    })

    it('should raise InvalidArgument for an invalid service type', async function () {
      await H.throwsHelper(async () => {
        await H.c.waitUntilReady(1500, {
          serviceTypes: ['test-service'],
        })
      }, H.lib.InvalidArgumentError)
    })
  })
})
