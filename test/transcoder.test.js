'use strict'

const assert = require('chai').assert
const {
  RawBinaryTranscoder,
  RawJsonTranscoder,
  RawStringTranscoder,
} = require('../lib/transcoders')
const H = require('./harness')
const testdata = require('./testdata')

const DOC_COUNT = 20

function genericTests(collFn) {
  describe('#transcoders', function () {
    let testKeys = []

    before(function () {
      for (let i = 0; i < DOC_COUNT; ++i) {
        testKeys.push(H.genTestKey())
      }
    })

    /* eslint-disable mocha/no-setup-in-describe */
    describe('#rawbinary', function () {
      let keyIndex = 0
      const transcoder = new RawBinaryTranscoder()
      const insertContent = Buffer.from('696e7365727420636f6e74656e74', 'hex')
      const upsertContent = Buffer.from('75707365727420636f6e74656e74', 'hex')
      const replaceContent = Buffer.from(
        '7265706c61636520636f6e74656e74',
        'hex'
      )

      after(async function () {
        try {
          await testdata.removeTestData(collFn(), testKeys)
        } catch (err) {
          // ignore
        }
      })

      it('should insert using RawBinaryTranscoder', async function () {
        const key = testKeys[keyIndex]
        const res = await collFn().insert(key, insertContent, {
          transcoder: transcoder,
        })
        assert.isObject(res)
        assert.isOk(res.cas)
      })

      it('should get inserted doc using RawBinaryTranscoder', async function () {
        const key = testKeys[keyIndex++]
        const res = await collFn().get(key, { transcoder: transcoder })
        assert.isObject(res)
        assert.isOk(res.cas)
        assert.deepStrictEqual(res.value, insertContent)
      })

      it('should upsert using RawBinaryTranscoder', async function () {
        const key = testKeys[keyIndex]
        const res = await collFn().upsert(key, upsertContent, {
          transcoder: transcoder,
        })
        assert.isObject(res)
        assert.isOk(res.cas)
      })

      it('should get upserted doc using RawBinaryTranscoder', async function () {
        const key = testKeys[keyIndex++]
        const res = await collFn().get(key, { transcoder: transcoder })
        assert.isObject(res)
        assert.isOk(res.cas)
        assert.deepStrictEqual(res.value, upsertContent)
      })

      it('should replace using RawBinaryTranscoder', async function () {
        const key = testKeys[keyIndex++]
        const insertRes = await collFn().insert(key, insertContent, {
          transcoder: transcoder,
        })
        assert.isObject(insertRes)
        assert.isOk(insertRes.cas)
        const replaceRes = await collFn().replace(key, replaceContent, {
          transcoder: transcoder,
        })
        assert.isObject(replaceRes)
        assert.isOk(replaceRes.cas)
        assert.notEqual(insertRes.cas, replaceRes.cas)
        const getRes = await collFn().get(key, { transcoder: transcoder })
        assert.isObject(getRes)
        assert.isOk(getRes.cas)
        assert.notEqual(getRes.cas, replaceRes.cas)
        assert.deepStrictEqual(getRes.value, replaceContent)
      })

      describe('#invalid-content', function () {
        const invalidContent = [
          {
            contentType: 'string',
            content: 'invalid content',
          },
          {
            contentType: 'object',
            content: { foo: 'bar' },
          },
          {
            contentType: 'array',
            content: ['invalid content'],
          },
          {
            contentType: 'number',
            content: 101,
          },
        ]

        /* eslint-disable mocha/no-setup-in-describe */
        describe('#encode', function () {
          invalidContent.forEach((contentObj) => {
            it(`should fail to insert invalid content (${contentObj.contentType}) with RawBinaryTranscoder`, async function () {
              await H.throwsHelper(
                async () => {
                  await collFn().insert('test-key', contentObj.content, {
                    transcoder: transcoder,
                  })
                },
                Error,
                'Only binary data supported by RawBinaryTranscoder.'
              )
            })

            it(`should fail to upsert invalid content (${contentObj.contentType}) with RawBinaryTranscoder`, async function () {
              await H.throwsHelper(
                async () => {
                  await collFn().upsert('test-key', contentObj.content, {
                    transcoder: transcoder,
                  })
                },
                Error,
                'Only binary data supported by RawBinaryTranscoder.'
              )
            })

            it(`should fail to replace invalid content (${contentObj.contentType}) with RawBinaryTranscoder`, async function () {
              await H.throwsHelper(
                async () => {
                  await collFn().replace('test-key', contentObj.content, {
                    transcoder: transcoder,
                  })
                },
                Error,
                'Only binary data supported by RawBinaryTranscoder.'
              )
            })
          })
        })

        describe('#decode', function () {
          const root = H.genTestKey()

          before(async function () {
            await Promise.all(
              invalidContent.map((contentObj) =>
                collFn().upsert(
                  `${root}-${contentObj.contentType}`,
                  contentObj.content
                )
              )
            )
          })

          after(async function () {
            try {
              await Promise.all(
                invalidContent.map((contentObj) =>
                  collFn().remove(`${root}-${contentObj.contentType}`)
                )
              )
            } catch (err) {
              // ignore
            }
          })

          invalidContent.forEach((contentObj) => {
            it(`should fail to get invalid content (${contentObj.contentType}) with RawBinaryTranscoder`, async function () {
              await H.throwsHelper(
                async () => {
                  await collFn().get(`${root}-${contentObj.contentType}`, {
                    transcoder: transcoder,
                  })
                },
                Error,
                /.*format not supported by RawBinaryTranscoder/
              )
            })
          })
        })
      })
    })

    /* eslint-disable mocha/no-setup-in-describe */
    describe('#rawstring', function () {
      let keyIndex = 0
      const transcoder = new RawStringTranscoder()
      const insertContent = 'insert content'
      const upsertContent = 'upsert content'
      const replaceContent = 'replace content'

      after(async function () {
        try {
          await testdata.removeTestData(collFn(), testKeys)
        } catch (err) {
          // ignore
        }
      })

      it('should insert using RawStringTranscoder', async function () {
        const key = testKeys[keyIndex]
        const res = await collFn().insert(key, insertContent, {
          transcoder: transcoder,
        })
        assert.isObject(res)
        assert.isOk(res.cas)
      })

      it('should get inserted doc using RawStringTranscoder', async function () {
        const key = testKeys[keyIndex++]
        const res = await collFn().get(key, { transcoder: transcoder })
        assert.isObject(res)
        assert.isOk(res.cas)
        assert.deepStrictEqual(res.value, insertContent)
      })

      it('should upsert using RawStringTranscoder', async function () {
        const key = testKeys[keyIndex]
        const res = await collFn().upsert(key, upsertContent, {
          transcoder: transcoder,
        })
        assert.isObject(res)
        assert.isOk(res.cas)
      })

      it('should get upserted doc using RawStringTranscoder', async function () {
        const key = testKeys[keyIndex++]
        const res = await collFn().get(key, { transcoder: transcoder })
        assert.isObject(res)
        assert.isOk(res.cas)
        assert.deepStrictEqual(res.value, upsertContent)
      })

      it('should replace using RawStringTranscoder', async function () {
        const key = testKeys[keyIndex++]
        const insertRes = await collFn().insert(key, insertContent, {
          transcoder: transcoder,
        })
        assert.isObject(insertRes)
        assert.isOk(insertRes.cas)
        const replaceRes = await collFn().replace(key, replaceContent, {
          transcoder: transcoder,
        })
        assert.isObject(replaceRes)
        assert.isOk(replaceRes.cas)
        assert.notEqual(insertRes.cas, replaceRes.cas)
        const getRes = await collFn().get(key, { transcoder: transcoder })
        assert.isObject(getRes)
        assert.isOk(getRes.cas)
        assert.notEqual(getRes.cas, replaceRes.cas)
        assert.deepStrictEqual(getRes.value, replaceContent)
      })

      describe('#invalid-content', function () {
        const invalidContent = [
          {
            contentType: 'binary',
            content: Buffer.from('696e76616c696420636f6e74656e74', 'hex'),
          },
          {
            contentType: 'object',
            content: { foo: 'bar' },
          },
          {
            contentType: 'array',
            content: ['invalid content'],
          },
          {
            contentType: 'number',
            content: 101,
          },
        ]

        /* eslint-disable mocha/no-setup-in-describe */
        describe('#encode', function () {
          invalidContent.forEach((contentObj) => {
            it(`should fail to insert invalid content (${contentObj.contentType}) with RawStringTranscoder`, async function () {
              await H.throwsHelper(
                async () => {
                  await collFn().insert('test-key', contentObj.content, {
                    transcoder: transcoder,
                  })
                },
                Error,
                'Only string data supported by RawStringTranscoder.'
              )
            })

            it(`should fail to upsert invalid content (${contentObj.contentType}) with RawStringTranscoder`, async function () {
              await H.throwsHelper(
                async () => {
                  await collFn().upsert('test-key', contentObj.content, {
                    transcoder: transcoder,
                  })
                },
                Error,
                'Only string data supported by RawStringTranscoder.'
              )
            })

            it(`should fail to replace invalid content (${contentObj.contentType}) with RawStringTranscoder`, async function () {
              await H.throwsHelper(
                async () => {
                  await collFn().replace('test-key', contentObj.content, {
                    transcoder: transcoder,
                  })
                },
                Error,
                'Only string data supported by RawStringTranscoder.'
              )
            })
          })
        })

        describe('#decode', function () {
          const root = H.genTestKey()

          before(async function () {
            await Promise.all(
              invalidContent.map((contentObj) =>
                collFn().upsert(
                  `${root}-${contentObj.contentType}`,
                  contentObj.content
                )
              )
            )
          })

          after(async function () {
            try {
              await Promise.all(
                invalidContent.map((contentObj) =>
                  collFn().remove(`${root}-${contentObj.contentType}`)
                )
              )
            } catch (err) {
              // ignore
            }
          })

          invalidContent.forEach((contentObj) => {
            it(`should fail to get invalid content (${contentObj.contentType}) with RawStringTranscoder`, async function () {
              await H.throwsHelper(
                async () => {
                  await collFn().get(`${root}-${contentObj.contentType}`, {
                    transcoder: transcoder,
                  })
                },
                Error,
                /.*format not supported by RawStringTranscoder/
              )
            })
          })
        })
      })
    })

    /* eslint-disable mocha/no-setup-in-describe */
    describe('#rawjson', function () {
      let keyIndex = 0
      const transcoder = new RawJsonTranscoder()
      const content = [
        {
          contentType: 'binary',
          content: {
            insertContent: Buffer.from('696e7365727420636f6e74656e74', 'hex'),
            upsertContent: Buffer.from('75707365727420636f6e74656e74', 'hex'),
            replaceContent: Buffer.from(
              '7265706c61636520636f6e74656e74',
              'hex'
            ),
          },
        },
        {
          contentType: 'string',
          content: {
            insertContent: 'insert content',
            upsertContent: 'upsert content',
            replaceContent: 'replace content',
          },
        },
      ]

      after(async function () {
        try {
          await testdata.removeTestData(collFn(), testKeys)
        } catch (err) {
          // ignore
        }
      })

      content.forEach((contentObj) => {
        it(`should insert ${contentObj.contentType} using RawJsonTranscoder`, async function () {
          const key = testKeys[keyIndex]
          const res = await collFn().insert(
            key,
            contentObj.content.insertContent,
            { transcoder: transcoder }
          )
          assert.isObject(res)
          assert.isOk(res.cas)
        })

        it(`should get inserted ${contentObj.contentType} doc using RawJsonTranscoder`, async function () {
          const key = testKeys[keyIndex++]
          const res = await collFn().get(key, { transcoder: transcoder })
          assert.isObject(res)
          assert.isOk(res.cas)
          if (contentObj.contentType === 'string') {
            assert.deepStrictEqual(
              res.value.toString('utf8'),
              contentObj.content.insertContent
            )
          } else {
            assert.deepStrictEqual(res.value, contentObj.content.insertContent)
          }
        })

        it(`should upsert ${contentObj.contentType} using RawJsonTranscoder`, async function () {
          const key = testKeys[keyIndex]
          const res = await collFn().upsert(
            key,
            contentObj.content.upsertContent,
            { transcoder: transcoder }
          )
          assert.isObject(res)
          assert.isOk(res.cas)
        })

        it(`should get upserted ${contentObj.contentType} doc using RawJsonTranscoder`, async function () {
          const key = testKeys[keyIndex++]
          const res = await collFn().get(key, { transcoder: transcoder })
          assert.isObject(res)
          assert.isOk(res.cas)
          if (contentObj.contentType === 'string') {
            assert.deepStrictEqual(
              res.value.toString('utf8'),
              contentObj.content.upsertContent
            )
          } else {
            assert.deepStrictEqual(res.value, contentObj.content.upsertContent)
          }
        })

        it(`should replace ${contentObj.contentType} using RawJsonTranscoder`, async function () {
          const key = testKeys[keyIndex++]
          const insertRes = await collFn().insert(
            key,
            contentObj.content.insertContent,
            { transcoder: transcoder }
          )
          assert.isObject(insertRes)
          assert.isOk(insertRes.cas)
          const replaceRes = await collFn().replace(
            key,
            contentObj.content.replaceContent,
            { transcoder: transcoder }
          )
          assert.isObject(replaceRes)
          assert.isOk(replaceRes.cas)
          assert.notEqual(insertRes.cas, replaceRes.cas)
          const getRes = await collFn().get(key, { transcoder: transcoder })
          assert.isObject(getRes)
          assert.isOk(getRes.cas)
          assert.notEqual(getRes.cas, replaceRes.cas)
          if (contentObj.contentType === 'string') {
            assert.deepStrictEqual(
              getRes.value.toString('utf8'),
              contentObj.content.replaceContent
            )
          } else {
            assert.deepStrictEqual(
              getRes.value,
              contentObj.content.replaceContent
            )
          }
        })
      })

      it('RawJsonTranscoder should allow JSON bytes to passthrough', async function () {
        const key = testKeys[keyIndex++]
        const value = { foo: 'bar', baz: 'quz' }
        const jsonBytes = Buffer.from(JSON.stringify(value))
        const upsertRes = await collFn().upsert(key, jsonBytes, {
          transcoder: transcoder,
        })
        assert.isObject(upsertRes)
        assert.isOk(upsertRes.cas)
        const getRes = await collFn().get(key, { transcoder: transcoder })
        assert.isObject(getRes)
        assert.isOk(getRes.cas)
        assert.notDeepEqual(getRes.value, value)
        assert.deepStrictEqual(getRes.value, jsonBytes)
        assert.deepStrictEqual(JSON.parse(getRes.value.toString('utf8')), value)
      })

      describe('#invalid-content', function () {
        const invalidEncodedContent = [
          {
            contentType: 'object',
            content: { foo: 'bar' },
          },
          {
            contentType: 'array',
            content: ['invalid content'],
          },
          {
            contentType: 'number',
            content: 101,
          },
        ]

        const invalidDecodedContent = [
          {
            contentType: 'string',
            content: 'invalid content',
          },
          {
            contentType: 'binary',
            content: Buffer.from('696e76616c696420636f6e74656e74', 'hex'),
          },
        ]

        /* eslint-disable mocha/no-setup-in-describe */
        describe('#encode', function () {
          invalidEncodedContent.forEach((contentObj) => {
            it(`should fail to insert invalid content (${contentObj.contentType}) with RawJsonTranscoder`, async function () {
              await H.throwsHelper(
                async () => {
                  await collFn().insert('test-key', contentObj.content, {
                    transcoder: transcoder,
                  })
                },
                Error,
                'Only binary and string data supported by RawJsonTranscoder.'
              )
            })

            it(`should fail to upsert invalid content (${contentObj.contentType}) with RawJsonTranscoder`, async function () {
              await H.throwsHelper(
                async () => {
                  await collFn().upsert('test-key', contentObj.content, {
                    transcoder: transcoder,
                  })
                },
                Error,
                'Only binary and string data supported by RawJsonTranscoder.'
              )
            })

            it(`should fail to replace invalid content (${contentObj.contentType}) with RawJsonTranscoder`, async function () {
              await H.throwsHelper(
                async () => {
                  await collFn().replace('test-key', contentObj.content, {
                    transcoder: transcoder,
                  })
                },
                Error,
                'Only binary and string data supported by RawJsonTranscoder.'
              )
            })
          })
        })

        describe('#decode', function () {
          const root = H.genTestKey()

          before(async function () {
            await Promise.all(
              invalidDecodedContent.map((contentObj) =>
                collFn().upsert(
                  `${root}-${contentObj.contentType}`,
                  contentObj.content
                )
              )
            )
          })

          after(async function () {
            try {
              await Promise.all(
                invalidDecodedContent.map((contentObj) =>
                  collFn().remove(`${root}-${contentObj.contentType}`)
                )
              )
            } catch (err) {
              // ignore
            }
          })

          invalidDecodedContent.forEach((contentObj) => {
            it(`should fail to get invalid content (${contentObj.contentType}) with RawJsonTranscoder`, async function () {
              await H.throwsHelper(
                async () => {
                  await collFn().get(`${root}-${contentObj.contentType}`, {
                    transcoder: transcoder,
                  })
                },
                Error,
                /.*format not supported by RawJsonTranscoder/
              )
            })
          })
        })
      })
    })
  })
}

describe('#default-collection', function () {
  /* eslint-disable-next-line mocha/no-setup-in-describe */
  genericTests(() => H.dco)
})

// describe('#collections-transcoders', function () {
//   /* eslint-disable-next-line mocha/no-hooks-for-single-case */
//   before(function () {
//     H.skipIfMissingFeature(this, H.Features.Collections)
//   })

//   /* eslint-disable-next-line mocha/no-setup-in-describe */
//   genericTests(() => H.co)
// })
