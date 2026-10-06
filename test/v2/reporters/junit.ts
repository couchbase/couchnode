// JUnit XML for CI, adding what Vitest's own JUnit reporter leaves out:
//
// - each `<skipped>` carries the skip line (`infra/skips.ts`) as its message;
// - `classname` is the file and `name` the whole title chain joined with
//   ` > `, which is unique within a file;
// - a pass on retry and a `test.fails` are marked with `retries` and
//   `expected-failure` properties;
// - the root `time` is the wall clock, since files run in parallel.
//
// Hook and load failures are failing cases, so the file agrees with the exit
// code. Enabled by `CNJUNIT=<path>`; see `vitest.config.mts`.

import { mkdirSync, writeFileSync } from 'fs'
import { hostname } from 'os'
import { dirname, resolve } from 'path'
import { stripVTControlCharacters } from 'util'

import type {
  Reporter,
  SerializedError,
  TestCase,
  TestModule,
  TestSuite,
  Vitest,
} from 'vitest/node'

import type {} from '../infra/skips'

export interface JUnitOptions {
  /** Where to write the file, relative to the Vitest root. */
  readonly outputFile: string
}

interface Case {
  readonly name: string
  readonly seconds: number
  readonly skipped?: string
  readonly failures: readonly SerializedError[]
  readonly properties: readonly (readonly [string, string])[]
}

/** The title chain under the module, outermost first. */
export function titleChain(entity: TestCase | TestSuite): string[] {
  const titles: string[] = []
  let current: TestCase | TestSuite | TestModule = entity
  while (current.type !== 'module') {
    titles.unshift(current.name)
    current = current.parent
  }
  return titles
}

/** Text safe inside an XML attribute or element, which ANSI color is not. */
export function escapeXml(text: string): string {
  return (
    stripVTControlCharacters(text)
      // XML 1.0 has no representation for these at all, escaped or not.
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  )
}

function seconds(ms: number | undefined): number {
  return (ms ?? 0) / 1000
}

function skipMessage(test: TestCase): string {
  const reason = test.meta().skipReason
  if (reason) {
    return reason
  }
  const result = test.result()
  if (result.state === 'skipped' && result.note) {
    return result.note
  }
  return test.options.mode === 'todo' ? 'todo' : ''
}

export function caseFor(test: TestCase): Case {
  const result = test.result()
  const diagnostic = test.diagnostic()
  const properties: [string, string][] = []
  if (diagnostic && diagnostic.retryCount > 0) {
    properties.push(['retries', String(diagnostic.retryCount)])
  }
  if (test.options.fails) {
    properties.push(['expected-failure', 'true'])
  }
  return {
    name: titleChain(test).join(' > '),
    seconds: seconds(diagnostic?.duration),
    skipped: result.state === 'skipped' ? skipMessage(test) : undefined,
    failures: result.state === 'failed' ? result.errors : [],
    properties,
  }
}

/** A suite or module whose own hooks failed, as one failing case. */
function hookCase(
  entity: TestSuite | TestModule,
  errors: readonly SerializedError[]
): Case {
  return {
    name:
      entity.type === 'module'
        ? entity.relativeModuleId
        : titleChain(entity).join(' > '),
    seconds: 0,
    failures: errors,
    properties: [],
  }
}

export function casesFor(module: TestModule): Case[] {
  const cases = [...module.children.allTests()].map(caseFor)
  for (const suite of module.children.allSuites()) {
    if (suite.errors().length > 0) {
      cases.push(hookCase(suite, suite.errors()))
    }
  }
  if (module.errors().length > 0) {
    cases.push(hookCase(module, module.errors()))
  }
  return cases
}

function failureXml(error: SerializedError): string {
  const message = error.message ?? ''
  const body = [error.stack ?? message, error.diff].filter(Boolean).join('\n\n')
  return (
    `      <failure message="${escapeXml(message)}" ` +
    `type="${escapeXml(error.name ?? 'Error')}">${escapeXml(body)}</failure>`
  )
}

export function caseXml(classname: string, c: Case): string {
  const open =
    `    <testcase classname="${escapeXml(classname)}" ` +
    `name="${escapeXml(c.name)}" time="${c.seconds.toFixed(3)}"`
  const children: string[] = []
  if (c.properties.length > 0) {
    children.push('      <properties>')
    for (const [name, value] of c.properties) {
      children.push(
        `        <property name="${escapeXml(name)}" value="${escapeXml(value)}"/>`
      )
    }
    children.push('      </properties>')
  }
  if (c.skipped !== undefined) {
    children.push(
      c.skipped
        ? `      <skipped message="${escapeXml(c.skipped)}"/>`
        : '      <skipped/>'
    )
  }
  children.push(...c.failures.map(failureXml))
  if (children.length === 0) {
    return `${open}/>`
  }
  return [`${open}>`, ...children, '    </testcase>'].join('\n')
}

export function suiteXml(
  name: string,
  cases: readonly Case[],
  duration: number,
  host: string,
  timestamp: string
): string {
  const failures = cases.filter((c) => c.failures.length > 0).length
  const skipped = cases.filter((c) => c.skipped !== undefined).length
  return [
    `  <testsuite name="${escapeXml(name)}" timestamp="${timestamp}" ` +
      `hostname="${escapeXml(host)}" tests="${cases.length}" ` +
      `failures="${failures}" errors="0" skipped="${skipped}" ` +
      `time="${duration.toFixed(3)}">`,
    ...cases.map((c) => caseXml(name, c)),
    '  </testsuite>',
  ].join('\n')
}

export default class JUnitReporter implements Reporter {
  private root = process.cwd()
  private started = Date.now()

  constructor(private readonly options: JUnitOptions) {}

  onInit(vitest: Vitest): void {
    this.root = vitest.config.root
    this.started = Date.now()
  }

  onTestRunEnd(
    modules: ReadonlyArray<TestModule>,
    unhandled: ReadonlyArray<SerializedError>
  ): void {
    const host = hostname()
    const timestamp = new Date().toISOString()
    const suites = modules.map((module) => {
      const cases = casesFor(module)
      return {
        xml: suiteXml(
          module.relativeModuleId,
          cases,
          seconds(module.diagnostic().duration),
          host,
          timestamp
        ),
        cases,
      }
    })
    // An error thrown outside any test, after its test finished, fails the run
    // without belonging to any module; it gets a suite of its own so the file
    // agrees with the exit code.
    if (unhandled.length > 0) {
      const cases = [
        {
          name: 'unhandled errors',
          seconds: 0,
          failures: unhandled,
          properties: [],
        },
      ]
      suites.push({
        xml: suiteXml('(unhandled)', cases, 0, host, timestamp),
        cases,
      })
    }
    const all = suites.flatMap((s) => s.cases)
    const failures = all.filter((c) => c.failures.length > 0).length
    const skipped = all.filter((c) => c.skipped !== undefined).length
    const xml = [
      '<?xml version="1.0" encoding="UTF-8" ?>',
      `<testsuites name="vitest tests" tests="${all.length}" ` +
        `failures="${failures}" errors="0" skipped="${skipped}" ` +
        `time="${((Date.now() - this.started) / 1000).toFixed(3)}">`,
      ...suites.map((s) => s.xml),
      '</testsuites>',
      '',
    ].join('\n')
    const file = resolve(this.root, this.options.outputFile)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, xml)
  }
}
