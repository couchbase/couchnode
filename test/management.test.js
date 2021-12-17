'use strict'

const H = require('./harness')

describe('#management-apis', function () {
  it('should successfully timeout operations (slow)', async function () {
    var bmgr = H.c.buckets()
    await H.throwsHelper(async () => {
      await bmgr.flushBucket('default', { timeout: 1 })
    }, H.lib.TimeoutError)
    await H.sleep(1000)
  }).timeout(2000)
})
