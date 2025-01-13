'use strict'

const assert = require('chai').assert
const { DurabilityLevel, ReadPreference } = require('../lib/generaltypes')
const { DefaultTranscoder } = require('../lib/transcoders')
const { SdUtils } = require('../lib/sdutils')
const H = require('./harness')
const testdata = require('./testdata')
const {
  GetReplicaResult,
  LookupInReplicaResult,
} = require('../lib/crudoptypes')

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

function validateMutationToken(token) {
  const mut_token = token.toJSON()
  assert.isString(mut_token.partition_uuid)
  assert.isString(mut_token.sequence_number)
  assert.isNumber(mut_token.partition_id)
  assert.isString(mut_token.bucket_name)
}

function genericTests(collFn) {
  describe('#kvops', function () {
    let testKeyA
    let testKeyUtf8
    let testKeyBin
    let otherTestKeys = []

    before(function () {
      testKeyA = H.genTestKey()
      testKeyUtf8 = H.genTestKey()
      testKeyBin = H.genTestKey()
    })

    after(async function () {
      try {
        await collFn().remove(testKeyA)
      } catch (e) {
        // ingore
      }
      try {
        await collFn().remove(testKeyUtf8)
      } catch (e) {
        // ignore
      }
      try {
        await collFn().remove(testKeyBin)
      } catch (e) {
        // ignore
      }
      for (const key of otherTestKeys) {
        try {
          await collFn().remove(key)
        } catch (e) {
          // ignore
        }
      }
    })

    describe('#upsert', function () {
      it('should perform basic upserts', async function () {
        var res = await collFn().upsert(testKeyA, testObjVal)
        assert.isObject(res)
        assert.isOk(res.cas)
        validateMutationToken(res.token)
      })

      it('should perform basic upserts with callback', function (done) {
        collFn().upsert(testKeyA, testObjVal, (err, res) => {
          if (err) {
            return done(err)
          }
          try {
            assert.isObject(res)
            assert.isOk(res.cas)
            validateMutationToken(res.token)
            done(err)
          } catch (e) {
            done(e)
          }
        })
      })

      it('should upsert successfully using options and callback', function (done) {
        const testKeyOpts = H.genTestKey()
        otherTestKeys.push(testKeyOpts)

        const validate = () => {
          collFn().get(testKeyOpts, (err, res) => {
            try {
              assert.isNull(res)
              assert.isOk(err)
              done(null)
            } catch (e) {
              done(e)
            }
          })
        }

        // Upsert a test document
        collFn().upsert(testKeyOpts, { foo: 14 }, { expiry: 1 }, (err, res) => {
          if (err) {
            return done(err)
          }
          try {
            assert.isObject(res)
            assert.isNull(err)
            setTimeout(validate, 2000)
          } catch (e) {
            done(e)
          }
        })
      }).timeout(3500)

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
        otherTestKeys.push(testKeyPe)

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

    /* eslint-disable mocha/no-setup-in-describe */
    describe('#expiry', function () {
      let testKeyExp
      const fiftyYears = 50 * 365 * 24 * 60 * 60
      const thirtyDays = 30 * 24 * 60 * 60
      const expiryList = [
        fiftyYears + 1,
        fiftyYears,
        thirtyDays - 1,
        thirtyDays,
        Math.floor(Date.now() / 1000) - 1,
        60,
      ]

      before(async function () {
        H.skipIfMissingFeature(this, H.Features.Xattr)
        testKeyExp = H.genTestKey()
      })

      after(async function () {
        try {
          await collFn().remove(testKeyExp)
        } catch (e) {
          // ignore
        }
      })

      it('correctly handles negative expiry', async function () {
        await H.throwsHelper(async () => {
          await collFn().upsert(testKeyExp, { foo: 'bar' }, { expiry: -1 })
        }, H.lib.InvalidArgumentError)
      })

      expiryList.forEach((expiry) => {
        it(`correctly executes upsert w/ expiry=${expiry}`, async function () {
          const before = Math.floor(Date.now() / 1000) - 1
          const res = await collFn().upsert(
            testKeyExp,
            { foo: 'bar' },
            { expiry: expiry }
          )
          assert.isObject(res.cas)
          const expiryRes = (
            await collFn().lookupIn(testKeyExp, [
              H.lib.LookupInSpec.get(H.lib.LookupInMacro.Expiry, {
                xattr: true,
              }),
            ])
          ).content[0].value
          const after = Math.floor(Date.now() / 1000) + 1
          assert.isTrue(before + expiry <= expiryRes <= expiry + after)
        })
      })
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

      it('should perform basic gets with callback', function (done) {
        collFn().get(testKeyA, (err, res) => {
          if (err) {
            return done(err)
          }
          try {
            assert.isObject(res)
            assert.isOk(res.cas)
            assert.deepStrictEqual(res.value, testObjVal)
            done(null)
          } catch (e) {
            done(e)
          }
        })
      })

      it('should perform errored gets with callback', function (done) {
        collFn().get('invalid-key', (err, res) => {
          try {
            assert.isNull(res)
            assert.isOk(err)
            done(null)
          } catch (e) {
            done(e)
          }
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

      it('should perform projected gets with callback', function (done) {
        collFn().get(testKeyA, { project: ['baz'] }, (err, res) => {
          if (err) {
            done(err)
          }
          try {
            assert.isObject(res)
            assert.isOk(res.cas)
            assert.deepStrictEqual(res.content, { baz: 19 })
            done(null)
          } catch (e) {
            done(e)
          }
        })
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

      it('should perform basic exists with callback', function (done) {
        collFn().exists(testKeyA, (err, res) => {
          if (err) {
            return done(err)
          }
          try {
            assert.isObject(res)
            assert.strictEqual(res.exists, true)
            done(null)
          } catch (e) {
            done(e)
          }
        })
      })

      it('should perform basic exists with options and callback', function (done) {
        collFn().exists(testKeyA, { timeout: 2000 }, (err, res) => {
          if (err) {
            return done(err)
          }
          try {
            assert.isObject(res)
            assert.strictEqual(res.exists, true)
            done(null)
          } catch (e) {
            done(e)
          }
        })
      })

      it('should perform errored exists with callback', function (done) {
        collFn().get('a-missing-key', (err, res) => {
          try {
            assert.isNull(res)
            assert.isOk(err)
            done(null)
          } catch (e) {
            done(e)
          }
        })
      })
    })

    describe('#replace', function () {
      it('should replace data correctly', async function () {
        var res = await collFn().replace(testKeyA, { foo: 'baz' })
        assert.isObject(res)
        assert.isOk(res.cas)
        validateMutationToken(res.token)

        var gres = await collFn().get(testKeyA)
        assert.deepStrictEqual(gres.value, { foo: 'baz' })
      })

      it('should perform replace with callback', function (done) {
        collFn().replace(testKeyA, { foo: 'qux' }, (err, res) => {
          if (err) {
            return done(err)
          }
          try {
            assert.isObject(res)
            assert.isOk(res.cas)
            assert.isNull(err)
            validateMutationToken(res.token)
            collFn().get(testKeyA, (err, res) => {
              if (err) {
                return done(err)
              }
              try {
                assert.deepStrictEqual(res.value, { foo: 'qux' })
                done(null)
              } catch (e) {
                done(e)
              }
            })
          } catch (e) {
            done(e)
          }
        })
      })

      it('should perform replace with options and callback', function (done) {
        const tc = new DefaultTranscoder()
        collFn().replace(
          testKeyA,
          { foo: 'qux' },
          { transcoder: tc },
          (err, res) => {
            if (err) {
              return done(err)
            }
            try {
              assert.isObject(res)
              assert.isOk(res.cas)
              assert.isNull(err)
              validateMutationToken(res.token)
              collFn().get(testKeyA, (err, res) => {
                if (err) {
                  return done(err)
                }
                try {
                  assert.deepStrictEqual(res.value, { foo: 'qux' })
                  done(null)
                } catch (e) {
                  done(e)
                }
              })
            } catch (e) {
              done(e)
            }
          }
        )
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
        validateMutationToken(res.token)
      })

      it('should perform basic remove with options and callback', function (done) {
        collFn().remove(testKeyA, { timeout: 2000 }, (err, res) => {
          try {
            assert.isNull(res)
            assert.isOk(err)
            assert.isTrue(err instanceof H.lib.DocumentNotFoundError)
            done(null)
          } catch (e) {
            done(e)
          }
        })
      })
    })

    describe('#insert', function () {
      let testKeyIns

      before(function () {
        testKeyIns = H.genTestKey()
      })

      after(async function () {
        try {
          await collFn().remove(testKeyIns)
        } catch (e) {
          // ignore
        }
      })

      it('should perform inserts correctly', async function () {
        var res = await collFn().insert(testKeyIns, { foo: 'bar' })
        assert.isObject(res)
        assert.isOk(res.cas)
        validateMutationToken(res.token)
      })

      it('should fail to insert a second time', async function () {
        await H.throwsHelper(async () => {
          await collFn().insert(testKeyIns, { foo: 'bar' })
        })
      })

      it('should remove the insert test key', async function () {
        await collFn().remove(testKeyIns)
      })

      it('should perform inserts with callback', function (done) {
        collFn().insert(testKeyIns, { foo: 'bar' }, (err, res) => {
          if (err) {
            return done(err)
          }
          try {
            assert.isObject(res)
            assert.isOk(res.cas)
            validateMutationToken(res.token)
            done(null)
          } catch (e) {
            done(e)
          }
        })
      })

      it('should insert successfully using options and callback', function (done) {
        const testKeyOpts = H.genTestKey()
        otherTestKeys.push(testKeyOpts)

        const validate = () => {
          collFn().get(testKeyOpts, (err, res) => {
            try {
              assert.isNull(res)
              assert.isOk(err)
              done(null)
            } catch (e) {
              done(e)
            }
          })
        }

        collFn().insert(testKeyOpts, { foo: 14 }, { expiry: 1 }, (err, res) => {
          if (err) {
            return done(err)
          }
          try {
            assert.isObject(res)
            assert.isNull(err)
            setTimeout(validate, 2000)
          } catch (e) {
            done(e)
          }
        })
      }).timeout(3500)

      it('should fail to insert a second time with callback', function (done) {
        collFn().insert(testKeyIns, { foo: 'bar' }, (err, res) => {
          try {
            assert.isOk(err)
            assert.isNull(res)
            done(null)
          } catch (e) {
            done(e)
          }
        })
      })

      it('should remove the insert test key with callback', function (done) {
        collFn().remove(testKeyIns, (err, res) => {
          if (err) {
            return done(err)
          }
          try {
            assert.isOk(res.cas)
            done(null)
          } catch (e) {
            done(e)
          }
        })
      })

      it('should insert w/ expiry successfully (slow)', async function () {
        const testKeyExp = H.genTestKey()
        otherTestKeys.push(testKeyExp)

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

      after(async function () {
        try {
          await collFn().remove(testKeyIns)
        } catch (e) {
          // ignore
        }
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

      after(async function () {
        try {
          await collFn().remove(testKeyIns)
        } catch (e) {
          // ignore
        }
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
        otherTestKeys.push(testKeyTch)

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
        otherTestKeys.push(testKeyGat)

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

  describe('#replicas', function () {
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
        // ignore
      }
    })

    it('should perform basic get all replicas', async function () {
      let res = await H.tryNTimes(
        5,
        1000,
        collFn().getAllReplicas.bind(collFn()),
        replicaTestKey
      )

      assert.isArray(res)
      assert.isAtLeast(res.length, 1)
      assert.instanceOf(res[0], GetReplicaResult)
      assert.isBoolean(res[0].isReplica)
      assert.isNotEmpty(res[0].cas)
      assert.deepStrictEqual(res[0].content, testObjVal)
    }).timeout(7500)

    it('should perform basic get all replicas with callback', function (done) {
      H.tryNTimesWithCallback(
        5,
        1000,
        collFn().getAllReplicas.bind(collFn()),
        replicaTestKey,
        (err, res) => {
          if (err) {
            return done(err)
          }
          try {
            assert.isArray(res)
            assert.isAtLeast(res.length, 1)
            assert.instanceOf(res[0], GetReplicaResult)
            assert.isBoolean(res[0].isReplica)
            assert.isNotEmpty(res[0].cas)
            assert.deepStrictEqual(res[0].content, testObjVal)
            done(null)
          } catch (e) {
            done(e)
          }
        }
      )
    }).timeout(7500)

    it('should perform basic get all replicas with options and callback', function (done) {
      const tc = new DefaultTranscoder()
      H.tryNTimesWithCallback(
        5,
        1000,
        collFn().getAllReplicas.bind(collFn()),
        replicaTestKey,
        { transcoder: tc },
        (err, res) => {
          if (err) {
            return done(err)
          }
          try {
            assert.isArray(res)
            assert.isAtLeast(res.length, 1)
            assert.instanceOf(res[0], GetReplicaResult)
            assert.isBoolean(res[0].isReplica)
            assert.isNotEmpty(res[0].cas)
            assert.deepStrictEqual(res[0].content, testObjVal)
            done(null)
          } catch (e) {
            done(e)
          }
        }
      )
    }).timeout(7500)

    it('should perform basic get any replica', async function () {
      var res = await collFn().getAnyReplica(replicaTestKey)

      assert.instanceOf(res, GetReplicaResult)
      assert.isNotEmpty(res.cas)
      assert.deepStrictEqual(res.content, testObjVal)
    })

    it('should perform basic get any replica with callback', function (done) {
      collFn().getAnyReplica(replicaTestKey, (err, res) => {
        if (err) {
          return done(err)
        }
        try {
          assert.instanceOf(res, GetReplicaResult)
          assert.isNotEmpty(res.cas)
          assert.deepStrictEqual(res.content, testObjVal)
          done(null)
        } catch (e) {
          done(e)
        }
      })
    })

    it('should perform basic get any replica with options and callback', function (done) {
      const tc = new DefaultTranscoder()
      collFn().getAnyReplica(replicaTestKey, { transcoder: tc }, (err, res) => {
        if (err) {
          return done(err)
        }
        try {
          assert.instanceOf(res, GetReplicaResult)
          assert.isNotEmpty(res.cas)
          assert.deepStrictEqual(res.content, testObjVal)
          done(null)
        } catch (e) {
          done(e)
        }
      })
    })

    describe('#server-groups', function () {
      before(function () {
        H.skipIfMissingFeature(this, H.Features.ServerGroupts)
      })

      it('should raise DocumentUnretrievableError for getAnyReplica', async function () {
        // the cluster setup does not set a preferred server group, so executing getAnyReplica
        // with a ReadPreference should fail.
        await H.throwsHelper(async () => {
          await collFn().getAnyReplica(replicaTestKey, {
            readPreference: ReadPreference.SelectedServerGroup,
          })
        })
      })

      it('should raise DocumentUnretrievableError for getAllReplicas', async function () {
        // the cluster setup does not set a preferred server group, so executing getAnyReplica
        // with a ReadPreference should fail.
        await H.throwsHelper(async () => {
          await collFn().getAllReplicas(replicaTestKey, {
            readPreference: ReadPreference.SelectedServerGroup,
          })
        })
      })
    })
  })

  describe('#binary', function () {
    let testKeyBin

    before(async function () {
      testKeyBin = H.genTestKey()

      await collFn().insert(testKeyBin, 14)
    })

    after(async function () {
      try {
        await collFn().remove(testKeyBin)
      } catch (e) {
        // ignore
      }
    })

    describe('#increment', function () {
      it('should increment successfully', async function () {
        var res = await collFn().binary().increment(testKeyBin, 3)
        assert.isObject(res)
        assert.isOk(res.cas)
        assert.deepStrictEqual(res.value, 17)
        validateMutationToken(res.token)

        var gres = await collFn().get(testKeyBin)
        assert.deepStrictEqual(gres.value, 17)
      })

      it('should increment successfully with callback', function (done) {
        collFn()
          .binary()
          .increment(testKeyBin, 3, (err, res) => {
            if (err) {
              return done(err)
            }
            try {
              assert.isObject(res)
              assert.isOk(res.cas)
              assert.deepStrictEqual(res.value, 20)
              validateMutationToken(res.token)
              collFn().get(testKeyBin, (err, res) => {
                if (err) {
                  return done(err)
                }
                try {
                  assert.deepStrictEqual(res.value, 20)
                  done(null)
                } catch (e) {
                  done(e)
                }
              })
            } catch (e) {
              done(e)
            }
          })
      })

      it('should increment successfully with options and callback', function (done) {
        collFn()
          .binary()
          .increment(testKeyBin, 3, { timeout: 2000 }, (err, res) => {
            if (err) {
              return done(err)
            }
            try {
              assert.isObject(res)
              assert.isOk(res.cas)
              assert.deepStrictEqual(res.value, 23)
              validateMutationToken(res.token)
              collFn().get(testKeyBin, (err, res) => {
                if (err) {
                  return done(err)
                }
                try {
                  assert.deepStrictEqual(res.value, 23)
                  done(null)
                } catch (e) {
                  done(e)
                }
              })
            } catch (e) {
              done(e)
            }
          })
      })
    })

    describe('#decrement', function () {
      it('should decrement successfully', async function () {
        var res = await collFn().binary().decrement(testKeyBin, 4)
        assert.isObject(res)
        assert.isOk(res.cas)
        assert.deepStrictEqual(res.value, 19)
        validateMutationToken(res.token)

        var gres = await collFn().get(testKeyBin)
        assert.deepStrictEqual(gres.value, 19)
      })

      it('should decrement successfully with callback', function (done) {
        collFn()
          .binary()
          .decrement(testKeyBin, 3, (err, res) => {
            if (err) {
              return done(err)
            }
            try {
              assert.isObject(res)
              assert.isOk(res.cas)
              assert.deepStrictEqual(res.value, 16)
              validateMutationToken(res.token)
              collFn().get(testKeyBin, (err, res) => {
                if (err) {
                  return done(err)
                }
                try {
                  assert.deepStrictEqual(res.value, 16)
                  done(null)
                } catch (e) {
                  done(e)
                }
              })
            } catch (e) {
              done(e)
            }
          })
      })

      it('should decrement successfully with options and callback', function (done) {
        collFn()
          .binary()
          .decrement(testKeyBin, 3, { timeout: 2000 }, (err, res) => {
            if (err) {
              return done(err)
            }
            try {
              assert.isObject(res)
              assert.isOk(res.cas)
              assert.deepStrictEqual(res.value, 13)
              validateMutationToken(res.token)
              collFn().get(testKeyBin, (err, res) => {
                if (err) {
                  return done(err)
                }
                try {
                  assert.deepStrictEqual(res.value, 13)
                  done(null)
                } catch (e) {
                  done(e)
                }
              })
            } catch (e) {
              done(e)
            }
          })
      })
    })

    describe('#append', function () {
      it('should append successfully', async function () {
        var res = await collFn().binary().append(testKeyBin, 'world')
        assert.isObject(res)
        assert.isOk(res.cas)
        validateMutationToken(res.token)

        var gres = await collFn().get(testKeyBin)
        assert.isTrue(Buffer.isBuffer(gres.value))
        assert.deepStrictEqual(gres.value.toString(), '13world')
      })

      it('should append successfully with callback', function (done) {
        collFn()
          .binary()
          .append(testKeyBin, '!', (err, res) => {
            if (err) {
              return done(err)
            }
            try {
              assert.isObject(res)
              assert.isOk(res.cas)
              assert.isNull(err)
              validateMutationToken(res.token)
              collFn().get(testKeyBin, (err, gres) => {
                if (err) {
                  return done(err)
                }
                try {
                  assert.isTrue(Buffer.isBuffer(gres.value))
                  assert.deepStrictEqual(gres.value.toString(), '13world!')
                  done(null)
                } catch (e) {
                  done(e)
                }
              })
            } catch (e) {
              done(e)
            }
          })
      })

      it('should append successfully with options and callback', function (done) {
        collFn()
          .binary()
          .append(testKeyBin, '!', (err, res) => {
            if (err) {
              return done(err)
            }
            try {
              assert.isObject(res)
              assert.isOk(res.cas)
              assert.isNull(err)
              validateMutationToken(res.token)
              collFn().get(testKeyBin, (err, gres) => {
                if (err) {
                  return done(err)
                }
                try {
                  assert.isTrue(Buffer.isBuffer(gres.value))
                  assert.deepStrictEqual(gres.value.toString(), '13world!!')
                  done(null)
                } catch (e) {
                  done(e)
                }
              })
            } catch (e) {
              done(e)
            }
          })
      })
    })

    describe('#prepend', function () {
      it('should prepend successfully', async function () {
        var res = await collFn().binary().prepend(testKeyBin, 'big')
        assert.isObject(res)
        assert.isOk(res.cas)
        validateMutationToken(res.token)

        var gres = await collFn().get(testKeyBin)
        assert.isTrue(Buffer.isBuffer(gres.value))
        assert.deepStrictEqual(gres.value.toString(), 'big13world!!')
      })

      it('should prepend successfully with callback', function (done) {
        collFn()
          .binary()
          .prepend(testKeyBin, 'hello', (err, res) => {
            if (err) {
              return done(err)
            }
            try {
              assert.isObject(res)
              assert.isOk(res.cas)
              assert.isNull(err)
              validateMutationToken(res.token)
              collFn().get(testKeyBin, (err, gres) => {
                if (err) {
                  return done(err)
                }
                try {
                  assert.isTrue(Buffer.isBuffer(gres.value))
                  assert.deepStrictEqual(
                    gres.value.toString(),
                    'hellobig13world!!'
                  )
                  done(null)
                } catch (e) {
                  done(e)
                }
              })
            } catch (e) {
              done(e)
            }
          })
      })

      it('should prepend successfully with options and callback', function (done) {
        collFn()
          .binary()
          .prepend(testKeyBin, 'the', { timeout: 2000 }, (err, res) => {
            if (err) {
              return done(err)
            }
            try {
              assert.isObject(res)
              assert.isOk(res.cas)
              assert.isNull(err)
              validateMutationToken(res.token)
              collFn().get(testKeyBin, (err, gres) => {
                if (err) {
                  return done(err)
                }
                try {
                  assert.isTrue(Buffer.isBuffer(gres.value))
                  assert.deepStrictEqual(
                    gres.value.toString(),
                    'thehellobig13world!!'
                  )
                  done(null)
                } catch (e) {
                  done(e)
                }
              })
            } catch (e) {
              done(e)
            }
          })
      })
    })

    describe('#serverDurability', function () {
      let testKeyBinDurability

      before(async function () {
        H.skipIfMissingFeature(this, H.Features.ServerDurability)
        testKeyBinDurability = H.genTestKey()
        await collFn().insert(testKeyBinDurability, 14)
      })

      after(async function () {
        try {
          await collFn().remove(testKeyBinDurability)
        } catch (e) {
          // ignore
        }
      })

      it('should increment successfully w/ server durability', async function () {
        var res = await collFn().binary().increment(testKeyBinDurability, 3, {
          durabilityLevel: DurabilityLevel.PersistToMajority,
        })
        assert.isObject(res)
        assert.isOk(res.cas)
        assert.deepStrictEqual(res.value, 17)

        var gres = await collFn().get(testKeyBinDurability)
        assert.deepStrictEqual(gres.value, 17)
      })

      it('should decrement successfully w/ server durability', async function () {
        var res = await collFn().binary().decrement(testKeyBinDurability, 4, {
          durabilityLevel: DurabilityLevel.PersistToMajority,
        })
        assert.isObject(res)
        assert.isOk(res.cas)
        assert.deepStrictEqual(res.value, 13)

        var gres = await collFn().get(testKeyBinDurability)
        assert.deepStrictEqual(gres.value, 13)
      })

      it('should append successfuly w/ server durability', async function () {
        var res = await collFn()
          .binary()
          .append(testKeyBinDurability, 'world', {
            durabilityLevel: DurabilityLevel.PersistToMajority,
          })
        assert.isObject(res)
        assert.isOk(res.cas)

        var gres = await collFn().get(testKeyBinDurability)
        assert.isTrue(Buffer.isBuffer(gres.value))
        assert.deepStrictEqual(gres.value.toString(), '13world')
      })

      it('should prepend successfuly w/ server durability', async function () {
        var res = await collFn()
          .binary()
          .prepend(testKeyBinDurability, 'hello', {
            durabilityLevel: DurabilityLevel.PersistToMajority,
          })
        assert.isObject(res)
        assert.isOk(res.cas)

        var gres = await collFn().get(testKeyBinDurability)
        assert.isTrue(Buffer.isBuffer(gres.value))
        assert.deepStrictEqual(gres.value.toString(), 'hello13world')
      })
    })

    describe('#clientDurability', function () {
      let testKeyBinDurability
      let numReplicas

      before(async function () {
        testKeyBinDurability = H.genTestKey()

        await collFn().insert(testKeyBinDurability, 14)

        H.skipIfMissingFeature(this, H.Features.BucketManagement)
        var bmgr = H.c.buckets()
        var res = await bmgr.getBucket(H.b.name)
        numReplicas = res.numReplicas
      })

      after(async function () {
        try {
          await collFn().remove(testKeyBinDurability)
        } catch (e) {
          // ignore
        }
      })

      it('should increment successfully w/ client durability', async function () {
        var res = await collFn().binary().increment(testKeyBinDurability, 3, {
          durabilityPersistTo: 1,
          durabilityReplicateTo: numReplicas,
        })
        assert.isObject(res)
        assert.isOk(res.cas)
        assert.deepStrictEqual(res.value, 17)

        var gres = await collFn().get(testKeyBinDurability)
        assert.deepStrictEqual(gres.value, 17)
      })

      it('should decrement successfully w/ client durability', async function () {
        var res = await collFn().binary().decrement(testKeyBinDurability, 4, {
          durabilityPersistTo: 1,
          durabilityReplicateTo: numReplicas,
        })
        assert.isObject(res)
        assert.isOk(res.cas)
        assert.deepStrictEqual(res.value, 13)

        var gres = await collFn().get(testKeyBinDurability)
        assert.deepStrictEqual(gres.value, 13)
      })

      it('should append successfuly w/ client durability', async function () {
        var res = await collFn()
          .binary()
          .append(testKeyBinDurability, 'world', {
            durabilityPersistTo: 1,
            durabilityReplicateTo: numReplicas,
          })
        assert.isObject(res)
        assert.isOk(res.cas)

        var gres = await collFn().get(testKeyBinDurability)
        assert.isTrue(Buffer.isBuffer(gres.value))
        assert.deepStrictEqual(gres.value.toString(), '13world')
      })

      it('should prepend successfuly w/ client durability', async function () {
        var res = await collFn()
          .binary()
          .prepend(testKeyBinDurability, 'hello', {
            durabilityPersistTo: 1,
            durabilityReplicateTo: numReplicas,
          })
        assert.isObject(res)
        assert.isOk(res.cas)

        var gres = await collFn().get(testKeyBinDurability)
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
      try {
        await collFn().remove(testKeyLck)
      } catch (e) {
        // ignore
      }
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

    it('should unlock successfully w/ default CAS', async function () {
      // Lock the key for testing
      var res = await collFn().getAndLock(testKeyLck, 1)
      var prevCas = res.cas

      // Manually unlock the key
      await collFn().unlock(testKeyLck, prevCas)

      // Make sure our get works now
      await collFn().upsert(testKeyLck, { foo: 14 })
    })

    it('should unlock successfully w/ CAS as string', async function () {
      // Lock the key for testing
      var res = await collFn().getAndLock(testKeyLck, 1)
      var prevCas = res.cas.toString()

      // Manually unlock the key
      await collFn().unlock(testKeyLck, prevCas)

      // Make sure our get works now
      await collFn().upsert(testKeyLck, { foo: 15 })
    })

    it('should unlock successfully w/ CAS as buffer', async function () {
      // Lock the key for testing
      var res = await collFn().getAndLock(testKeyLck, 1)
      let casInt = BigInt(res.cas.toString())
      const casBuff = Buffer.allocUnsafe(8)
      casBuff.writeBigUInt64LE(casInt)

      // Manually unlock the key
      await collFn().unlock(testKeyLck, casBuff)

      // Make sure our get works now
      await collFn().upsert(testKeyLck, { foo: 16 })
    })

    it('should unlock successfully w/ CAS as object w/ raw buffer', async function () {
      // Lock the key for testing
      var res = await collFn().getAndLock(testKeyLck, 1)
      let casInt = BigInt(res.cas.toString())
      const casObj = { raw: Buffer.allocUnsafe(8) }
      casObj.raw.writeBigUInt64LE(casInt)

      // Manually unlock the key
      await collFn().unlock(testKeyLck, casObj)

      // Make sure our get works now
      await collFn().upsert(testKeyLck, { foo: 17 })
    })

    it('should raise DocumentNotLockedError on unlock if document not locked', async function () {
      H.skipIfMissingFeature(this, H.Features.NotLockedKVStatus)
      // Lock the key for testing
      var res = await collFn().getAndLock(testKeyLck, 1)
      var prevCas = res.cas

      // Manually unlock the key
      await collFn().unlock(testKeyLck, prevCas)

      // Make sure we get the expected error
      await H.throwsHelper(async () => {
        await collFn().unlock(testKeyLck, prevCas)
      }, H.lib.DocumentNotLockedError)
    })
  })

  describe('#subdoc', function () {
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
      try {
        await collFn().remove(testKeySd)
      } catch (e) {
        // ignore
      }
    })

    describe('#lookupIn', function () {
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

      it('should lookupIn with accessDeleted successfully', async function () {
        H.skipIfMissingFeature(this, H.Features.Xattr)

        const testKeyDeleted = H.genTestKey()
        var upsertRes = await collFn().upsert(testKeyDeleted, testObjVal)
        assert.isOk(upsertRes.cas)

        var removeRes = await collFn().remove(testKeyDeleted)
        assert.isOk(removeRes.cas)

        var res = await collFn().lookupIn(
          testKeyDeleted,
          [H.lib.LookupInSpec.exists('$document.revid', { xattr: true })],
          {
            accessDeleted: true,
          }
        )

        assert.isNull(res.content[0].error)
        assert.strictEqual(res.content[0].value, true)
      })

      describe('#macros', function () {
        const macros = [
          H.lib.LookupInMacro.Cas,
          H.lib.LookupInMacro.Document,
          H.lib.LookupInMacro.Expiry,
          H.lib.LookupInMacro.IsDeleted,
          H.lib.LookupInMacro.LastModified,
          H.lib.LookupInMacro.RevId,
          H.lib.LookupInMacro.SeqNo,
          H.lib.LookupInMacro.ValueSizeBytes,
        ]

        before(function () {
          H.skipIfMissingFeature(this, H.Features.Xattr)
        })

        macros.forEach((macro) => {
          it(`correctly executes ${macro._value} lookup-in macro`, async function () {
            const res = await collFn().lookupIn(testKeySd, [
              H.lib.LookupInSpec.get(macro, { xattr: true }),
            ])
            const documentRes = (
              await collFn().lookupIn(testKeySd, [
                H.lib.LookupInSpec.get(H.lib.LookupInMacro.Document, {
                  xattr: true,
                }),
              ])
            ).content[0].value
            const macroKey = macro._value.replace('$document.', '')
            const macroRes = res.content[0].value

            if (macroKey === '$document') {
              assert.deepStrictEqual(macroRes, documentRes)
            } else {
              assert.strictEqual(macroRes, documentRes[macroKey])
              if (
                ['CAS', 'seqno', 'vbucket_uuid', 'value_crc32c'].includes(
                  macroKey
                )
              ) {
                assert.isTrue(macroRes.startsWith('0x'))
              }
            }
          })
        })
      })
    })

    describe('#mutateIn', function () {
      it('should mutateIn successfully', async function () {
        var res = await collFn().mutateIn(testKeySd, [
          H.lib.MutateInSpec.increment('bar', 3),
          H.lib.MutateInSpec.decrement('bar', 2),
          H.lib.MutateInSpec.upsert('baz', 'world'),
          H.lib.MutateInSpec.arrayAppend('arr', 4),
          H.lib.MutateInSpec.arrayAppend('arr', [5, 6], { multi: true }),
        ])
        assert.isObject(res)
        assert.isOk(res.cas)
        validateMutationToken(res.token)

        assert.isUndefined(res.content[0].error)
        assert.strictEqual(res.content[0].value, 5)
        assert.isUndefined(res.content[1].error)
        assert.strictEqual(res.content[1].value, 3)

        var gres = await collFn().get(testKeySd)
        assert.isOk(gres.value)
        assert.strictEqual(gres.value.bar, 3)
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

      describe('#macros', function () {
        let testUid
        let testDocs
        let docIdx
        const xattrPath = 'xattr-macro'

        const macros = [
          H.lib.MutateInMacro.Cas,
          H.lib.MutateInMacro.SeqNo,
          H.lib.MutateInMacro.ValueCrc32c,
        ]

        before(async function () {
          H.skipIfMissingFeature(this, H.Features.Xattr)
          this.timeout(5000)
          docIdx = 0
          testUid = H.genTestKey()
          await H.tryNTimes(3, 1000, async () => {
            try {
              const result = await testdata.upsertData(collFn(), testUid, 1)
              if (!result.every((r) => r.status === 'fulfilled')) {
                throw new Error('Failed to upsert all test data')
              }
              testDocs = result.map((r) => r.value)
            } catch (err) {
              await testdata.removeTestData(collFn(), testDocs)
              throw err
            }
          })
        })

        after(async function () {
          try {
            await testdata.removeTestData(collFn(), testDocs)
          } catch (e) {
            // ignore
          }
        })

        it('correctly executes arrayaddunique mutate-in macros', async function () {
          const testKey = testDocs[docIdx++]
          // BUG JSCBC-1235: Server raises invalid argument when using
          // mutate-in macro w/ arrayaddunique.  Update test if associated MB
          // is addressed in the future.
          await H.throwsHelper(async () => {
            await collFn().mutateIn(testKey, [
              H.lib.MutateInSpec.upsert(xattrPath, [], { xattr: true }),
              H.lib.MutateInSpec.arrayAddUnique(
                xattrPath,
                H.lib.MutateInMacro.Cas
              ),
              H.lib.MutateInSpec.arrayAddUnique(
                xattrPath,
                H.lib.MutateInMacro.SeqNo
              ),
              H.lib.MutateInSpec.arrayAddUnique(
                xattrPath,
                H.lib.MutateInMacro.ValueCrc32c
              ),
            ])
          }, H.lib.InvalidArgumentError)
        })

        it('correctly executes arrayappend mutate-in macros', async function () {
          const testKey = testDocs[docIdx++]
          const mutateInRes = await collFn().mutateIn(testKey, [
            H.lib.MutateInSpec.arrayAppend(xattrPath, H.lib.MutateInMacro.Cas, {
              createPath: true,
            }),
            H.lib.MutateInSpec.arrayAppend(
              xattrPath,
              H.lib.MutateInMacro.SeqNo
            ),
            H.lib.MutateInSpec.arrayAppend(
              xattrPath,
              H.lib.MutateInMacro.ValueCrc32c
            ),
          ])
          const res = (
            await collFn().lookupIn(testKey, [
              H.lib.LookupInSpec.get(xattrPath, { xattr: true }),
            ])
          ).content[0].value
          assert.equal(
            BigInt(SdUtils.convertMacroCasToCas(res[0])),
            BigInt(mutateInRes.cas.toString())
          )
          assert.isString(res[0])
          assert.isString(res[1])
          assert.isString(res[2])
          assert.isTrue(res[0].startsWith('0x'))
          assert.isTrue(res[1].startsWith('0x'))
          assert.isTrue(res[2].startsWith('0x'))
        })

        it('correctly executes arrayinsert mutate-in macros', async function () {
          const testKey = testDocs[docIdx++]
          const mutateInRes = await collFn().mutateIn(testKey, [
            H.lib.MutateInSpec.upsert(xattrPath, [], { xattr: true }),
            H.lib.MutateInSpec.arrayAppend(xattrPath, H.lib.MutateInMacro.Cas, {
              createPath: true,
            }),
            H.lib.MutateInSpec.arrayAppend(
              xattrPath,
              H.lib.MutateInMacro.SeqNo
            ),
            H.lib.MutateInSpec.arrayAppend(
              xattrPath,
              H.lib.MutateInMacro.ValueCrc32c
            ),
          ])
          const res = (
            await collFn().lookupIn(testKey, [
              H.lib.LookupInSpec.get(xattrPath, { xattr: true }),
            ])
          ).content[0].value
          assert.equal(
            BigInt(SdUtils.convertMacroCasToCas(res[0])),
            BigInt(mutateInRes.cas.toString())
          )
          assert.isString(res[0])
          assert.isString(res[1])
          assert.isString(res[2])
          assert.isTrue(res[0].startsWith('0x'))
          assert.isTrue(res[1].startsWith('0x'))
          assert.isTrue(res[2].startsWith('0x'))
        })

        it('correctly executes arrayprepend mutate-in macros', async function () {
          const testKey = testDocs[docIdx++]
          const mutateInRes = await collFn().mutateIn(testKey, [
            H.lib.MutateInSpec.arrayPrepend(
              xattrPath,
              H.lib.MutateInMacro.Cas,
              {
                createPath: true,
              }
            ),
            H.lib.MutateInSpec.arrayPrepend(
              xattrPath,
              H.lib.MutateInMacro.SeqNo
            ),
            H.lib.MutateInSpec.arrayPrepend(
              xattrPath,
              H.lib.MutateInMacro.ValueCrc32c
            ),
          ])
          const res = (
            await collFn().lookupIn(testKey, [
              H.lib.LookupInSpec.get(xattrPath, { xattr: true }),
            ])
          ).content[0].value
          assert.equal(
            BigInt(SdUtils.convertMacroCasToCas(res[2])),
            BigInt(mutateInRes.cas.toString())
          )
          assert.isString(res[0])
          assert.isString(res[1])
          assert.isString(res[2])
          assert.isTrue(res[0].startsWith('0x'))
          assert.isTrue(res[1].startsWith('0x'))
          assert.isTrue(res[2].startsWith('0x'))
        })

        macros.forEach((macro) => {
          it(`correctly executes ${macro._value} mutate-in macro`, async function () {
            const testKey = testDocs[docIdx++]
            let mutateInRes = await collFn().mutateIn(testKey, [
              H.lib.MutateInSpec.insert(xattrPath, macro),
            ])
            let res = (
              await collFn().lookupIn(testKey, [
                H.lib.LookupInSpec.get(xattrPath, { xattr: true }),
              ])
            ).content[0].value

            assert.isString(res)
            assert.isTrue(res.startsWith('0x'))
            if (macro._value.includes('CAS')) {
              assert.equal(
                BigInt(SdUtils.convertMacroCasToCas(res)),
                BigInt(mutateInRes.cas.toString())
              )
            }

            mutateInRes = await collFn().mutateIn(testKey, [
              H.lib.MutateInSpec.upsert(xattrPath, macro),
            ])
            res = (
              await collFn().lookupIn(testKey, [
                H.lib.LookupInSpec.get(xattrPath, { xattr: true }),
              ])
            ).content[0].value

            assert.isString(res)
            assert.isTrue(res.startsWith('0x'))
            if (macro._value.includes('CAS')) {
              assert.equal(
                BigInt(SdUtils.convertMacroCasToCas(res)),
                BigInt(mutateInRes.cas.toString())
              )
            }

            mutateInRes = await collFn().mutateIn(testKey, [
              H.lib.MutateInSpec.replace(xattrPath, macro),
            ])
            res = (
              await collFn().lookupIn(testKey, [
                H.lib.LookupInSpec.get(xattrPath, { xattr: true }),
              ])
            ).content[0].value

            assert.isString(res)
            assert.isTrue(res.startsWith('0x'))
            if (macro._value.includes('CAS')) {
              assert.equal(
                BigInt(SdUtils.convertMacroCasToCas(res)),
                BigInt(mutateInRes.cas.toString())
              )
            }
          })
        })
      })
    })

    describe('#replicas', function () {
      let testKeySdRep

      before(async function () {
        H.skipIfMissingFeature(this, H.Features.SubdocReadReplica)
        H.skipIfMissingFeature(this, H.Features.Replicas)
        testKeySdRep = H.genTestKey()
        await collFn().insert(
          testKeySdRep,
          {
            foo: 14,
            bar: 2,
            baz: 'hello',
            arr: [1, 2, 3],
          },
          {
            durabilityLevel: DurabilityLevel.MajorityAndPersistOnMaster,
          }
        )
      })

      after(async function () {
        try {
          await collFn().remove(testKeySdRep)
        } catch (e) {
          // ignore
        }
      })

      it('should lookupInAnyReplica successfully', async function () {
        var res = await collFn().lookupInAnyReplica(testKeySdRep, [
          H.lib.LookupInSpec.get('baz'),
          H.lib.LookupInSpec.get('bar'),
          H.lib.LookupInSpec.exists('not-exists'),
        ])
        assert.instanceOf(res, LookupInReplicaResult)
        assert.isOk(res.cas)
        assert.isBoolean(res.isReplica)
        assert.isArray(res.content)
        assert.strictEqual(res.content.length, 3)
        assert.isNotOk(res.content[0].error)
        assert.deepStrictEqual(res.content[0].value, 'hello')
        assert.isNotOk(res.content[1].error)
        assert.deepStrictEqual(res.content[1].value, 2)
        assert.isNotOk(res.content[2].error)
        assert.deepStrictEqual(res.content[2].value, false)
      })

      it('should lookupInAllReplicas successfully', async function () {
        var res = await collFn().lookupInAllReplicas(testKeySdRep, [
          H.lib.LookupInSpec.get('baz'),
          H.lib.LookupInSpec.get('bar'),
          H.lib.LookupInSpec.exists('not-exists'),
        ])
        assert.isArray(res)
        let activeCount = 0
        res.forEach((replica) => {
          if (!replica.isReplica) {
            activeCount++
          }
          assert.instanceOf(replica, LookupInReplicaResult)
          assert.isOk(replica.cas)
          assert.isArray(replica.content)
          assert.strictEqual(replica.content.length, 3)
          assert.isNotOk(replica.content[0].error)
          assert.deepStrictEqual(replica.content[0].value, 'hello')
          assert.isNotOk(replica.content[1].error)
          assert.deepStrictEqual(replica.content[1].value, 2)
          assert.isNotOk(replica.content[2].error)
          assert.deepStrictEqual(replica.content[2].value, false)
        })
        assert.strictEqual(activeCount, 1)
      })

      it('should stream lookupInAllReplicas correctly', async function () {
        const streamLookupInReplica = (id, specs) => {
          return new Promise((resolve, reject) => {
            let resultsOut = []
            collFn()
              .lookupInAllReplicas(id, specs)
              .on('replica', (res) => {
                resultsOut.push(res)
              })
              .on('end', () => {
                resolve({
                  results: resultsOut,
                })
              })
              .on('error', (err) => {
                reject(err)
              })
          })
        }
        const specs = [
          H.lib.LookupInSpec.get('baz'),
          H.lib.LookupInSpec.get('bar'),
          H.lib.LookupInSpec.exists('not-exists'),
        ]
        const res = await streamLookupInReplica(testKeySdRep, specs)
        assert.isArray(res.results)
        let activeCount = 0
        res.results.forEach((replica) => {
          if (!replica.isReplica) {
            activeCount++
          }
          assert.instanceOf(replica, LookupInReplicaResult)
          assert.isOk(replica.cas)
          assert.isArray(replica.content)
          assert.strictEqual(replica.content.length, 3)
          assert.isNotOk(replica.content[0].error)
          assert.deepStrictEqual(replica.content[0].value, 'hello')
          assert.isNotOk(replica.content[1].error)
          assert.deepStrictEqual(replica.content[1].value, 2)
          assert.isNotOk(replica.content[2].error)
          assert.deepStrictEqual(replica.content[2].value, false)
        })
        assert.strictEqual(activeCount, 1)
      })

      it('should successfully run lookupInAllReplicas with a callback', function (done) {
        collFn().lookupInAllReplicas(
          testKeySdRep,
          [H.lib.LookupInSpec.get('baz')],
          (err, res) => {
            if (err) {
              return done(err)
            }
            try {
              assert.isAtLeast(res.length, 1)
              assert.instanceOf(res[0], LookupInReplicaResult)
              assert.isBoolean(res[0].isReplica)
              assert.isNotEmpty(res[0].cas)
              assert.deepStrictEqual(res[0].content[0].value, 'hello')
              done(null)
            } catch (e) {
              done(e)
            }
          }
        )
      })

      it('should successfully run lookupInAnyReplica with a callback', function (done) {
        collFn().lookupInAnyReplica(
          testKeySdRep,
          [H.lib.LookupInSpec.get('baz')],
          (err, res) => {
            if (err) {
              return done(err)
            }
            try {
              assert.instanceOf(res, LookupInReplicaResult)
              assert.isNotEmpty(res.cas)
              assert.isBoolean(res.isReplica)
              assert.deepStrictEqual(res.content[0].value, 'hello')
              done(null)
            } catch (e) {
              done(e)
            }
          }
        )
      })

      it('should doc-not-found for missing doc lookupInAllReplicas', async function () {
        await H.throwsHelper(async () => {
          await collFn().lookupInAllReplicas(
            'some-document-which-does-not-exist',
            [H.lib.LookupInSpec.get('baz')]
          )
        }, H.lib.DocumentNotFoundError)
      })

      it('should doc-irretrievable for missing doc lookupInAnyReplica', async function () {
        await H.throwsHelper(async () => {
          await collFn().lookupInAnyReplica(
            'some-document-which-does-not-exist',
            [H.lib.LookupInSpec.get('baz')]
          )
        }, H.lib.DocumentUnretrievableError)
      })

      describe('#server-groups', function () {
        before(function () {
          H.skipIfMissingFeature(this, H.Features.ServerGroupts)
        })

        it('should raise DocumentUnretrievableError for lookupInAnyReplica', async function () {
          // the cluster setup does not set a preferred server group, so executing lookupInAnyReplica
          // with a ReadPreference should fail.
          await H.throwsHelper(async () => {
            await collFn().lookupInAnyReplica(
              testKeySdRep,
              [
                H.lib.LookupInSpec.get('baz'),
                H.lib.LookupInSpec.get('bar'),
                H.lib.LookupInSpec.exists('not-exists'),
              ],
              { readPreference: ReadPreference.SelectedServerGroup }
            )
          })
        })

        it('should raise DocumentUnretrievableError for lookupInAllReplicas', async function () {
          // the cluster setup does not set a preferred server group, so executing lookupInAllReplicas
          // with a ReadPreference should fail.
          await H.throwsHelper(async () => {
            await collFn().lookupInAllReplicas(
              testKeySdRep,
              [
                H.lib.LookupInSpec.get('baz'),
                H.lib.LookupInSpec.get('bar'),
                H.lib.LookupInSpec.exists('not-exists'),
              ],
              { readPreference: ReadPreference.SelectedServerGroup }
            )
          })
        })
      })
    })

    describe('#serverDurability', function () {
      let testKeySdDurability

      before(async function () {
        H.skipIfMissingFeature(this, H.Features.ServerDurability)
        testKeySdDurability = H.genTestKey()
        await collFn().insert(testKeySdDurability, {
          foo: 14,
          bar: 2,
          baz: 'hello',
          arr: [1, 2, 3],
        })
      })

      after(async function () {
        try {
          await collFn().remove(testKeySdDurability)
        } catch (e) {
          // ignore
        }
      })

      it('should mutateIn successfully w/ server durability', async function () {
        var res = await collFn().mutateIn(
          testKeySdDurability,
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
        validateMutationToken(res.token)

        assert.isUndefined(res.content[0].error)
        assert.strictEqual(res.content[0].value, 5)

        var gres = await collFn().get(testKeySdDurability)
        assert.isOk(gres.value)
        assert.strictEqual(gres.value.bar, 5)
        assert.strictEqual(gres.value.baz, 'world')
        assert.deepStrictEqual(gres.value.arr, [1, 2, 3, 4, 5, 6])
      })
    })

    describe('#clientDurability', function () {
      let testKeySdDurability
      let numReplicas

      before(async function () {
        testKeySdDurability = H.genTestKey()
        await collFn().insert(testKeySdDurability, {
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
        try {
          await collFn().remove(testKeySdDurability)
        } catch (e) {
          // ignore
        }
      })

      it('should mutateIn successfully w/ client durability', async function () {
        var res = await collFn().mutateIn(
          testKeySdDurability,
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
        validateMutationToken(res.token)

        assert.isUndefined(res.content[0].error)
        assert.strictEqual(res.content[0].value, 5)

        var gres = await collFn().get(testKeySdDurability)
        assert.isOk(gres.value)
        assert.strictEqual(gres.value.bar, 5)
        assert.strictEqual(gres.value.baz, 'world')
        assert.deepStrictEqual(gres.value.arr, [1, 2, 3, 4, 5, 6])
      })
    })
  })

  describe('#CAS', function () {
    // NOTE: CppCas(binding)/Cas(Node.js) is represented by Record<'raw', Buffer>
    it('should allow default CAS', async function () {
      const testKey = H.genTestKey()
      const upRes = await collFn().upsert(testKey, {
        id: testKey,
        foo: 'bar',
        type: 'upsert',
      })
      assert.isObject(upRes)
      assert.isOk(upRes.cas)

      const repRes = await collFn().replace(
        testKey,
        { id: testKey, foo: 'baz', type: 'replace' },
        { cas: upRes.cas }
      )
      assert.isObject(repRes)
      assert.isOk(repRes.cas)
      assert.notEqual(upRes.cas.toString(), repRes.cas.toString())

      const mutRes = await collFn().mutateIn(
        testKey,
        [H.lib.MutateInSpec.replace('type', 'mutate-in')],
        { cas: repRes.cas }
      )
      assert.isObject(mutRes)
      assert.isOk(mutRes.cas)
      assert.notEqual(repRes.cas.toString(), mutRes.cas.toString())

      const remRes = await collFn().remove(testKey, { cas: mutRes.cas })
      assert.isObject(remRes)
      assert.isOk(remRes.cas)
      assert.notEqual(mutRes.cas.toString(), remRes.cas.toString())
    }).timeout(3500)

    it('should allow CAS as string', async function () {
      const testKey = H.genTestKey()
      const upRes = await collFn().upsert(testKey, {
        id: testKey,
        foo: 'bar',
        type: 'upsert',
      })
      assert.isObject(upRes)
      assert.isOk(upRes.cas)

      const repRes = await collFn().replace(
        testKey,
        { id: testKey, foo: 'baz', type: 'replace' },
        { cas: upRes.cas.toString() }
      )
      assert.isObject(repRes)
      assert.isOk(repRes.cas)
      assert.notEqual(upRes.cas.toString(), repRes.cas.toString())

      const mutRes = await collFn().mutateIn(
        testKey,
        [H.lib.MutateInSpec.replace('type', 'mutate-in')],
        { cas: repRes.cas.toString() }
      )
      assert.isObject(mutRes)
      assert.isOk(mutRes.cas)
      assert.notEqual(repRes.cas.toString(), mutRes.cas.toString())

      const remRes = await collFn().remove(testKey, {
        cas: mutRes.cas.toString(),
      })
      assert.isObject(remRes)
      assert.isOk(remRes.cas)
      assert.notEqual(mutRes.cas.toString(), remRes.cas.toString())
    }).timeout(3500)

    it('should allow CAS as Buffer', async function () {
      const testKey = H.genTestKey()
      const upRes = await collFn().upsert(testKey, {
        id: testKey,
        foo: 'bar',
        type: 'upsert',
      })
      assert.isObject(upRes)
      assert.isOk(upRes.cas)
      let casInt = BigInt(upRes.cas.toString())
      const casBuff = Buffer.allocUnsafe(8)
      casBuff.writeBigUInt64LE(casInt)

      const repRes = await collFn().replace(
        testKey,
        { id: testKey, foo: 'baz', type: 'replace' },
        { cas: casBuff }
      )
      assert.isObject(repRes)
      assert.isOk(repRes.cas)
      assert.notEqual(upRes.cas.toString(), repRes.cas.toString())
      casInt = BigInt(repRes.cas.toString())
      // reset CAS
      casBuff.fill('\u0222')
      casBuff.writeBigUInt64LE(casInt)

      const mutRes = await collFn().mutateIn(
        testKey,
        [H.lib.MutateInSpec.replace('type', 'mutate-in')],
        { cas: casBuff }
      )
      assert.isObject(mutRes)
      assert.isOk(mutRes.cas)
      assert.notEqual(repRes.cas.toString(), mutRes.cas.toString())
      casInt = BigInt(mutRes.cas.toString())
      // reset CAS
      casBuff.fill('\u0222')
      casBuff.writeBigUInt64LE(casInt)

      const remRes = await collFn().remove(testKey, { cas: casBuff })
      assert.isObject(remRes)
      assert.isOk(remRes.cas)
      assert.notEqual(mutRes.cas.toString(), remRes.cas.toString())
    }).timeout(3500)
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
