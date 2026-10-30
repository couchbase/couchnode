// Imports the SDK with the native addon refused. `addonfree.test.ts` expects
// the import to succeed, and the first read of an addon value to fail with the
// SDK's own error naming what needed it.
//
// In a process of its own because the refusal is a hook on the module loader,
// and the addon is already loaded in any process that has run a classic test.

import Module from 'module'
import { join } from 'path'

import { runExitFixture } from '../../../infra/exitchild'

const LIB = join(__dirname, '..', '..', '..', '..', 'lib')

const refused: string[] = []

type Load = (request: string, parent: unknown, isMain: boolean) => unknown
const loader = Module as unknown as { _load: Load }
const load = loader._load
loader._load = function (request, parent, isMain) {
  if (request.endsWith('.node') || /scripts[\\/]prebuilds/.test(request)) {
    refused.push(request)
    throw new Error(`addon refused: ${request}`)
  }
  return load.call(this, request, parent, isMain)
}

runExitFixture(async () => {
  const couchbase = require(join(LIB, 'couchbase'))
  const refusedOnImport = refused.length

  // Building sub-document specs is part of describing an operation, not
  // running one, so it must not need the addon either.
  couchbase.LookupInSpec.get('a', { xattr: true })
  couchbase.LookupInSpec.get(couchbase.LookupInMacro.Cas)
  couchbase.MutateInSpec.upsert('a', 1, { createPath: true })
  couchbase.MutateInSpec.upsert('a', couchbase.MutateInMacro.Cas)
  couchbase.MutateInSpec.remove('')
  const refusedOnSpecs = refused.length - refusedOnImport

  // A couchbase2:// cluster and the objects under it never create the addon's
  // connection; asking for it fails with the SDK's own error. Connecting
  // sends nothing, so it connects and closes with no gateway.
  const errorOf = async (fn: () => unknown) => {
    try {
      await fn()
    } catch (err) {
      return (err as Error).constructor.name
    }
    return undefined
  }
  const beforeCouchbase2 = refused.length
  let cluster: { bucket(name: string): any; close(): Promise<void> } | undefined
  const couchbase2 = {
    connectError: await errorOf(async () => {
      cluster = await couchbase.connect('couchbase2://localhost', {
        username: 'u',
        password: 'p',
      })
    }),
    connError: await errorOf(
      () => cluster?.bucket('b').scope('s').collection('c').conn
    ),
    closeError: await errorOf(() => cluster?.close()),
    refused: 0,
  }
  couchbase2.refused = refused.length - beforeCouchbase2

  let useError: { name: string; message: string } | undefined
  try {
    void couchbase.cbppVersion
  } catch (err) {
    const e = err as Error
    useError = { name: e.constructor.name, message: e.message }
  }

  return {
    exports: Object.keys(couchbase).length,
    refusedOnImport,
    refusedOnSpecs,
    couchbase2,
    useError,
  }
})
