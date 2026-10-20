import { describe, expect, it } from 'vitest'

import {
  AnalyticsIndexManager,
  Bucket,
  BucketManager,
  Cluster,
  Collection,
  CollectionManager,
  CollectionQueryIndexManager,
  EventingFunctionManager,
  InvalidArgumentError,
  QueryIndexManager,
  ScopeEventingFunctionManager,
  ScopeSearchIndexManager,
  SearchIndexManager,
  UserManager,
  ViewIndexManager,
} from '../../../lib/couchbase'
import { NoOpMeter, NoOpTracer } from '../../../lib/observability'
import { ObservabilityInstruments } from '../../../lib/observabilitytypes'
import { CallbackArg } from '../../infra/callbacks'
import { watchRejections } from '../../infra/rejections'

// Every call below passes the callback in the options position, which each
// method accepts at run time. `CallbackArg` is what lets that typecheck without
// narrowing it to an explicit `undefined`; `infra/callbacks.ts` says why the
// shape is kept.
type Callback = CallbackArg<unknown>

interface Class {
  name: string
  prototype: object
}

interface ManagerCase {
  name: string
  manager: () => object
  call: (callback: Callback) => Promise<unknown>
}

/**
 * A row whose `call` is checked against the manager `manager` builds. The
 * manager's type stays inside the closure, so the rows share one shape.
 */
function managerCase<M extends object>(
  name: string,
  manager: () => M,
  call: (manager: M, callback: Callback) => Promise<unknown>
): ManagerCase {
  return { name, manager, call: (callback) => call(manager(), callback) }
}

/**
 * The method names on `cls` that are declared `async`.
 *
 * An `async` method wraps what it returns in a promise no caller holds, so a
 * callback-form failure surfaces as an unhandled rejection even though the
 * callback saw it.
 */
function asyncMethods(cls: Class): string[] {
  return Object.getOwnPropertyNames(cls.prototype)
    .filter((name) => {
      const desc = Object.getOwnPropertyDescriptor(cls.prototype, name)
      return (
        desc?.value instanceof Function &&
        desc.value.constructor.name === 'AsyncFunction'
      )
    })
    .map((name) => `${cls.name}.${name}`)
}

// These tests need no server. Every binding call on the stub connection fails,
// so each management call below takes its error path, and what is under test
// is that the failure reaches the callback without also escaping as an
// unhandled rejection.
describe('#management callbacks', () => {
  const failure = new Error('binding call failed')

  const conn = new Proxy(
    {},
    {
      get: () => () => {
        throw failure
      },
    }
  )
  const cluster = {
    conn: conn,
    managementTimeout: 1000,
    observabilityInstruments: new ObservabilityInstruments(
      new NoOpTracer(),
      new NoOpMeter()
    ),
  } as unknown as Cluster
  const bucket = {
    name: 'bucket',
    conn: conn,
    cluster: cluster,
  } as unknown as Bucket
  const collection = {
    name: 'collection',
    scope: { name: 'scope', bucket: bucket },
    cluster: cluster,
  } as unknown as Collection

  const managers: ManagerCase[] = [
    managerCase(
      'AnalyticsIndexManager.connectLink',
      () => new AnalyticsIndexManager(cluster),
      (m, cb) => m.connectLink(cb)
    ),
    managerCase(
      'BucketManager.dropBucket',
      () => new BucketManager(cluster),
      (m, cb) => m.dropBucket('bucket', cb)
    ),
    managerCase(
      'CollectionManager.getAllScopes',
      () => new CollectionManager(bucket),
      (m, cb) => m.getAllScopes(cb)
    ),
    managerCase(
      'EventingFunctionManager.getAllFunctions',
      () => new EventingFunctionManager(cluster),
      (m, cb) => m.getAllFunctions(cb)
    ),
    managerCase(
      'QueryIndexManager.getAllIndexes',
      () => new QueryIndexManager(cluster),
      (m, cb) => m.getAllIndexes('bucket', cb)
    ),
    managerCase(
      'CollectionQueryIndexManager.getAllIndexes',
      () => new CollectionQueryIndexManager(collection),
      (m, cb) => m.getAllIndexes(cb)
    ),
    managerCase(
      'ScopeEventingFunctionManager.getAllFunctions',
      () => new ScopeEventingFunctionManager(cluster, 'b', 's'),
      (m, cb) => m.getAllFunctions(cb)
    ),
    managerCase(
      'ScopeSearchIndexManager.getAllIndexes',
      () => new ScopeSearchIndexManager(cluster, 'b', 's'),
      (m, cb) => m.getAllIndexes(cb)
    ),
    managerCase(
      'SearchIndexManager.getAllIndexes',
      () => new SearchIndexManager(cluster),
      (m, cb) => m.getAllIndexes(cb)
    ),
    managerCase(
      'UserManager.getAllGroups',
      () => new UserManager(cluster),
      (m, cb) => m.getAllGroups(cb)
    ),
    managerCase(
      'ViewIndexManager.getAllDesignDocuments',
      () => new ViewIndexManager(bucket),
      (m, cb) => m.getAllDesignDocuments(cb)
    ),
  ]

  for (const t of managers) {
    it(`${t.name} reports a failure through the callback only`, async () => {
      await watchRejections(async (rejections) => {
        const callbackError = await new Promise<Error | null>((resolve) => {
          void t.call(resolve)
        })

        expect(callbackError).toBe(failure)
        expect(await rejections.settle()).toBe(0)
      })
    })

    it(`${t.name} still rejects the promise it returns`, async () => {
      await watchRejections(async (rejections) => {
        await expect(t.call(() => {})).rejects.toBe(failure)

        expect(await rejections.settle()).toBe(0)
      })
    })
  }

  it('reports an invalid argument without leaking a rejection', async () => {
    await watchRejections(async (rejections) => {
      const manager = new UserManager(cluster)
      let callbackCalled = false
      expect(() =>
        manager.getAllUsers({ domainName: 'not-a-domain' }, () => {
          callbackCalled = true
        })
      ).toThrow(InvalidArgumentError)

      expect(await rejections.settle()).toBe(0)
      expect(callbackCalled).toBe(false)
    })
  })

  it('declares no management method async', () => {
    const classes = new Set(
      managers.map((t) => t.manager().constructor as Class)
    )
    // The cluster level query index manager delegates to an internal class
    // that is not exported, so it is reached through the instance.
    const internal = (
      new QueryIndexManager(cluster) as unknown as { _manager: object }
    )._manager
    classes.add(internal.constructor as Class)

    expect([...classes].flatMap(asyncMethods)).toStrictEqual([])
  })
})
