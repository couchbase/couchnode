// Not `npx`: on Windows it is `npx.cmd`, which `execFileSync` cannot spawn
// without a shell (`ENOENT`), and a shell means `cmd.exe` quoting. Running the
// bin script with `process.execPath` avoids both and pins the child to the
// run's own Node.

import { createRequire } from 'module'
import { dirname, join } from 'path'

const requireCjs = createRequire(import.meta.url)

/**
 * The script `pkg` installs as its `bin` command `name`, resolved the way
 * `require` would, so a hoisted install and a nested one both work.
 */
export function packageBin(pkg: string, name: string = pkg): string {
  const manifest = requireCjs.resolve(`${pkg}/package.json`)
  const { bin } = requireCjs(manifest) as {
    bin?: string | Record<string, string>
  }
  const script = typeof bin === 'string' ? bin : bin?.[name]
  if (script === undefined) {
    throw new Error(`${pkg} has no bin entry named '${name}'`)
  }
  return join(dirname(manifest), script)
}
