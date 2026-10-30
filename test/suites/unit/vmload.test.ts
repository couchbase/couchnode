import { spawnSync } from 'child_process'
import { join } from 'path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { TranspiledLib, transpileLib } from '../../infra/transpiledlib'

// A module loader that runs each CommonJS module through `vm` with no dynamic
// import callback cannot complete an import(), so no path the SDK takes may
// use one. The child here loads the SDK that way, compiled as the package
// ships it and with the native addon absent, then connects a couchbase2://
// cluster and closes it. Connecting sends nothing, so no gateway is needed.

// Compiling the SDK takes most of the default budget on the slower agents.
const TEST_TIMEOUT_MS = 60_000

const LOADER = `
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const { createRequire } = require('module')

const [lib] = process.argv.slice(1)
const cache = new Map()

function load(file) {
  const cached = cache.get(file)
  if (cached) {
    return cached.exports
  }
  const module = { exports: {} }
  cache.set(file, module)
  const resolve = createRequire(file).resolve
  const req = (request) => {
    const target = resolve(request)
    return target.startsWith(lib) && target.endsWith('.js')
      ? load(target)
      : require(target)
  }
  req.resolve = resolve
  const fn = vm.compileFunction(
    fs.readFileSync(file, 'utf8'),
    ['exports', 'require', 'module', '__filename', '__dirname'],
    { filename: file }
  )
  fn(module.exports, req, module, file, path.dirname(file))
  return module.exports
}

const errorOf = async (fn) => {
  try {
    await fn()
  } catch (err) {
    return err.code ?? err.constructor.name
  }
  return undefined
}

async function main() {
  const couchbase = load(path.join(lib, 'couchbase.js'))
  let cluster
  const connectError = await errorOf(async () => {
    cluster = await couchbase.connect('couchbase2://localhost', {
      username: 'u',
      password: 'p',
    })
  })
  const closeError = await errorOf(() => cluster?.close())
  const addonLoaded = load(path.join(lib, 'binding.js')).bindingLoaded()
  console.log(JSON.stringify({ connectError, closeError, addonLoaded }))
}
main()
`

let sdk: TranspiledLib

beforeAll(() => {
  sdk = transpileLib()
}, TEST_TIMEOUT_MS)

afterAll(() => sdk?.remove())

describe('#vm module loader', () => {
  it(
    'connects and closes a couchbase2 cluster without import() or the addon',
    () => {
      const child = spawnSync(process.execPath, ['-e', LOADER, sdk.lib], {
        encoding: 'utf8',
        env: {
          ...process.env,
          CN_PREBUILD_PATH_OVERRIDE: join(sdk.lib, '..', 'noaddon.node'),
        },
        timeout: TEST_TIMEOUT_MS,
      })
      expect(child.stderr).toBe('')
      expect(JSON.parse(child.stdout)).toEqual({
        connectError: undefined,
        closeError: undefined,
        addonLoaded: false,
      })
    },
    TEST_TIMEOUT_MS
  )
})
