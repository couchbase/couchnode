'use strict'

const assert = require('chai').assert
const { DurabilityLevel } = require('../lib/generaltypes')
const H = require('./harness')

const errorTranscoder = {
  encode: () => {
    throw new Error('encode error')
  },
  decode: () => {
    throw new Error('decode error')
  },
}

var testObjVal = {
  foo: 'bar',
  baz: 19,
  c: 1,
  d: 'str',
  e: true,
  f: false,
  g: 5,
  h: 6,
  i: 7,
  j: 8,
  k: 9,
  l: 10,
  m: 11,
  n: 12,
  o: 13,
  p: 14,
  q: 15,
  r: 16,
  utf8: 'é',
}
var testUtf8Val = 'é'
var testBinVal = Buffer.from(
  '00092bc691fb824300a6871ceddf7090d7092bc691fb824300a6871ceddf7090d7',
  'hex'
)

function genericTests(collFn) {
  describe('#basic', function () {
    let testKeyA
    let testKeyUtf8
    let testKeyBin

    before(function () {
      testKeyA = H.genTestKey()
      testKeyUtf8 = H.genTestKey()
      testKeyBin = H.genTestKey()
    })

    after(async function () {
      try {
        await collFn().remove(testKeyA)
      } catch (e) {
        // nothing
      }
      try {
        await collFn().remove(testKeyUtf8)
      } catch (e) {
        // ignore
      }
      try {
        //await collFn().remove(testKeyBin)
      } catch (e) {
        // ignore
      }
    })

    describe('#upsert', function () {
      it('should perform basic upserts', async function () {
        var res = await collFn().upsert(testKeyA, testObjVal)
        assert.isObject(res)
        assert.isOk(res.cas)
      })

      it('should upsert with UTF8 data properly', async function () {
        var res = await collFn().upsert(testKeyUtf8, testUtf8Val)
        assert.isObject(res)
        assert.isOk(res.cas)
      })

      it('should upsert with binary data properly', async function () {
        var res = await collFn().upsert(testKeyBin, testBinVal)
        assert.isObject(res)
        assert.isOk(res.cas)
      })

      it('should not crash on transcoder errors', async function () {
        await H.throwsHelper(
          async () => {
            await collFn().upsert(testKeyA, testObjVal, {
              transcoder: errorTranscoder,
            })
          },
          Error,
          'encode error'
        )
      })

      it('should preserve expiry successfully', async function () {
        H.skipIfMissingFeature(this, H.Features.PreserveExpiry)

        const testKeyPe = H.genTestKey()

        // Insert a test document
        var res = await collFn().insert(testKeyPe, { foo: 14 }, { expiry: 1 })
        assert.isObject(res)

        await collFn().upsert(
          testKeyPe,
          { foo: 13 },
          {
            preserveExpiry: true,
          }
        )

        await H.sleep(2000)

        // Ensure the key is gone
        await H.throwsHelper(async () => {
          await collFn().get(testKeyPe)
        })
      }).timeout(3500)
    })

    describe('#get', function () {
      it('should perform basic gets', async function () {
        var res = await collFn().get(testKeyA)
        assert.isObject(res)
        assert.isOk(res.cas)
        assert.deepStrictEqual(res.value, testObjVal)

        // BUG JSCBC-784: Check to make sure that the value property
        // returns the same as the content property.
        assert.strictEqual(res.value, res.content)
      })

      it('should fetch utf8 documents', async function () {
        var res = await collFn().get(testKeyUtf8)
        assert.isObject(res)
        assert.isOk(res.cas)
        assert.deepStrictEqual(res.value, testUtf8Val)
      })

      it('should fetch binary documents', async function () {
        var res = await collFn().get(testKeyBin)
        assert.isObject(res)
        assert.isOk(res.cas)
        assert.deepStrictEqual(res.value, testBinVal)
      })

      it('should not crash on transcoder errors', async function () {
        await collFn().upsert(testKeyA, testObjVal)

        await H.throwsHelper(
          async () => {
            await collFn().get(testKeyA, {
              transcoder: errorTranscoder,
            })
          },
          Error,
          'decode error'
        )
      })

      it('should perform basic gets with callback', function (callback) {
        collFn().get(testKeyA, (err, res) => {
          assert.isObject(res)
          assert.isOk(res.cas)
          assert.deepStrictEqual(res.value, testObjVal)
          callback(err)
        })
      })

      it('should perform errored gets with callback', function (callback) {
        collFn().get('invalid-key', (err, res) => {
          res
          assert.isOk(err)
          callback(null)
        })
      })

      it('should perform projected gets', async function () {
        var res = await collFn().get(testKeyA, {
          project: ['baz'],
        })
        assert.isObject(res)
        assert.isOk(res.cas)
        assert.deepStrictEqual(res.content, { baz: 19 })

        // BUG JSCBC-784: Check to make sure that the value property
        // returns the same as the content property.
        assert.strictEqual(res.value, res.content)
      })

      it('should fall back to full get projection', async function () {
        H.skipIfMissingFeature(this, H.Features.Xattr)

        var res = await collFn().get(testKeyA, {
          project: [
            'c',
            'd',
            'e',
            'f',
            'g',
            'h',
            'i',
            'j',
            'k',
            'l',
            'm',
            'n',
            'o',
            'p',
            'q',
            'r',
          ],
          withExpiry: true,
        })
        assert.isObject(res)
        assert.isOk(res.cas)
        assert.isNumber(res.expiry)
        assert.deepStrictEqual(res.content, {
          c: 1,
          d: 'str',
          e: true,
          f: false,
          g: 5,
          h: 6,
          i: 7,
          j: 8,
          k: 9,
          l: 10,
          m: 11,
          n: 12,
          o: 13,
          p: 14,
          q: 15,
          r: 16,
        })

        // BUG JSCBC-784: Check to make sure that the value property
        // returns the same as the content property.
        assert.strictEqual(res.value, res.content)
      })
    })

    describe('#exists', function () {
      before(function () {
        H.skipIfMissingFeature(this, H.Features.GetMeta)
      })

      it('should successfully perform exists -> true', async function () {
        var res = await collFn().exists(testKeyA)
        assert.isObject(res)
        assert.strictEqual(res.exists, true)
        assert.isOk(res.cas)
      })

      it('should successfully perform exists -> false', async function () {
        var res = await collFn().exists('a-missing-key')
        assert.isObject(res)
        assert.strictEqual(res.exists, false)
        assert.isNotEmpty(res.cas)
        assert.isNotOk(parseInt(res.cas.toString()))
      })
    })

    describe('#replace', function () {
      it('should replace data correctly', async function () {
        var res = await collFn().replace(testKeyA, { foo: 'baz' })
        assert.isObject(res)
        assert.isOk(res.cas)

        var gres = await collFn().get(testKeyA)
        assert.deepStrictEqual(gres.value, { foo: 'baz' })
      })

      it('should cas mismatch when replacing with wrong cas', async function () {
        var getRes = await collFn().get(testKeyA)

        await collFn().replace(testKeyA, { foo: 'boz' })

        await H.throwsHelper(async () => {
          await collFn().replace(
            testKeyA,
            { foo: 'bla' },
            {
              cas: getRes.cas,
            }
          )
        }, H.lib.CasMismatchError)
      })
    })

    describe('#remove', function () {
      it('should perform basic removes', async function () {
        var res = await collFn().remove(testKeyA)
        assert.isObject(res)
        assert.isOk(res.cas)
      })
    })

    describe('#insert', function () {
      let testKeyIns

      before(function () {
        testKeyIns = H.genTestKey()
      })

      it('should perform inserts correctly', async function () {
        var res = await collFn().insert(testKeyIns, { foo: 'bar' })
        assert.isObject(res)
        assert.isOk(res.cas)
      })

      it('should fail to insert a second time', async function () {
        await H.throwsHelper(async () => {
          await collFn().insert(testKeyIns, { foo: 'bar' })
        })
      })

      it('should remove the insert test key', async function () {
        await collFn().remove(testKeyIns)
      })

      it('should insert w/ expiry successfully (slow)', async function () {
        const testKeyExp = H.genTestKey()

        var res = await collFn().insert(testKeyExp, { foo: 14 }, { expiry: 1 })
        assert.isObject(res)
        assert.isOk(res.cas)

        await H.sleep(2000)

        await H.throwsHelper(async () => {
          await collFn().get(testKeyExp)
        })
      }).timeout(4000)
    })

    describe('#serverDurability', function () {
      let testKeyIns

      before(async function () {
        H.skipIfMissingFeature(this, H.Features.ServerDurability)

        testKeyIns = H.genTestKey()
      })

      it('should insert w/ server durability', async function () {
        var res = await collFn().insert(
          testKeyIns,
          { foo: 'bar' },
          { durabilityLevel: DurabilityLevel.PersistToMajority }
        )
        assert.isObject(res)
        assert.isOk(res.cas)
      })

      it('should upsert data w/ server durability', async function () {
        var res = await collFn().upsert(
          testKeyA,
          { foo: 'baz' },
          { durabilityLevel: DurabilityLevel.PersistToMajority }
        )
        assert.isObject(res)
        assert.isOk(res.cas)

        var gres = await collFn().get(testKeyA)
        assert.deepStrictEqual(gres.value, { foo: 'baz' })
      })

      it('should replace data correctly w/ server durability', async function () {
        var res = await collFn().replace(
          testKeyA,
          { foo: 'qux' },
          { durabilityLevel: DurabilityLevel.PersistToMajority }
        )
        assert.isObject(res)
        assert.isOk(res.cas)

        var gres = await collFn().get(testKeyA)
        assert.deepStrictEqual(gres.value, { foo: 'qux' })
      })

      it('should remove the insert test key w/ server durability', async function () {
        await collFn().remove(testKeyIns, {
          durabilityLevel: DurabilityLevel.PersistToMajority,
        })
      })

      it('should fail w/ InvalidDurabilityLevel', async function () {
        await H.throwsHelper(async () => {
          await collFn().insert(
            testKeyIns,
            { foo: 'bar' },
            { durabilityLevel: 5 }
          )
        }, H.lib.InvalidDurabilityLevel)
      })
    })

    describe('#clientDurability', function () {
      let testKeyIns
      let numReplicas

      before(async function () {
        H.skipIfMissingFeature(this, H.Features.BucketManagement)
        var bmgr = H.c.buckets()
        var res = await bmgr.getBucket(H.b.name)
        numReplicas = res.numReplicas
        testKeyIns = H.genTestKey()
      })

      it('should insert w/ client durability', async function () {
        var res = await collFn().insert(
          testKeyIns,
          { foo: 'bar' },
          { durabilityPersistTo: 1, durabilityReplicateTo: numReplicas }
        )
        assert.isObject(res)
        assert.isOk(res.cas)
      })

      it('should upsert data w/ client durability', async function () {
        var res = await collFn().upsert(
          testKeyA,
          { foo: 'baz' },
          { durabilityPersistTo: 1, durabilityReplicateTo: numReplicas }
        )
        assert.isObject(res)
        assert.isOk(res.cas)

        var gres = await collFn().get(testKeyA)
        assert.deepStrictEqual(gres.value, { foo: 'baz' })
      })

      it('should replace data correctly w/ client durability', async function () {
        var res = await collFn().replace(
          testKeyA,
          { foo: 'qux' },
          { durabilityPersistTo: 1, durabilityReplicateTo: numReplicas }
        )
        assert.isObject(res)
        assert.isOk(res.cas)

        var gres = await collFn().get(testKeyA)
        assert.deepStrictEqual(gres.value, { foo: 'qux' })
      })

      it('should remove the client test key w/ client durability', async function () {
        await collFn().remove(testKeyIns)
      })

      it('should fail w/ DurabilityImpossibleError', async function () {
        await H.throwsHelper(async () => {
          await collFn().insert(
            testKeyIns,
            { foo: 'bar' },
            { durabilityPersistTo: 1, durabilityReplicateTo: numReplicas + 2 }
          )
        }, H.lib.DurabilityImpossibleError)
      })

      it('should fail w/ InvalidDurabilityPersistToLevel', async function () {
        await H.throwsHelper(async () => {
          await collFn().insert(
            testKeyIns,
            { foo: 'bar' },
            { durabilityPersistTo: 6, durabilityReplicateTo: numReplicas }
          )
        }, H.lib.InvalidDurabilityPersistToLevel)
      })

      it('should fail w/ InvalidDurabilityReplicateToLevel', async function () {
        await H.throwsHelper(async () => {
          await collFn().insert(
            testKeyIns,
            { foo: 'bar' },
            { durabilityPersistTo: 1, durabilityReplicateTo: 4 }
          )
        }, H.lib.InvalidDurabilityReplicateToLevel)
      })
    })

    describe('#touch', function () {
      it('should touch a document successfully (slow)', async function () {
        const testKeyTch = H.genTestKey()

        // Insert a test document
        var res = await collFn().insert(testKeyTch, { foo: 14 }, { expiry: 3 })
        assert.isObject(res)
        assert.isOk(res.cas)

        // Ensure the key is there
        await collFn().get(testKeyTch)

        // Touch the document
        var tres = await collFn().touch(testKeyTch, 8)
        assert.isObject(tres)
        assert.isOk(tres.cas)

        // Wait for the first expiry
        await H.sleep(4000)

        // Ensure the key is still there
        await collFn().get(testKeyTch)

        // Wait for it to expire
        await H.sleep(5000)

        // Ensure the key is gone
        await H.throwsHelper(async () => {
          await collFn().get(testKeyTch)
        })
      }).timeout(15000)
    })

    describe('#getAndTouch', function () {
      it('should touch a document successfully (slow)', async function () {
        const testKeyGat = H.genTestKey()

        // Insert a test document
        var res = await collFn().insert(testKeyGat, { foo: 14 }, { expiry: 3 })
        assert.isObject(res)
        assert.isOk(res.cas)

        // Ensure the key is there
        await collFn().get(testKeyGat)

        // Touch the document
        var tres = await collFn().getAndTouch(testKeyGat, 8)
        assert.isObject(tres)
        assert.isOk(tres.cas)
        assert.deepStrictEqual(tres.value, { foo: 14 })

        // BUG JSCBC-784: Check to make sure that the value property
        // returns the same as the content property.
        assert.strictEqual(tres.value, tres.content)

        // Wait for the first expiry
        await H.sleep(4000)

        // Ensure the key is still there
        await collFn().get(testKeyGat)

        // Wait for it to expire
        await H.sleep(5000)

        // Ensure the key is gone
        await H.throwsHelper(async () => {
          await collFn().get(testKeyGat)
        })
      }).timeout(15000)
    })
  })

  describe('#getReplicas', function () {
    let replicaTestKey

    before(async function () {
      H.skipIfMissingFeature(this, H.Features.Replicas)
      replicaTestKey = H.genTestKey()
      await collFn().upsert(replicaTestKey, testObjVal)
    })

    after(async function () {
      try {
        await collFn().remove(replicaTestKey)
      } catch (e) {
        // nothing
      }
    })

    it('should perform basic get all replicas', async function () {
      var res = await collFn().getAllReplicas(replicaTestKey)

      assert.isArray(res)
      assert.isAtLeast(res.length, 1)
      assert.isBoolean(res[0].isReplica)
      assert.isNotEmpty(res[0].cas)
      assert.deepStrictEqual(res[0].content, testObjVal)
    })

    it('should perform basic get any replica', async function () {
      var res = await collFn().getAnyReplica(replicaTestKey)

      assert.isObject(res)
      assert.isNotEmpty(res.cas)
      assert.deepStrictEqual(res.content, testObjVal)
    })
  })

  describe('#binary', function () {
    let testKeyBin

    before(async function () {
      testKeyBin = H.genTestKey()

      await collFn().insert(testKeyBin, 14)
    })

    after(async function () {
      await collFn().remove(testKeyBin)
    })

    describe('#increment', function () {
      it('should increment successfully', async function () {
        var res = await collFn().binary().increment(testKeyBin, 3)
        assert.isObject(res)
        assert.isOk(res.cas)
        assert.deepStrictEqual(res.value, 17)

        var gres = await collFn().get(testKeyBin)
        assert.deepStrictEqual(gres.value, 17)
      })
    })

    describe('#decrement', function () {
      it('should decrement successfully', async function () {
        var res = await collFn().binary().decrement(testKeyBin, 4)
        assert.isObject(res)
        assert.isOk(res.cas)
        assert.deepStrictEqual(res.value, 13)

        var gres = await collFn().get(testKeyBin)
        assert.deepStrictEqual(gres.value, 13)
      })
    })

    describe('#append', function () {
      it('should append successfuly', async function () {
        var res = await collFn().binary().append(testKeyBin, 'world')
        assert.isObject(res)
        assert.isOk(res.cas)

        var gres = await collFn().get(testKeyBin)
        assert.isTrue(Buffer.isBuffer(gres.value))
        assert.deepStrictEqual(gres.value.toString(), '13world')
      })
    })

    describe('#prepend', function () {
      it('should prepend successfuly', async function () {
        var res = await collFn().binary().prepend(testKeyBin, 'hello')
        assert.isObject(res)
        assert.isOk(res.cas)

        var gres = await collFn().get(testKeyBin)
        assert.isTrue(Buffer.isBuffer(gres.value))
        assert.deepStrictEqual(gres.value.toString(), 'hello13world')
      })
    })
  })

  describe('binary server durability', function () {
    let testKeyBin

    before(async function () {
      testKeyBin = H.genTestKey()

      await collFn().insert(testKeyBin, 14)

      H.skipIfMissingFeature(this, H.Features.ServerDurability)
    })

    after(async function () {
      await collFn().remove(testKeyBin)
    })

    describe('#increment', function () {
      it('should increment successfully w/ server durability', async function () {
        var res = await collFn().binary().increment(testKeyBin, 3, {
          durabilityLevel: DurabilityLevel.PersistToMajority,
        })
        assert.isObject(res)
        assert.isOk(res.cas)
        assert.deepStrictEqual(res.value, 17)

        var gres = await collFn().get(testKeyBin)
        assert.deepStrictEqual(gres.value, 17)
      })
    })

    describe('#decrement', function () {
      it('should decrement successfully w/ server durability', async function () {
        var res = await collFn().binary().decrement(testKeyBin, 4, {
          durabilityLevel: DurabilityLevel.PersistToMajority,
        })
        assert.isObject(res)
        assert.isOk(res.cas)
        assert.deepStrictEqual(res.value, 13)

        var gres = await collFn().get(testKeyBin)
        assert.deepStrictEqual(gres.value, 13)
      })
    })

    describe('#append', function () {
      it('should append successfuly w/ server durability', async function () {
        var res = await collFn().binary().append(testKeyBin, 'world', {
          durabilityLevel: DurabilityLevel.PersistToMajority,
        })
        assert.isObject(res)
        assert.isOk(res.cas)

        var gres = await collFn().get(testKeyBin)
        assert.isTrue(Buffer.isBuffer(gres.value))
        assert.deepStrictEqual(gres.value.toString(), '13world')
      })
    })

    describe('#prepend', function () {
      it('should prepend successfuly w/ server durability', async function () {
        var res = await collFn().binary().prepend(testKeyBin, 'hello', {
          durabilityLevel: DurabilityLevel.PersistToMajority,
        })
        assert.isObject(res)
        assert.isOk(res.cas)

        var gres = await collFn().get(testKeyBin)
        assert.isTrue(Buffer.isBuffer(gres.value))
        assert.deepStrictEqual(gres.value.toString(), 'hello13world')
      })
    })
  })

  describe('binary client durability', function () {
    let testKeyBin
    let numReplicas

    before(async function () {
      testKeyBin = H.genTestKey()

      await collFn().insert(testKeyBin, 14)

      H.skipIfMissingFeature(this, H.Features.BucketManagement)
      var bmgr = H.c.buckets()
      var res = await bmgr.getBucket(H.b.name)
      numReplicas = res.numReplicas
    })

    after(async function () {
      await collFn().remove(testKeyBin)
    })

    describe('#increment', function () {
      it('should increment successfully w/ client durability', async function () {
        var res = await collFn().binary().increment(testKeyBin, 3, {
          durabilityPersistTo: 1,
          durabilityReplicateTo: numReplicas,
        })
        assert.isObject(res)
        assert.isOk(res.cas)
        assert.deepStrictEqual(res.value, 17)

        var gres = await collFn().get(testKeyBin)
        assert.deepStrictEqual(gres.value, 17)
      })
    })

    describe('#decrement', function () {
      it('should decrement successfully w/ client durability', async function () {
        var res = await collFn().binary().decrement(testKeyBin, 4, {
          durabilityPersistTo: 1,
          durabilityReplicateTo: numReplicas,
        })
        assert.isObject(res)
        assert.isOk(res.cas)
        assert.deepStrictEqual(res.value, 13)

        var gres = await collFn().get(testKeyBin)
        assert.deepStrictEqual(gres.value, 13)
      })
    })

    describe('#append', function () {
      it('should append successfuly w/ client durability', async function () {
        var res = await collFn().binary().append(testKeyBin, 'world', {
          durabilityPersistTo: 1,
          durabilityReplicateTo: numReplicas,
        })
        assert.isObject(res)
        assert.isOk(res.cas)

        var gres = await collFn().get(testKeyBin)
        assert.isTrue(Buffer.isBuffer(gres.value))
        assert.deepStrictEqual(gres.value.toString(), '13world')
      })
    })

    describe('#prepend', function () {
      it('should prepend successfuly w/ client durability', async function () {
        var res = await collFn().binary().prepend(testKeyBin, 'hello', {
          durabilityPersistTo: 1,
          durabilityReplicateTo: numReplicas,
        })
        assert.isObject(res)
        assert.isOk(res.cas)

        var gres = await collFn().get(testKeyBin)
        assert.isTrue(Buffer.isBuffer(gres.value))
        assert.deepStrictEqual(gres.value.toString(), 'hello13world')
      })
    })
  })

  describe('#locks', function () {
    let testKeyLck

    before(async function () {
      testKeyLck = H.genTestKey()

      await collFn().insert(testKeyLck, { foo: 14 })
    })

    after(async function () {
      await collFn().remove(testKeyLck)
    })

    it('should lock successfully (slow)', async function () {
      // Try and lock the key
      var res = await collFn().getAndLock(testKeyLck, 2)
      assert.isObject(res)
      assert.isOk(res.cas)
      assert.deepStrictEqual(res.value, { foo: 14 })
      var prevCas = res.cas

      // Ensure we can upsert with the cas
      await collFn().replace(testKeyLck, { foo: 9 }, { cas: prevCas })

      // Lock it again
      await collFn().getAndLock(testKeyLck, 3)

      // Make sure its actually locked
      const stime = new Date().getTime()
      try {
        await collFn().upsert(testKeyLck, { foo: 9 }, { timeout: 5000 })
      } catch (e) {
        // this is fine in some cases
      }
      const etime = new Date().getTime()
      assert.isAbove(etime - stime, 1000)
    }).timeout(15000)

    it('should unlock successfully', async function () {
      // Lock the key for testing
      var res = await collFn().getAndLock(testKeyLck, 1)
      var prevCas = res.cas

      // Manually unlock the key
      await collFn().unlock(testKeyLck, prevCas)

      // Make sure our get works now
      await collFn().upsert(testKeyLck, { foo: 14 })
    })
  })

  describe('subdoc', function () {
    let testKeySd

    before(async function () {
      testKeySd = H.genTestKey()

      await collFn().insert(testKeySd, {
        foo: 14,
        bar: 2,
        baz: 'hello',
        arr: [1, 2, 3],
      })
    })

    after(async function () {
      await collFn().remove(testKeySd)
    })

    it('should lookupIn successfully', async function () {
      var res = await collFn().lookupIn(testKeySd, [
        H.lib.LookupInSpec.get('baz'),
        H.lib.LookupInSpec.get('bar'),
        H.lib.LookupInSpec.exists('not-exists'),
      ])
      assert.isObject(res)
      assert.isOk(res.cas)
      assert.isArray(res.content)
      assert.strictEqual(res.content.length, 3)
      assert.isNotOk(res.content[0].error)
      assert.deepStrictEqual(res.content[0].value, 'hello')
      assert.isNotOk(res.content[1].error)
      assert.deepStrictEqual(res.content[1].value, 2)
      assert.isNotOk(res.content[2].error)
      assert.deepStrictEqual(res.content[2].value, false)

      // BUG JSCBC-730: Check to make sure that the results property
      // returns the same as the content property.
      assert.strictEqual(res.results, res.content)
    })

    it('should doc-not-found for missing lookupIn', async function () {
      await H.throwsHelper(async () => {
        await collFn().lookupIn('some-document-which-does-not-exist', [
          H.lib.LookupInSpec.get('baz'),
        ])
      }, H.lib.DocumentNotFoundError)
    })

    it('should mutateIn successfully', async function () {
      var res = await collFn().mutateIn(testKeySd, [
        H.lib.MutateInSpec.increment('bar', 3),
        H.lib.MutateInSpec.upsert('baz', 'world'),
        H.lib.MutateInSpec.arrayAppend('arr', 4),
        H.lib.MutateInSpec.arrayAppend('arr', [5, 6], { multi: true }),
      ])
      assert.isObject(res)
      assert.isOk(res.cas)

      assert.isUndefined(res.content[0].error)
      assert.strictEqual(res.content[0].value, 5)

      var gres = await collFn().get(testKeySd)
      assert.isOk(gres.value)
      assert.strictEqual(gres.value.bar, 5)
      assert.strictEqual(gres.value.baz, 'world')
      assert.deepStrictEqual(gres.value.arr, [1, 2, 3, 4, 5, 6])
    })

    it('should cas mismatch when mutatein with wrong cas', async function () {
      var getRes = await collFn().get(testKeySd)

      await collFn().replace(testKeySd, { bar: 1 })

      await H.throwsHelper(async () => {
        await collFn().mutateIn(
          testKeySd,
          [H.lib.MutateInSpec.increment('bar', 3)],
          {
            cas: getRes.cas,
          }
        )
      }, H.lib.CasMismatchError)
    })
  })

  describe('subdoc server durability', function () {
    let testKeySd

    before(async function () {
      testKeySd = H.genTestKey()
      await collFn().insert(testKeySd, {
        foo: 14,
        bar: 2,
        baz: 'hello',
        arr: [1, 2, 3],
      })
      H.skipIfMissingFeature(this, H.Features.ServerDurability)
    })

    after(async function () {
      await collFn().remove(testKeySd)
    })

    it('should mutateIn successfully w/ server durability', async function () {
      var res = await collFn().mutateIn(
        testKeySd,
        [
          H.lib.MutateInSpec.increment('bar', 3),
          H.lib.MutateInSpec.upsert('baz', 'world'),
          H.lib.MutateInSpec.arrayAppend('arr', 4),
          H.lib.MutateInSpec.arrayAppend('arr', [5, 6], { multi: true }),
        ],
        { durabilityLevel: DurabilityLevel.PersistToMajority }
      )
      assert.isObject(res)
      assert.isOk(res.cas)

      assert.isUndefined(res.content[0].error)
      assert.strictEqual(res.content[0].value, 5)

      var gres = await collFn().get(testKeySd)
      assert.isOk(gres.value)
      assert.strictEqual(gres.value.bar, 5)
      assert.strictEqual(gres.value.baz, 'world')
      assert.deepStrictEqual(gres.value.arr, [1, 2, 3, 4, 5, 6])
    })
  })

  describe('subdoc clientDurability', function () {
    let testKeySd
    let numReplicas

    before(async function () {
      testKeySd = H.genTestKey()
      await collFn().insert(testKeySd, {
        foo: 14,
        bar: 2,
        baz: 'hello',
        arr: [1, 2, 3],
      })
      H.skipIfMissingFeature(this, H.Features.BucketManagement)
      var bmgr = H.c.buckets()
      var res = await bmgr.getBucket(H.b.name)
      numReplicas = res.numReplicas
    })

    after(async function () {
      await collFn().remove(testKeySd)
    })

    it('should mutateIn successfully w/ client durability', async function () {
      var res = await collFn().mutateIn(
        testKeySd,
        [
          H.lib.MutateInSpec.increment('bar', 3),
          H.lib.MutateInSpec.upsert('baz', 'world'),
          H.lib.MutateInSpec.arrayAppend('arr', 4),
          H.lib.MutateInSpec.arrayAppend('arr', [5, 6], { multi: true }),
        ],
        { durabilityPersistTo: 1, durabilityReplicateTo: numReplicas }
      )
      assert.isObject(res)
      assert.isOk(res.cas)

      assert.isUndefined(res.content[0].error)
      assert.strictEqual(res.content[0].value, 5)

      var gres = await collFn().get(testKeySd)
      assert.isOk(gres.value)
      assert.strictEqual(gres.value.bar, 5)
      assert.strictEqual(gres.value.baz, 'world')
      assert.deepStrictEqual(gres.value.arr, [1, 2, 3, 4, 5, 6])
    })
  })
}

describe('#crud', function () {
  /* eslint-disable-next-line mocha/no-setup-in-describe */
  genericTests(() => H.dco)
})

describe('#collections-crud', function () {
  /* eslint-disable-next-line mocha/no-hooks-for-single-case */
  before(function () {
    H.skipIfMissingFeature(this, H.Features.Collections)
  })

  /* eslint-disable-next-line mocha/no-setup-in-describe */
  genericTests(() => H.co)
})
