'use strict'

const assert = require('chai').assert

const H = require('./harness')

describe('#transactions', function () {
  before(async function () {
    H.skipIfMissingFeature(this, H.Features.Transactions)
  })

  it('should work with a simple tranasaction', async function () {
    const testDocIns = H.genTestKey()
    const testDocRep = H.genTestKey()
    const testDocRem = H.genTestKey()

    await H.co.insert(testDocRep, { foo: 'bar' })
    await H.co.insert(testDocRem, { foo: 'bar' })

    await H.c.transactions().run(async (attempt) => {
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
    })

    var insRes = await H.co.get(testDocIns)
    assert.deepStrictEqual(insRes.content, { foo: 'baz' })

    var repRes = await H.co.get(testDocRep)
    assert.deepStrictEqual(repRes.content, { foo: 'baz' })

    await H.throwsHelper(async () => {
      await H.co.get(testDocRem)
    })
  })

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

  it('should fail with application errors', async function () {
    const testDocIns = H.genTestKey()
    const testDocRep = H.genTestKey()
    const testDocRem = H.genTestKey()

    await H.co.insert(testDocRep, { foo: 'bar' })
    await H.co.insert(testDocRem, { foo: 'bar' })

    let numAttempts = 0
    await H.throwsHelper(async () => {
      await H.c.transactions().run(async (attempt) => {
        numAttempts++

        await attempt.insert(H.co, testDocIns, { foo: 'baz' })

        const repDoc = await attempt.get(H.co, testDocRep)
        await attempt.replace(repDoc, { foo: 'baz' })

        const remDoc = await attempt.get(H.co, testDocRem)
        await attempt.remove(remDoc)

        throw new Error('application failure')
      })
    }, 'application failure')

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
    await H.throwsHelper(async () => {
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
    }, 'application failure')

    assert.equal(numAttempts, 1)

    await H.throwsHelper(async () => {
      await H.co.get(testDocIns)
    })

    var repRes = await H.co.get(testDocRep)
    assert.deepStrictEqual(repRes.content, { foo: 'bar' })

    var remRes = await H.co.get(testDocRep)
    assert.deepStrictEqual(remRes.content, { foo: 'bar' })
  })
})
