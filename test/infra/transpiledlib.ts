// The SDK compiled as the package ships it, one CommonJS file per module, for
// a test that has to load it outside Vitest: through Node's ESM loader, or
// through a module loader of the test's own. Each file is transpiled alone
// with the package's compiler options and no type check, so this costs a
// fraction of a build.

import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs'
import { dirname, join } from 'path'

import ts from 'typescript'

const ROOT = join(import.meta.dirname, '..', '..')

/** A transpiled copy of `lib/`. */
export interface TranspiledLib {
  /** The copy's `lib/` directory. */
  lib: string
  /** The copy's entry point, `couchbase.js`. */
  entry: string
  /** Deletes the copy. */
  remove(): void
}

/**
 * Transpiles `lib/` into a fresh directory. The directory sits under the
 * package's `node_modules`, so the copy's requires of the SDK's dependencies
 * resolve as the package's own do.
 */
export function transpileLib(): TranspiledLib {
  const config = ts.readConfigFile(join(ROOT, 'tsconfig.json'), ts.sys.readFile)
  const { options } = ts.parseJsonConfigFileContent(config.config, ts.sys, ROOT)

  const cache = join(ROOT, 'node_modules', '.cache')
  mkdirSync(cache, { recursive: true })
  // Real, so a path the copy's own modules resolve to starts with it.
  const dir = realpathSync(mkdtempSync(join(cache, 'cblib-')))
  writeFileSync(join(dir, 'package.json'), '{ "type": "commonjs" }\n')

  const src = join(ROOT, 'lib')
  const lib = join(dir, 'lib')
  for (const file of readdirSync(src, { recursive: true, encoding: 'utf8' })) {
    const from = join(src, file)
    if (!statSync(from).isFile()) {
      continue
    }
    mkdirSync(dirname(join(lib, file)), { recursive: true })
    if (!file.endsWith('.ts') || file.endsWith('.d.ts')) {
      copyFileSync(from, join(lib, file))
      continue
    }
    const { outputText } = ts.transpileModule(readFileSync(from, 'utf8'), {
      compilerOptions: options,
      fileName: from,
    })
    writeFileSync(join(lib, file.replace(/\.ts$/, '.js')), outputText)
  }

  return {
    lib,
    entry: join(lib, 'couchbase.js'),
    remove: () => rmSync(dir, { recursive: true, force: true }),
  }
}
