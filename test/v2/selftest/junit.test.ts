// The JUnit reporter, read back from a real run.
//
// The reporter sees the runner's record of a test after it finished, which
// nothing inside a test can observe, so a fixture with one test per outcome is
// run as a child process and the file it writes is checked.

import { execFileSync } from 'child_process'
import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { beforeAll, describe, expect, it } from 'vitest'

import { escapeXml } from '../reporters/junit'
import { packageBin } from '../infra/nodebin'
import { skipMessage } from '../infra/skips'

const V2_ROOT = join(import.meta.dirname, '..')
const FIXTURE = join(V2_ROOT, 'selftest', 'fixtures', 'junit')

function runFixture(): string {
  const dir = mkdtempSync(join(tmpdir(), 'cnjunit-'))
  const out = join(dir, 'junit.xml')
  try {
    try {
      execFileSync(
        process.execPath,
        [
          packageBin('vitest'),
          'run',
          '--config',
          join(FIXTURE, 'vitest.config.mts'),
        ],
        {
          cwd: join(V2_ROOT, '..', '..'),
          encoding: 'utf8',
          stdio: 'pipe',
          env: { ...process.env, CNJUNIT: out },
        }
      )
    } catch (err) {
      // The fixture fails on purpose, so a non-zero exit is expected. A
      // process that never started has no exit status and is rethrown.
      if (typeof (err as { status?: unknown }).status !== 'number') {
        throw err
      }
    }
    return readFileSync(out, 'utf8')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** The `<testcase>` element named `name`, whole, or undefined. */
function testcase(xml: string, name: string): string | undefined {
  const head = `name="${escapeXml(name)}"`
  const start = xml.indexOf(head)
  if (start < 0) {
    return undefined
  }
  const from = xml.lastIndexOf('<testcase', start)
  const selfClosed = xml.indexOf('/>', start)
  const opened = xml.indexOf('>', start)
  if (selfClosed === opened - 1) {
    return xml.slice(from, opened + 1)
  }
  return xml.slice(
    from,
    xml.indexOf('</testcase>', start) + '</testcase>'.length
  )
}

describe('the JUnit reporter', () => {
  let xml = ''

  beforeAll(() => {
    xml = runFixture()
  }, 120_000)

  const gateLine = skipMessage({
    kind: 'feature-missing',
    reason: "Feature 'xattr' requires Couchbase Server >= 5.0.0.",
    fields: { feature: 'xattr', required: '5.0.0' },
  })

  it('names a case by its whole title chain, under its file', () => {
    expect(testcase(xml, '#gated > declared with a gate')).toContain(
      'classname="outcomes.test.ts"'
    )
  })

  it.each([
    'declared with a gate',
    'declared with a gate and a timeout',
    'declared with a gate and options',
  ])('carries a gate reason onto a test %s', (title) => {
    expect(testcase(xml, `#gated > ${title}`)).toContain(
      `<skipped message="${escapeXml(gateLine)}"/>`
    )
  })

  it('carries a block reason onto every test beneath it', () => {
    expect(
      testcase(xml, '#skipped block > #nested > inherits the block reason')
    ).toMatch(
      /<skipped message="SKIP\[known-issue\] issue=fixture ticket=JSCBC-0000 /
    )
  })

  it('reports a skipped block inside a skipped block as a skip', () => {
    expect(
      testcase(xml, '#skipped block > #gated inside > is still a skip')
    ).toContain(`<skipped message="${escapeXml(gateLine)}"/>`)
  })

  it('writes a bare skip for a bare true', () => {
    expect(testcase(xml, '#gated > declared with a bare true')).toContain(
      '<skipped/>'
    )
  })

  it('runs a test whose condition is false', () => {
    expect(testcase(xml, '#gated > not skipped by false')).not.toContain(
      '<skipped'
    )
  })

  it('keeps the note a runtime skip gave', () => {
    expect(testcase(xml, 'skips at runtime')).toContain(
      '<skipped message="decided while running"/>'
    )
  })

  it('reports a todo as a skip', () => {
    expect(testcase(xml, 'is not written yet')).toContain(
      '<skipped message="todo"/>'
    )
  })

  it('reports a failure with its message', () => {
    expect(testcase(xml, 'fails')).toMatch(
      /<failure message="[^"]*expected 1 to be 2/
    )
  })

  it('marks an expected failure, which JUnit would read as a pass', () => {
    const c = testcase(xml, 'fails as expected')
    expect(c).toContain('<property name="expected-failure" value="true"/>')
    expect(c).not.toContain('<failure')
  })

  it('records the retries behind a pass', () => {
    const c = testcase(xml, 'passes on its second attempt')
    expect(c).toContain('<property name="retries" value="1"/>')
    expect(c).not.toContain('<failure')
  })

  it('escapes a title', () => {
    expect(xml).toContain(
      'name="escapes &lt;markup&gt; &amp; &quot;quotes&quot; in a title"'
    )
  })

  it('reports a failing hook as a failing case', () => {
    expect(testcase(xml, '#hook')).toMatch(/<failure message="the hook failed"/)
  })

  it('counts what it wrote', () => {
    const cases = xml.match(/<testcase /g)?.length ?? 0
    expect(xml).toMatch(new RegExp(`<testsuites [^>]*tests="${cases}"`))
  })

  it('records the wall clock of the whole run', () => {
    expect(xml).toMatch(/<testsuites [^>]*time="\d+\.\d{3}"/)
  })
})
