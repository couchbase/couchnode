'use strict'

const assert = require('chai').assert
const H = require('./harness')

const errorTranscoder = {
  encode: () => {
    throw new Error('encode error')
  },
  decode: () => {
    throw new Error('decode error')
  },
}

function genericTests(collFn) {
  describe('#basic', () => {
    const testKeyA = H.genTestKey()

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
    }

    describe('#upsert', () => {
      it('should perform basic upserts', async () => {
        var res = await collFn().upsert(testKeyA, testObjVal)
        assert.isObject(res)
        assert.isNotEmpty(res.cas)
      })

      it('should not crash on transcoder errors', async () => {
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
    })

    describe('#get', () => {
      it('should perform basic gets', async () => {
        var res = await collFn().get(testKeyA)
        assert.isObject(res)
        assert.isNotEmpty(res.cas)
        assert.deepStrictEqual(res.value, testObjVal)

        // BUG JSCBC-784: Check to make sure that the value property
        // returns the same as the content property.
        assert.strictEqual(res.value, res.content)
      })

      it('should not crash on transcoder errors', async () => {
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

      it('should perform basic gets with callback', (callback) => {
        collFn().get(testKeyA, (err, res) => {
          assert.isObject(res)
          assert.isNotEmpty(res.cas)
          assert.deepStrictEqual(res.value, testObjVal)
          callback(err)
        })
      })

      it('should perform errored gets with callback', (callback) => {
        collFn().get('invalid-key', (err, res) => {
          res
          assert.isOk(err)
          callback(null)
        })
      })

      it('should perform projected gets', async () => {
        var res = await collFn().get(testKeyA, {
          project: ['baz'],
        })
        assert.isObject(res)
        assert.isNotEmpty(res.cas)
        assert.deepStrictEqual(res.content, { baz: 19 })

        // BUG JSCBC-784: Check to make sure that the value property
        // returns the same as the content property.
        assert.strictEqual(res.value, res.content)
      })

      H.requireFeature(H.Features.Xattr, () => {
        it('should fall back to full get projection', async () => {
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
          assert.isNotEmpty(res.cas)
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
    })

    describe('#exists', () => {
      H.requireFeature(H.Features.GetMeta, () => {
        it('should successfully perform exists -> true', async () => {
          var res = await collFn().exists(testKeyA)

          assert.isObject(res)
          assert.isNotEmpty(res.cas)
          assert.deepStrictEqual(res.exists, true)
        })

        it('should successfully perform exists -> false', async () => {
          var res = await collFn().exists('a-missing-key')
          assert.isObject(res)
          assert.isNotEmpty(res.cas)
          assert.deepStrictEqual(res.exists, false)
        })
      })
    })

    H.requireFeature(H.Features.Replicas, () => {
      describe('#getAllReplicas', () => {
        it('should perform basic get all replicas', async () => {
          var res = await collFn().getAllReplicas(testKeyA)

          assert.isArray(res)
          assert.isAtLeast(res.length, 1)
          assert.isBoolean(res[0].isReplica)
          assert.isNotEmpty(res[0].cas)
          assert.deepStrictEqual(res[0].content, testObjVal)

          // BUG JSCBC-784: Check to make sure that the value property
          // returns the same as the content property.
          assert.strictEqual(res[0].value, res[0].content)
        })
      })

      describe('#getAnyReplica', () => {
        it('should perform basic get any replica', async () => {
          var res = await collFn().getAnyReplica(testKeyA)

          assert.isObject(res)
          assert.isNotEmpty(res.cas)
          assert.deepStrictEqual(res.content, testObjVal)

          // BUG JSCBC-784: Check to make sure that the value property
          // returns the same as the content property.
          assert.strictEqual(res.value, res.content)
        })
      })
    })

    describe('#replace', () => {
      it('should replace data correctly', async () => {
        var res = await collFn().replace(testKeyA, { foo: 'baz' })
        assert.isObject(res)
        assert.isNotEmpty(res.cas)

        var gres = await collFn().get(testKeyA)
        assert.deepStrictEqual(gres.value, { foo: 'baz' })
      })
    })

    describe('#remove', () => {
      it('should perform basic removes', async () => {
        var res = await collFn().remove(testKeyA)
        assert.isObject(res)
        assert.isNotEmpty(res.cas)
      })
    })

    describe('#insert', () => {
      const testKeyIns = H.genTestKey()

      it('should perform inserts correctly', async () => {
        var res = await collFn().insert(testKeyIns, { foo: 'bar' })
        assert.isObject(res)
        assert.isNotEmpty(res.cas)
      })

      it('should fail to insert a second time', async () => {
        await H.throwsHelper(async () => {
          await collFn().insert(testKeyIns, { foo: 'bar' })
        })
      })

      it('should remove the insert test key', async () => {
        await collFn().remove(testKeyIns)
      })

      it('should insert w/ expiry successfully', async () => {
        const testKeyExp = H.genTestKey()

        var res = await collFn().insert(testKeyExp, { foo: 14 }, { expiry: 1 })
        assert.isObject(res)
        assert.isNotEmpty(res.cas)

        await H.sleep(2000)

        await H.throwsHelper(async () => {
          await collFn().get(testKeyExp)
        })
      }).timeout(4000)
    })

    describe('#touch', () => {
      it('should touch a document successfully', async () => {
        const testKeyTch = H.genTestKey()

        // Insert a test document
        var res = await collFn().insert(testKeyTch, { foo: 14 }, { expiry: 2 })
        assert.isObject(res)
        assert.isNotEmpty(res.cas)

        // Ensure the key is there
        await collFn().get(testKeyTch)

        // Touch the document
        var tres = await collFn().touch(testKeyTch, 4)
        assert.isObject(tres)
        assert.isNotEmpty(tres.cas)

        // Wait for the first expiry
        await H.sleep(3000)

        // Ensure the key is still there
        await collFn().get(testKeyTch)

        // Wait for it to expire
        await H.sleep(2000)

        // Ensure the key is gone
        await H.throwsHelper(async () => {
          await collFn().get(testKeyTch)
        })
      }).timeout(6500)
    })

    describe('#getAndTouch', () => {
      it('should touch a document successfully', async () => {
        const testKeyGat = H.genTestKey()

        // Insert a test document
        var res = await collFn().insert(testKeyGat, { foo: 14 }, { expiry: 2 })
        assert.isObject(res)
        assert.isNotEmpty(res.cas)

        // Ensure the key is there
        await collFn().get(testKeyGat)

        // Touch the document
        var tres = await collFn().getAndTouch(testKeyGat, 4)
        assert.isObject(tres)
        assert.isNotEmpty(tres.cas)
        assert.deepStrictEqual(tres.value, { foo: 14 })

        // BUG JSCBC-784: Check to make sure that the value property
        // returns the same as the content property.
        assert.strictEqual(tres.value, tres.content)

        // Wait for the first expiry
        await H.sleep(3000)

        // Ensure the key is still there
        await collFn().get(testKeyGat)

        // Wait for it to expire
        await H.sleep(2000)

        // Ensure the key is gone
        await H.throwsHelper(async () => {
          await collFn().get(testKeyGat)
        })
      }).timeout(6500)
    })
  })

  describe('#binary', () => {
    var testKeyBin = H.genTestKey()
    var testKeyBinVal = H.genTestKey()

    before(async () => {
      await collFn().insert(testKeyBin, 14)
    })

    after(async () => {
      await collFn().remove(testKeyBin)
    })

    describe('#increment', () => {
      it('should increment successfully', async () => {
        var res = await collFn().binary().increment(testKeyBin, 3)
        assert.isObject(res)
        assert.isNotEmpty(res.cas)
        assert.deepStrictEqual(res.value, 17)

        var gres = await collFn().get(testKeyBin)
        assert.deepStrictEqual(gres.value, 17)
      })
    })

    describe('#decrement', () => {
      it('should decrement successfully', async () => {
        var res = await collFn().binary().decrement(testKeyBin, 4)
        assert.isObject(res)
        assert.isNotEmpty(res.cas)
        assert.deepStrictEqual(res.value, 13)

        var gres = await collFn().get(testKeyBin)
        assert.deepStrictEqual(gres.value, 13)
      })
    })

    describe('#append', () => {
      it('should append successfuly', async () => {
        var res = await collFn().binary().append(testKeyBin, 'world')
        assert.isObject(res)
        assert.isNotEmpty(res.cas)

        var gres = await collFn().get(testKeyBin)
        assert.isTrue(Buffer.isBuffer(gres.value))
        assert.deepStrictEqual(gres.value.toString(), '13world')
      })
    })

    describe('#prepend', () => {
      it('should prepend successfuly', async () => {
        var res = await collFn().binary().prepend(testKeyBin, 'hello')
        assert.isObject(res)
        assert.isNotEmpty(res.cas)

        var gres = await collFn().get(testKeyBin)
        assert.isTrue(Buffer.isBuffer(gres.value))
        assert.deepStrictEqual(gres.value.toString(), 'hello13world')
      })
    })

    describe('#upsert', () => {
      it('should upsert successfully', async () => {
        const valueBytes = Buffer.from(
          '092bc691fb824300a6871ceddf7090d7092bc691fb824300a6871ceddf7090d7',
          'hex'
        )

        var res = await collFn().upsert(testKeyBinVal, valueBytes)
        assert.isObject(res)
        assert.isNotEmpty(res.cas)

        var gres = await collFn().get(testKeyBinVal)
        assert.isTrue(Buffer.isBuffer(gres.value))
        assert.deepStrictEqual(gres.value, valueBytes)
      })
    })
  })

  describe('#locks', () => {
    const testKeyLck = H.genTestKey()

    before(async () => {
      await collFn().insert(testKeyLck, { foo: 14 })
    })

    after(async () => {
      await collFn().remove(testKeyLck)
    })

    it('should lock successfully', async () => {
      // Try and lock the key
      var res = await collFn().getAndLock(testKeyLck, 2)
      assert.isObject(res)
      assert.isNotEmpty(res.cas)
      assert.deepStrictEqual(res.value, { foo: 14 })
      var prevCas = res.cas

      // Make sure its actually locked
      await H.throwsHelper(async () => {
        await collFn().upsert(testKeyLck, { foo: 9 }, { timeout: 1000 })
      })

      // Ensure we can upsert with the cas
      await collFn().replace(testKeyLck, { foo: 9 }, { cas: prevCas })
    })

    it('should unlock successfully', async () => {
      // Lock the key for testing
      var res = await collFn().getAndLock(testKeyLck, 1)
      var prevCas = res.cas

      // Manually unlock the key
      var ures = await collFn().unlock(testKeyLck, prevCas)
      assert.isObject(ures)
      assert.isNotEmpty(ures.cas)

      // Make sure our get works now
      await collFn().upsert(testKeyLck, { foo: 14 })
    })
  })

  describe('subdoc', () => {
    const testKeySd = H.genTestKey()

    before(async () => {
      await collFn().insert(testKeySd, {
        foo: 14,
        bar: 2,
        baz: 'hello',
        arr: [1, 2, 3],
      })
    })

    after(async () => {
      await collFn().remove(testKeySd)
    })

    it('should lookupIn successfully', async () => {
      var res = await collFn().lookupIn(testKeySd, [
        H.lib.LookupInSpec.get('baz'),
        H.lib.LookupInSpec.get('bar'),
        H.lib.LookupInSpec.exists('not-exists'),
      ])
      assert.isObject(res)
      assert.isNotEmpty(res.cas)
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

    it('should mutateIn successfully', async () => {
      var res = await collFn().mutateIn(testKeySd, [
        H.lib.MutateInSpec.increment('bar', 3),
        H.lib.MutateInSpec.upsert('baz', 'world'),
        H.lib.MutateInSpec.arrayAppend('arr', 4),
        H.lib.MutateInSpec.arrayAppend('arr', [5, 6], { multi: true }),
      ])
      assert.isObject(res)
      assert.isNotEmpty(res.cas)

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

describe('#crud', () => {
  genericTests(() => H.dco)
})

describe('#collections-crud', () => {
  H.requireFeature(H.Features.Collections, () => {
    genericTests(() => H.co)
  })
})
