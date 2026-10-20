import { describe, expect, it } from 'vitest'

import {
  Collection,
  CouchbaseList,
  CouchbaseMap,
  CouchbaseQueue,
  CouchbaseSet,
} from '../../../lib/couchbase'
import { NoOpMeter, NoOpTracer } from '../../../lib/observability'
import { ObservabilityInstruments } from '../../../lib/observabilitytypes'
import { watchRejections } from '../../infra/rejections'

type Callback = (err: Error | null) => void

interface StructureCase {
  name: string
  structure: () => object
  call: (callback: Callback) => Promise<unknown>
}

/**
 * A row whose `call` is checked against the structure `structure` builds. The
 * structure's type stays inside the closure, so the rows share one shape.
 */
function structureCase<S extends object>(
  name: string,
  structure: () => S,
  call: (structure: S, callback: Callback) => Promise<unknown>
): StructureCase {
  return { name, structure, call: (callback) => call(structure(), callback) }
}

interface Class {
  name: string
  prototype: object
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

// These tests need no server. The data structures sit on a collection rather
// than on the binding, so the stub is a collection whose every call fails, and
// what is under test is that the failure reaches the callback without also
// escaping as an unhandled rejection.
describe('#data structure callbacks', () => {
  const failure = new Error('collection call failed')

  const collection = {
    observabilityInstruments: new ObservabilityInstruments(
      new NoOpTracer(),
      new NoOpMeter()
    ),
    _cppDocId: () => ({}),
    get: () => Promise.reject(failure),
    lookupIn: () => Promise.reject(failure),
    mutateIn: () => Promise.reject(failure),
  } as unknown as Collection

  const structures: StructureCase[] = [
    structureCase(
      'CouchbaseList.getAll',
      () => new CouchbaseList(collection, 'key'),
      (s, cb) => s.getAll(cb)
    ),
    structureCase(
      'CouchbaseMap.get',
      () => new CouchbaseMap(collection, 'key'),
      (s, cb) => s.get('item', cb)
    ),
    structureCase(
      'CouchbaseQueue.size',
      () => new CouchbaseQueue(collection, 'key'),
      (s, cb) => s.size(cb)
    ),
    structureCase(
      'CouchbaseSet.add',
      () => new CouchbaseSet(collection, 'key'),
      (s, cb) => s.add('item', cb)
    ),
  ]

  for (const t of structures) {
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

  // The private readers take no callback, so only they may stay async.
  it('declares only the private readers async', () => {
    const methods = structures.flatMap((t) =>
      asyncMethods(t.structure().constructor as Class)
    )

    expect(methods.sort()).toEqual([
      'CouchbaseList._get',
      'CouchbaseMap._get',
      'CouchbaseQueue._get',
      'CouchbaseSet._get',
    ])
  })
})
