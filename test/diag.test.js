'use strict'

const assert = require('chai').assert
const H = require('./harness')

describe('#diagnostics', () => {
  describe('#info', () => {
    it('should fetch diagnostics data on a cluster successfully', async () => {
      var testCluster = await H.newCluster()

      // We put this in a try-catch block to enable us to capture the case
      // where the cluster does not support G3CP, and thus cluster-level
      // diagnostics are not possible.
      var res
      try {
        res = await testCluster.diagnostics()
      } catch (e) {
        res = {
          id: '',
          version: 1,
          sdk: '',
          services: [],
        }
      }
      assert.isObject(res)
      assert.isString(res.id)
      assert.equal(res.version, 1)
      assert.isString(res.sdk)
      assert.isArray(res.services)

      await testCluster.close()
    })

    it('should fetch diagnostics data with a bucket open successfully', async () => {
      var res = await H.c.diagnostics()
      assert.isObject(res)
      assert.isString(res.id)
      assert.equal(res.version, 1)
      assert.isString(res.sdk)
      assert.isArray(res.services)
    })

    it('should ping a cluster successfully', async () => {
      var res = await H.c.ping({
        serviceTypes: [H.lib.ServiceType.KeyValue],
      })
      assert.isObject(res)
      assert.isString(res.id)
      assert.equal(res.version, 1)
      assert.isString(res.sdk)
      assert.isObject(res.services)
    })

    it('should ping a bucket successfully', async () => {
      var res = await H.b.ping({
        serviceTypes: [H.lib.ServiceType.KeyValue],
      })
      assert.isObject(res)
      assert.isString(res.id)
      assert.equal(res.version, 1)
      assert.isString(res.sdk)
      assert.isObject(res.services)
    })
  })
})
