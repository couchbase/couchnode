'use strict'

const assert = require('chai').assert
const testdata = require('./testdata')

const H = require('./harness')

describe('#eventing', function () {
  let testScope, testFn

  before(async function () {
    this.timeout(30000)

    H.skipIfMissingFeature(this, H.Features.Collections)
    H.skipIfMissingFeature(this, H.Features.Eventing)

    testScope = H.genTestKey()
    testFn = H.genTestKey()

    await H.b.collections().createScope(testScope)
    await H.b.collections().createCollection({
      name: 'source',
      scopeName: testScope,
    })
    await H.b.collections().createCollection({
      name: 'meta',
      scopeName: testScope,
    })

    await H.sleep(2500)

    // We drop the scope at the end of testing, so there is no need to clean
    // up the documents, so no need to store anything.
    await testdata.upsertData(H.b.scope(testScope).collection('source'), 'docs')
  })

  after(async function () {
    this.timeout(30000)

    if (testScope) {
      await H.b.collections().dropScope(testScope)
    }
  })

  it('should upsert successfully', async function () {
    await H.c.eventingFunctions().upsertFunction({
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
    const funcs = await H.c.eventingFunctions().getAllFunctions()
    const func = funcs.find((f) => f.name === testFn)
    assert.isNotNull(func)
  })

  it('should get function statuses', async function () {
    const statuses = await H.c.eventingFunctions().functionsStatus()
    const status = statuses.functions.find((f) => f.name === testFn)
    assert.isNotNull(status)
  })

  async function waitForState(state) {
    for (var i = 0; i < 60000 / 500; ++i) {
      const statuses = await H.c.eventingFunctions().functionsStatus()
      const status = statuses.functions.find((f) => f.name === testFn)

      if (status.status === state) {
        return
      }

      await H.sleep(500)
    }

    throw new Error('failed to achieve required state')
  }

  it('should successfully wait for bootstrap', async function () {
    await waitForState(H.lib.EventingFunctionStatus.Undeployed)
  }).timeout(15000)

  it('should successfully deploy the function', async function () {
    await H.c.eventingFunctions().deployFunction(testFn)
    await waitForState(H.lib.EventingFunctionStatus.Deployed)
  }).timeout(30000)

  it('should successfully pause the function', async function () {
    await H.c.eventingFunctions().pauseFunction(testFn)
    await waitForState(H.lib.EventingFunctionStatus.Paused)
  }).timeout(30000)

  it('should successfully resume the function', async function () {
    await H.c.eventingFunctions().resumeFunction(testFn)
    await waitForState(H.lib.EventingFunctionStatus.Deployed)
  }).timeout(30000)

  it('should successfully undeploy the function', async function () {
    await H.c.eventingFunctions().undeployFunction(testFn)
    await waitForState(H.lib.EventingFunctionStatus.Undeployed)
  }).timeout(30000)

  it('should successfully drop the function', async function () {
    await H.c.eventingFunctions().dropFunction(testFn)
  }).timeout(15000)
})
