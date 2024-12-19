'use strict'

const assert = require('chai').assert
const testdata = require('./testdata')

const H = require('./harness')

function genericTests(connFn) {
  let testScope, testFn

  /* eslint-disable-next-line mocha/no-top-level-hooks */
  before(async function () {
    this.timeout(30000)

    H.skipIfMissingFeature(this, H.Features.Collections)
    H.skipIfMissingFeature(this, H.Features.Eventing)

    testScope = H.genTestKey()
    testFn = H.genTestKey()

    await H.b.collections().createScope(testScope)
    await H.consistencyUtils.waitUntilScopePresent(H.bucketName, testScope)

    await H.b.collections().createCollection('source', testScope)
    await H.consistencyUtils.waitUntilCollectionPresent(
      H.bucketName,
      testScope,
      'source'
    )

    await H.b.collections().createCollection('meta', testScope)
    await H.consistencyUtils.waitUntilCollectionPresent(
      H.bucketName,
      testScope,
      'meta'
    )

    await H.sleep(2500)

    // We drop the scope at the end of testing, so there is no need to clean up the documents.
    await testdata.upsertData(H.b.scope(testScope).collection('source'), 'docs')
  })

  /* eslint-disable-next-line mocha/no-top-level-hooks */
  after(async function () {
    this.timeout(30000)

    if (testScope) {
      await H.b.collections().dropScope(testScope)
      await H.consistencyUtils.waitUntilScopeDropped(H.bucketName, testScope)
    }
  })

  it('should upsert successfully', async function () {
    await connFn()
      .eventingFunctions()
      .upsertFunction({
        name: testFn,
        code: `
      function OnUpdate(doc, meta) {
        log('data:', doc, meta)
      }
      `,
        bucketBindings: [
          new H.lib.EventingFunctionBucketBinding({
            name: new H.lib.EventingFunctionKeyspace({
              bucket: H.bucketName,
              scope: H.scopeName,
              collection: H.collName,
            }),
            alias: 'bucketbinding1',
            access: H.lib.EventingFunctionBucketAccess.ReadWrite,
          }),
        ],
        urlBindings: [
          new H.lib.EventingFunctionUrlBinding({
            hostname: 'http://127.0.0.1',
            alias: 'urlbinding1',
            auth: new H.lib.EventingFunctionUrlAuthBasic({
              username: 'username',
              password: 'password',
            }),
            allowCookies: false,
            validateSslCertificate: false,
          }),
        ],
        constantBindings: [
          {
            alias: 'someconstant',
            literal: 'someliteral',
          },
        ],
        metadataKeyspace: new H.lib.EventingFunctionKeyspace({
          bucket: H.bucketName,
          scope: testScope,
          collection: 'meta',
        }),
        sourceKeyspace: {
          bucket: H.bucketName,
          scope: testScope,
          collection: 'source',
        },
      })
  }).timeout(15000)

  it('should find the upserted function', async function () {
    const funcs = await connFn().eventingFunctions().getAllFunctions()
    const func = funcs.find((f) => f.name === testFn)
    assert.isNotNull(func)
  })

  it('should get function statuses', async function () {
    const statuses = await connFn().eventingFunctions().functionsStatus()
    const status = statuses.functions.find((f) => f.name === testFn)
    assert.isNotNull(status)
  })

  async function waitForState(state, options = {}) {
    const fnName = options.fnName || testFn
    const sleepMs = options.sleepMs || 500
    // default is 90 seconds (180 * 500ms)
    const maxAttempts = options.maxAttempts || 180

    for (var i = 0; i < maxAttempts; ++i) {
      const statuses = await connFn().eventingFunctions().functionsStatus()
      const status = statuses.functions.find((f) => f.name === fnName)

      if (status.status === state) {
        return
      }

      await H.sleep(sleepMs)
    }

    throw new Error('failed to achieve required state')
  }

  it('should successfully wait for bootstrap', async function () {
    await waitForState(H.lib.EventingFunctionStatus.Undeployed)
  }).timeout(15000)

  describe('#deploy-pause-resume-undeploy', function () {
    this.retries(3)

    let innerTestFn

    before(async function () {
      this.timeout(30000)

      innerTestFn = H.genTestKey()

      await connFn()
        .eventingFunctions()
        .upsertFunction({
          name: innerTestFn,
          code: `
      function OnUpdate(doc, meta) {
        log('data:', doc, meta)
      }
      `,
          bucketBindings: [
            new H.lib.EventingFunctionBucketBinding({
              name: new H.lib.EventingFunctionKeyspace({
                bucket: H.bucketName,
                scope: H.scopeName,
                collection: H.collName,
              }),
              alias: 'bucketbinding1',
              access: H.lib.EventingFunctionBucketAccess.ReadWrite,
            }),
          ],
          urlBindings: [],
          constantBindings: [],
          metadataKeyspace: new H.lib.EventingFunctionKeyspace({
            bucket: H.bucketName,
            scope: testScope,
            collection: 'meta',
          }),
          sourceKeyspace: {
            bucket: H.bucketName,
            scope: testScope,
            collection: 'source',
          },
        })
    })

    after(async function () {
      this.timeout(30000)
      try {
        await connFn().eventingFunctions().dropFunction(innerTestFn)
      } catch (e) {
        // ignore
      }
    })

    it('should successfully deploy the function', async function () {
      await connFn().eventingFunctions().deployFunction(innerTestFn)
      await waitForState(H.lib.EventingFunctionStatus.Deployed, {
        fnName: innerTestFn,
      })
    }).timeout(90000)

    it('should successfully pause the function', async function () {
      await connFn().eventingFunctions().pauseFunction(innerTestFn)
      await waitForState(H.lib.EventingFunctionStatus.Paused, {
        fnName: innerTestFn,
      })
    }).timeout(90000)

    it('should successfully resume the function', async function () {
      await connFn().eventingFunctions().resumeFunction(innerTestFn)
      await waitForState(H.lib.EventingFunctionStatus.Deployed, {
        fnName: innerTestFn,
      })
    }).timeout(90000)

    it('should successfully undeploy the function', async function () {
      await connFn().eventingFunctions().undeployFunction(innerTestFn)
      await waitForState(H.lib.EventingFunctionStatus.Undeployed, {
        fnName: innerTestFn,
      })
    }).timeout(90000)
  })

  it('should successfully drop the function', async function () {
    await connFn().eventingFunctions().dropFunction(testFn)
  }).timeout(15000)
}

describe('#eventing', function () {
  /* eslint-disable-next-line mocha/no-setup-in-describe */
  genericTests(() => H.c)
})

describe('#scopeeventing', function () {
  /* eslint-disable-next-line mocha/no-hooks-for-single-case */
  before(function () {
    H.skipIfMissingFeature(this, H.Features.ScopeEventingFunctionManagement)
  })
  /* eslint-disable-next-line mocha/no-setup-in-describe */
  genericTests(() => H.s)
})
