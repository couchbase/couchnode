import { spawnSync } from 'child_process'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { pathToFileURL } from 'url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { TranspiledLib, transpileLib } from '../../infra/transpiledlib'

// An ESM import of the SDK sees only the exports Node's loader detects by
// scanning the compiled CommonJS, so an export written in a form it does not
// recognise is not importable by name. Node also reads every export it
// detects as the import completes, so none of them may fail when the native
// addon is absent. Each import runs in a Node process of its own, against the
// SDK compiled as the package ships it, with the addon replaced by a stub or
// by a path that does not exist.

const NAMES = ['lcbVersion', 'cbppVersion', 'cbppMetadata']

// Compiling the SDK takes most of the default budget on the slower agents.
const TEST_TIMEOUT_MS = 60_000

let sdk: TranspiledLib
let url: string
let stubAddon: string
let missingAddon: string

beforeAll(() => {
  sdk = transpileLib()
  url = pathToFileURL(sdk.entry).href
  stubAddon = join(sdk.lib, '..', 'stubaddon.cjs')
  writeFileSync(
    stubAddon,
    'module.exports = { cbppVersion: "v", cbppMetadata: "m" }\n'
  )
  missingAddon = join(sdk.lib, '..', 'noaddon.node')
}, TEST_TIMEOUT_MS)

afterAll(() => sdk?.remove())

function runModule(
  source: string,
  addon: string
): { stderr: string; result: unknown } {
  const child = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', source],
    {
      encoding: 'utf8',
      env: { ...process.env, CN_PREBUILD_PATH_OVERRIDE: addon },
    }
  )
  return {
    stderr: child.stderr,
    result: child.stdout ? JSON.parse(child.stdout) : undefined,
  }
}

describe('#esm import', () => {
  it(
    'exports every name require sees',
    () => {
      const { stderr, result } = runModule(
        `import { createRequire } from 'module'\n` +
          `const ns = await import('${url}')\n` +
          `const cjs = createRequire('${url}')(${JSON.stringify(sdk.entry)})\n` +
          `console.log(JSON.stringify([Object.keys(cjs), Object.keys(ns)]))`,
        missingAddon
      )
      expect(stderr).toBe('')
      const [cjs, esm] = result as [string[], string[]]
      // Names the loader adds of its own accord.
      const added = new Set(['default', 'module.exports', '__esModule'])
      expect(cjs.length).toBeGreaterThan(0)
      expect(esm.filter((name) => !added.has(name)).sort()).toEqual(
        [...cjs].sort()
      )
    },
    TEST_TIMEOUT_MS
  )

  it(
    'imports the version constants by name',
    () => {
      const { stderr, result } = runModule(
        `import { ${NAMES.join(', ')} } from '${url}'\n` +
          `console.log(JSON.stringify([${NAMES.join(', ')}]))`,
        stubAddon
      )
      expect(stderr).toBe('')
      expect(result).toEqual(['v', 'v', 'm'])
    },
    TEST_TIMEOUT_MS
  )

  it(
    'imports without the addon, leaving the version constants undefined',
    () => {
      const { stderr, result } = runModule(
        `import { connect, Cluster, ${NAMES.join(', ')} } from '${url}'\n` +
          `console.log(JSON.stringify([typeof connect, typeof Cluster,` +
          ` ${NAMES.map((name) => `typeof ${name}`).join(', ')}]))`,
        missingAddon
      )
      expect(stderr).toBe('')
      expect(result).toEqual([
        'function',
        'function',
        'undefined',
        'undefined',
        'undefined',
      ])
    },
    TEST_TIMEOUT_MS
  )
})
