'use strict'

const assert = require('chai').assert

const H = require('./harness')

const { RawBinaryTranscoder } = require('../lib/transcoders')

describe('#transactions', function () {
  before(async function () {
    H.skipIfMissingFeature(this, H.Features.Transactions)
  })

  after(async function() {
    this.timeout(10000)
    const bmgr = H.c.buckets()
    await H.tryNTimes(3, 1000, bmgr.flushBucket.bind(bmgr), H.bucketName)
  })

  it('should work with a simple transaction', async function () {
    const testDocIns = H.genTestKey()
    const testDocRep = H.genTestKey()
    const testDocRem = H.genTestKey()

    await H.co.insert(testDocRep, { foo: 'bar' })
    await H.co.insert(testDocRem, { foo: 'bar' })

    await H.c.transactions().run(
      async (attempt) => {
        await attempt.insert(H.co, testDocIns, { foo: 'baz' })

        const repDoc = await attempt.get(H.co, testDocRep)
        await attempt.replace(repDoc, { foo: 'baz' })

        const remDoc = await attempt.get(H.co, testDocRem)
        await attempt.remove(remDoc)

        // check ryow
        var insRes = await attempt.get(H.co, testDocIns)
        assert.deepStrictEqual(insRes.content, { foo: 'baz' })

        var repRes = await attempt.get(H.co, testDocRep)
        assert.deepStrictEqual(repRes.content, { foo: 'baz' })

        await H.throwsHelper(async () => {
          await attempt.get(H.co, testDocRem)
        })
      },
      { timeout: 5000 }
    )

    var insRes = await H.co.get(testDocIns)
    assert.deepStrictEqual(insRes.content, { foo: 'baz' })

    var repRes = await H.co.get(testDocRep)
    assert.deepStrictEqual(repRes.content, { foo: 'baz' })

    await H.throwsHelper(async () => {
      await H.co.get(testDocRem)
    })
  }).timeout(15000)

  it('should work with query', async function () {
    const testKey = H.genTestKey()
    const testDoc1 = testKey + '_1'
    const testDoc2 = testKey + '_2'

    await H.co.insert(testDoc1, { foo: 'bar' })

    await H.c.transactions().run(async (attempt) => {
      const insDoc = await attempt.insert(H.co, testDoc2, { foo: 'baz' })

      const collQualifer = `${H.b.name}.${H.s.name}.${H.co.name}`
      const queryRes = await attempt.query(
        `SELECT foo FROM ${collQualifer} WHERE META().id IN $1 ORDER BY META().id ASC`,
        {
          parameters: [[testDoc1, testDoc2]],
        }
      )
      assert.lengthOf(queryRes.rows, 2)
      assert.deepStrictEqual(queryRes.rows[0], { foo: 'bar' })
      assert.deepStrictEqual(queryRes.rows[1], { foo: 'baz' })

      const getDoc = await attempt.get(H.co, testDoc1)
      await attempt.replace(getDoc, { foo: 'bad' })

      await attempt.replace(insDoc, { foo: 'bag' })
    })

    var gres1 = await H.co.get(testDoc1)
    assert.deepStrictEqual(gres1.content, { foo: 'bad' })

    var gres2 = await H.co.get(testDoc2)
    assert.deepStrictEqual(gres2.content, { foo: 'bag' })
  })

  it('should insert in Query mode', async function () {
    const testKey = H.genTestKey()
    const testDoc1 = testKey + '_1'
    const testDoc2 = testKey + '_2'

    await H.co.insert(testDoc1, { foo: 'bar', queryMode: false })

    await H.c.transactions().run(async (attempt) => {
      const collQualifer = `${H.b.name}.${H.s.name}.${H.co.name}`
      const queryRes = await attempt.query(
        `SELECT foo, queryMode FROM ${collQualifer} WHERE META().id IN $1 ORDER BY META().id ASC`,
        {
          parameters: [[testDoc1]],
        }
      )
      assert.lengthOf(queryRes.rows, 1)
      assert.deepStrictEqual(queryRes.rows[0], { foo: 'bar', queryMode: false })

      await attempt.insert(H.co, testDoc2, { foo: 'baz', queryMode: true })
    })

    var gres = await H.co.get(testDoc2)
    assert.deepStrictEqual(gres.content, { foo: 'baz', queryMode: true })
  })

  it('should remove in Query mode', async function () {
    const testKey = H.genTestKey()
    const testDoc1 = testKey + '_1'
    const testDoc2 = testKey + '_2'

    await H.co.insert(testDoc1, { foo: 'bar', queryMode: false })

    await H.c.transactions().run(async (attempt) => {
      await attempt.insert(H.co, testDoc2, { foo: 'baz', queryMode: true })

      const collQualifer = `${H.b.name}.${H.s.name}.${H.co.name}`
      const queryRes = await attempt.query(
        `SELECT foo, queryMode FROM ${collQualifer} WHERE META().id IN $1 ORDER BY META().id ASC`,
        {
          parameters: [[testDoc1, testDoc2]],
        }
      )
      assert.lengthOf(queryRes.rows, 2)
      assert.deepStrictEqual(queryRes.rows[0], { foo: 'bar', queryMode: false })

      const remDoc = await attempt.get(H.co, testDoc1)
      await attempt.remove(remDoc)
    })

    await H.throwsHelper(async () => {
      await H.co.get(testDoc1)
    }, H.lib.DocumentNotFoundError)
  })

  it('should fail with application errors', async function () {
    const testDocIns = H.genTestKey()
    const testDocRep = H.genTestKey()
    const testDocRem = H.genTestKey()

    await H.co.insert(testDocRep, { foo: 'bar' })
    await H.co.insert(testDocRem, { foo: 'bar' })

    let numAttempts = 0
    try {
      await H.c.transactions().run(async (attempt) => {
        numAttempts++

        await attempt.insert(H.co, testDocIns, { foo: 'baz' })

        const repDoc = await attempt.get(H.co, testDocRep)
        await attempt.replace(repDoc, { foo: 'baz' })

        const remDoc = await attempt.get(H.co, testDocRem)
        await attempt.remove(remDoc)

        throw new Error('application failure')
      })
    } catch (err) {
      assert.instanceOf(err, H.lib.TransactionFailedError)
      assert.equal(err.cause.message, 'application failure')
    }

    assert.equal(numAttempts, 1)

    await H.throwsHelper(async () => {
      await H.co.get(testDocIns)
    })

    var repRes = await H.co.get(testDocRep)
    assert.deepStrictEqual(repRes.content, { foo: 'bar' })

    var remRes = await H.co.get(testDocRep)
    assert.deepStrictEqual(remRes.content, { foo: 'bar' })
  })

  it('should commit with query', async function () {
    const testDocIns = H.genTestKey()
    const testDocRep = H.genTestKey()
    const testDocRem = H.genTestKey()

    await H.co.insert(testDocRep, { foo: 'bar' })
    await H.co.insert(testDocRem, { foo: 'bar' })

    await H.c.transactions().run(async (attempt) => {
      const coPath = `${H.b.name}.${H.s.name}.${H.co.name}`

      await attempt.query(`INSERT INTO ${coPath} VALUES ($1, $2)`, {
        parameters: [testDocIns, { foo: 'baz' }],
      })

      await attempt.query(
        `UPDATE ${coPath} SET foo="baz" WHERE META().id = $1`,
        {
          parameters: [testDocRep],
        }
      )

      await attempt.query(`DELETE FROM ${coPath} WHERE META().id = $1`, {
        parameters: [testDocRem],
      })
    })

    let insRes = await H.co.get(testDocIns)
    assert.deepStrictEqual(insRes.content, { foo: 'baz' })

    let repRes = await H.co.get(testDocRep)
    assert.deepStrictEqual(repRes.content, { foo: 'baz' })

    await H.throwsHelper(async () => {
      await H.co.get(testDocRem)
    })
  })

  it('should rollback after query', async function () {
    const testDocIns = H.genTestKey()
    const testDocRep = H.genTestKey()
    const testDocRem = H.genTestKey()

    await H.co.insert(testDocRep, { foo: 'bar' })
    await H.co.insert(testDocRem, { foo: 'bar' })

    let numAttempts = 0
    try {
      await H.c.transactions().run(async (attempt) => {
        numAttempts++

        const coPath = `${H.b.name}.${H.s.name}.${H.co.name}`

        await attempt.query(`INSERT INTO ${coPath} VALUES ($1, $2)`, {
          parameters: [testDocIns, { foo: 'baz' }],
        })

        await attempt.query(
          `UPDATE ${coPath} SET foo="baz" WHERE META().id = $1`,
          {
            parameters: [testDocRep],
          }
        )

        await attempt.query(`DELETE FROM ${coPath} WHERE META().id = $1`, {
          parameters: [testDocRem],
        })

        throw new Error('application failure')
      })
    } catch (err) {
      assert.instanceOf(err, H.lib.TransactionFailedError)
      assert.equal(err.cause.message, 'application failure')
    }

    assert.equal(numAttempts, 1)

    await H.throwsHelper(async () => {
      await H.co.get(testDocIns)
    })

    var repRes = await H.co.get(testDocRep)
    assert.deepStrictEqual(repRes.content, { foo: 'bar' })

    var remRes = await H.co.get(testDocRep)
    assert.deepStrictEqual(remRes.content, { foo: 'bar' })
  })

  it('should fail to replace with bad CAS', async function () {
    const testDocId = H.genTestKey()

    await H.co.upsert(testDocId, { foo: 'bar' })

    // txn will retry until timeout
    let numAttempts = 0
    try {
      await H.c.transactions().run(
        async (attempt) => {
          numAttempts++
          const remDoc = await attempt.get(H.co, testDocId)
          await attempt.replace(remDoc, { foo: 'baz' })
          // This should fail due to CAS Mismatch
          // Note that atm the cause is set as unknown in the txn lib
          try {
            await attempt.replace(remDoc, { foo: 'qux' })
          } catch (err) {
            assert.instanceOf(err, H.lib.TransactionOperationFailedError)
            assert.equal(err.cause.message, 'unknown')
          }
        },
        { timeout: 2000 }
      )
    } catch (err) {
      assert.instanceOf(err, H.lib.TransactionFailedError)
      assert.equal(err.cause.message, 'unknown')
    }
    assert.isTrue(numAttempts > 1)

    // the txn should fail
    var repRes = await H.co.get(testDocId)
    assert.deepStrictEqual(repRes.content, { foo: 'bar' })
  }).timeout(5000)

  it('should fail to remove with bad CAS', async function () {
    const testDocId = H.genTestKey()

    await H.co.upsert(testDocId, { foo: 'bar' })

    // txn will retry until timeout
    let numAttempts = 0
    try {
      await H.c.transactions().run(
        async (attempt) => {
          numAttempts++
          const remDoc = await attempt.get(H.co, testDocId)
          await attempt.replace(remDoc, { foo: 'baz' })
          // This should fail due to CAS Mismatch
          // Note that atm the cause is set as unknown in the txn lib
          try {
            await attempt.remove(remDoc)
          } catch (err) {
            assert.instanceOf(err, H.lib.TransactionOperationFailedError)
            assert.equal(err.cause.message, 'unknown')
          }
        },
        { timeout: 2000 }
      )
    } catch (err) {
      assert.instanceOf(err, H.lib.TransactionFailedError)
      assert.equal(err.cause.message, 'unknown')
    }
    assert.isTrue(numAttempts > 1)

    // the txn should fail, so doc should exist
    var remRes = await H.co.get(testDocId)
    assert.deepStrictEqual(remRes.content, { foo: 'bar' })
  }).timeout(5000)

  it('should raise DocumentNotFoundError only in lambda', async function () {
    let numAttempts = 0
    await H.throwsHelper(async () => {
      await H.c.transactions().run(
        async (attempt) => {
          numAttempts++
          try {
            await attempt.get(H.co, 'not-a-key')
          } catch (err) {
            assert.instanceOf(err, H.lib.DocumentNotFoundError)
            assert.equal(err.cause, 'document_not_found_exception')
          }

          throw new Error('success')
        },
        { timeout: 2000 }
      )
    }, H.lib.TransactionFailedError)
    assert.equal(numAttempts, 1)

    numAttempts = 0
    try {
      await H.c.transactions().run(
        async (attempt) => {
          numAttempts++
          await attempt.get(H.co, 'not-a-key')
        },
        { timeout: 2000 }
      )
    } catch (err) {
      assert.instanceOf(err, H.lib.TransactionFailedError)
      assert.instanceOf(err.cause, H.lib.DocumentNotFoundError)
      assert.isTrue(err.cause.message.includes('document not found'))
      assert(
        err.context instanceof H.lib.KeyValueErrorContext ||
          typeof err.context === 'undefined'
      )
    }
    assert.equal(numAttempts, 1)
  })

  it('should raise DocumentExistsError only in lambda', async function () {
    const testDocIns = H.genTestKey()

    await H.co.insert(testDocIns, { foo: 'bar' })

    let numAttempts = 0
    await H.throwsHelper(async () => {
      await H.c.transactions().run(
        async (attempt) => {
          numAttempts++

          await H.throwsHelper(async () => {
            await attempt.insert(H.co, testDocIns, { foo: 'baz' })
          }, H.lib.DocumentExistsError)

          throw new Error('success')
        },
        { timeout: 2000 }
      )
    }, H.lib.TransactionFailedError)
    assert.equal(numAttempts, 1)

    numAttempts = 0
    try {
      await H.c.transactions().run(
        async (attempt) => {
          numAttempts++
          await attempt.insert(H.co, testDocIns, { foo: 'baz' })
        },
        { timeout: 2000 }
      )
    } catch (err) {
      assert.instanceOf(err, H.lib.TransactionFailedError)
      assert.instanceOf(err.cause, H.lib.DocumentExistsError)
      assert.isTrue(err.cause.message.includes('document exists'))
      assert(
        err.context instanceof H.lib.KeyValueErrorContext ||
          typeof err.context === 'undefined'
      )
    }
    assert.equal(numAttempts, 1)
  })

  it('should raise ParsingFailureError only in lambda', async function () {
    let numAttempts = 0
    await H.throwsHelper(async () => {
      await H.c.transactions().run(
        async (attempt) => {
          numAttempts++
          await H.throwsHelper(async () => {
            await attempt.query('This is not N1QL')
          }, H.lib.ParsingFailureError)
          throw new Error('success')
        },
        { timeout: 2000 }
      )
    }, H.lib.TransactionFailedError)
    assert.equal(numAttempts, 1)

    numAttempts = 0
    try {
      await H.c.transactions().run(
        async (attempt) => {
          numAttempts++
          await attempt.query('This is not N1QL')
        },
        { timeout: 2000 }
      )
    } catch (err) {
      assert.instanceOf(err, H.lib.TransactionFailedError)
      assert.instanceOf(err.cause, H.lib.ParsingFailureError)
      assert.isTrue(err.cause.message.includes('parsing failure'))
      assert(
        err.context instanceof H.lib.QueryErrorContext ||
          typeof err.context === 'undefined'
      )
    }
    assert.equal(numAttempts, 1)
  })

  it('should raise BucketNotFound if metadata collection bucket does not exist', async function () {
    const { username, password } = H.connOpts
    var cluster = await H.lib.Cluster.connect(H.connStr, {
      username: username,
      password: password,
      transactions: {
        metadataCollection: {
          bucket: 'no-bucket',
          scope: '_default',
          collection: '_default',
        },
      },
    })
    var bucket = cluster.bucket(H.bucketName)
    var coll = bucket.defaultCollection()

    try {
      await cluster.transactions().run(
        async (attempt) => {
          // this doesn't matter as we should raise the BucketNotFoundError when we create the
          // transactions object
          await attempt.get(coll, 'not-a-key')
        },
        { timeout: 2000 }
      )
    } catch (err) {
      assert.instanceOf(err, H.lib.BucketNotFoundError)
    } finally {
      await cluster.close()
    }
  })

  describe('#binary', function () {
    it('should not fail to parse binary doc w/in lambda', async function () {
      const testkey = H.genTestKey()
      var testBinVal = Buffer.from(
        '00092bc691fb824300a6871ceddf7090d7092bc691fb824300a6871ceddf7090d7',
        'hex'
      )

      await H.co.insert(testkey, testBinVal)

      await H.c.transactions().run(
        async (attempt) => {
          const getDoc = await attempt.get(H.co, testkey)
          assert.deepEqual(getDoc.content, testBinVal)
        },
        { timeout: 5000 }
      )
    }).timeout(15000)

    it('should allow binary txns', async function () {
      H.skipIfMissingFeature(this, H.Features.BinaryTransactions)
      const testkey = H.genTestKey()
      const testBinVal = Buffer.from(
        '00092bc691fb824300a6871ceddf7090d7092bc691fb824300a6871ceddf7090d7',
        'hex'
      )
      const newBinVal = Buffer.from('666f6f62617262617a', 'hex')
      await H.c.transactions().run(
        async (attempt) => {
          await attempt.insert(H.co, testkey, testBinVal)
          const getRes = await attempt.get(H.co, testkey)
          assert.deepEqual(getRes.content, testBinVal)
          const repRes = await attempt.replace(getRes, newBinVal)
          assert.isTrue(getRes.cas != repRes.cas)
        },
        { timeout: 5000 }
      )
    }).timeout(15000)

    it('should have FeatureNotAvailableError cause if binary txns not supported', async function () {
      if (H.supportsFeature(H.Features.BinaryTransactions)) {
        this.skip()
      }
      const testkey = H.genTestKey()
      const testBinVal = Buffer.from(
        '00092bc691fb824300a6871ceddf7090d7092bc691fb824300a6871ceddf7090d7',
        'hex'
      )
      let numAttempts = 0
      try {
        await H.c.transactions().run(
          async (attempt) => {
            numAttempts++
            await attempt.insert(H.co, testkey, testBinVal)
          },
          { timeout: 2000 }
        )
      } catch (err) {
        assert.instanceOf(err, H.lib.TransactionFailedError)
        assert.instanceOf(err.cause, H.lib.FeatureNotAvailableError)
        assert.equal(
          err.cause.cause.message,
          'Possibly attempting a binary transaction operation with a server version < 7.6.2'
        )
      }
      assert.equal(numAttempts, 1)
    }).timeout(15000)

    describe('#rawbinarytranscoder', function () {
      it('should allow binary txns using RawBinaryTranscoder', async function () {
        H.skipIfMissingFeature(this, H.Features.BinaryTransactions)
        const testkey = H.genTestKey()
        const testBinVal = Buffer.from(
          '00092bc691fb824300a6871ceddf7090d7092bc691fb824300a6871ceddf7090d7',
          'hex'
        )
        const newBinVal = Buffer.from('666f6f62617262617a', 'hex')
        const tc = new RawBinaryTranscoder()
        await H.c.transactions().run(
          async (attempt) => {
            await attempt.insert(H.co, testkey, testBinVal, { transcoder: tc })
            const getRes = await attempt.get(H.co, testkey, { transcoder: tc })
            assert.deepEqual(getRes.content, testBinVal)
            const repRes = await attempt.replace(getRes, newBinVal)
            assert.isTrue(getRes.cas != repRes.cas)
          },
          { timeout: 5000 }
        )
      }).timeout(15000)

      it('should have FeatureNotAvailableError cause if binary txns not supported using RawBinaryTranscoder', async function () {
        if (H.supportsFeature(H.Features.BinaryTransactions)) {
          this.skip()
        }
        const testkey = H.genTestKey()
        const testBinVal = Buffer.from(
          '00092bc691fb824300a6871ceddf7090d7092bc691fb824300a6871ceddf7090d7',
          'hex'
        )
        const tc = new RawBinaryTranscoder()
        let numAttempts = 0
        try {
          await H.c.transactions().run(
            async (attempt) => {
              numAttempts++
              await attempt.insert(H.co, testkey, testBinVal, {
                transcoder: tc,
              })
            },
            { timeout: 2000 }
          )
        } catch (err) {
          assert.instanceOf(err, H.lib.TransactionFailedError)
          assert.instanceOf(err.cause, H.lib.FeatureNotAvailableError)
          assert.equal(
            err.cause.cause.message,
            'Possibly attempting a binary transaction operation with a server version < 7.6.2'
          )
        }
        assert.equal(numAttempts, 1)
      }).timeout(15000)
    })
  })
})
