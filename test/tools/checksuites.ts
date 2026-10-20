// The static check that keeps unit and integration tests separated, and keeps
// connections in fixtures.
//
// - **One kind per describe block.** A block whose tests take cluster fixtures
//   holds only such tests, so a cluster-free test never pays for the connect
//   hook, and a block with no cluster fixture provably needs no cluster.
// - **No connecting from a test body.** A `close()` at the end of a test is
//   skipped by any earlier failure; fixtures tear down on the failure path.
// - **Destructure your fixtures.** A context taken as one identifier makes the
//   first rule undecidable.
// - **No flushing.** It destroys documents other suites are using and does not
//   isolate the flusher from anything written after it; a lease is empty
//   because it is new. A `*.exclusive.test.ts` file may flush, because it
//   creates its own buckets and the flush API is its subject.
//
// Implemented over the syntax tree rather than the type checker, so it is fast
// and needs no program-wide resolution.

import { readFileSync, readdirSync, statSync } from 'fs'
import { extname, join, relative } from 'path'
import ts from 'typescript'

/** Fixtures that mean "this test needs a server". */
export const CLUSTER_FIXTURES: readonly string[] = [
  'env',
  'cluster',
  'collection',
  'collectionLease',
  'docs',
  'runState',
]

const TEST_CALLEES = new Set(['it', 'test'])
const SUITE_CALLEES = new Set(['describe', 'suite', 'defineSuite', 'group'])
const HOOK_CALLEES = new Set([
  'beforeAll',
  'beforeEach',
  'afterAll',
  'afterEach',
])

export type Rule =
  | 'mixed-kinds'
  | 'connect-in-test'
  | 'opaque-fixtures'
  | 'flush-in-suite'

export interface Violation {
  readonly file: string
  readonly line: number
  readonly rule: Rule
  readonly message: string
}

interface TestInfo {
  readonly title: string
  readonly line: number
  readonly fixtures: readonly string[]
  readonly opaqueContext: boolean
}

/** The root call of a chained test API, e.g. `test.skipIf(x)(...)`. */
function calleeName(node: ts.CallExpression): string | undefined {
  let expr: ts.Expression = node.expression
  for (;;) {
    if (ts.isIdentifier(expr)) {
      return expr.text
    }
    if (ts.isPropertyAccessExpression(expr)) {
      expr = expr.expression
      continue
    }
    if (ts.isCallExpression(expr)) {
      expr = expr.expression
      continue
    }
    return undefined
  }
}

/**
 * `it.each([...])('name', row => …)` and `it.for([...])` pass a data row, not a
 * test context, so their callback parameter says nothing about fixtures.
 */
function isDataDriven(node: ts.CallExpression): boolean {
  let expr: ts.Expression = node.expression
  for (;;) {
    if (ts.isCallExpression(expr)) {
      const inner = expr.expression
      if (
        ts.isPropertyAccessExpression(inner) &&
        (inner.name.text === 'each' || inner.name.text === 'for')
      ) {
        return true
      }
      expr = inner
      continue
    }
    if (ts.isPropertyAccessExpression(expr)) {
      if (expr.name.text === 'each' || expr.name.text === 'for') {
        return true
      }
      expr = expr.expression
      continue
    }
    return false
  }
}

function literalTitle(node: ts.CallExpression): string {
  const first = node.arguments[0]
  if (first && ts.isStringLiteralLike(first)) {
    return first.text
  }
  return '<dynamic>'
}

function callbackOf(
  node: ts.CallExpression
): ts.FunctionLikeDeclaration | undefined {
  for (const arg of node.arguments) {
    if (ts.isArrowFunction(arg) || ts.isFunctionExpression(arg)) {
      return arg
    }
  }
  return undefined
}

function fixturesOf(fn: ts.FunctionLikeDeclaration): {
  fixtures: string[]
  opaque: boolean
} {
  const param = fn.parameters[0]
  if (!param) {
    return { fixtures: [], opaque: false }
  }
  if (ts.isObjectBindingPattern(param.name)) {
    const fixtures: string[] = []
    for (const element of param.name.elements) {
      const name = element.propertyName ?? element.name
      if (ts.isIdentifier(name)) {
        fixtures.push(name.text)
      }
    }
    return { fixtures, opaque: false }
  }
  return { fixtures: [], opaque: true }
}

function isClusterTest(info: TestInfo): boolean {
  return info.fixtures.some((f) => CLUSTER_FIXTURES.includes(f))
}

export function checkSource(fileName: string, text: string): Violation[] {
  const source = ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    true
  )
  const violations: Violation[] = []
  const lineOf = (node: ts.Node): number =>
    source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1

  /**
   * Walks one block's body, collecting the tests declared *directly* in it.
   * Nested describes are checked on their own, which is what makes the rule
   * usable: an integration describe may contain a unit describe, just not a
   * unit test as a sibling of an integration one.
   */
  const checkBlock = (
    blockTitle: string,
    body: ts.Node,
    isSuiteBody: boolean
  ): void => {
    const tests: TestInfo[] = []

    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        const callee = calleeName(node)

        if (callee && SUITE_CALLEES.has(callee)) {
          const fn = callbackOf(node)
          if (fn?.body) {
            checkBlock(literalTitle(node), fn.body, true)
          }
          return
        }

        if (callee && TEST_CALLEES.has(callee)) {
          const fn = callbackOf(node)
          const dataDriven = isDataDriven(node)
          const { fixtures, opaque } =
            fn && !dataDriven ? fixturesOf(fn) : { fixtures: [], opaque: false }
          tests.push({
            title: literalTitle(node),
            line: lineOf(node),
            fixtures,
            opaqueContext: opaque,
          })
          if (opaque) {
            violations.push({
              file: fileName,
              line: lineOf(node),
              rule: 'opaque-fixtures',
              message:
                `Test '${literalTitle(node)}' takes its context as a single ` +
                'parameter. Destructure the fixtures it uses instead: the ' +
                'parameter list is how a test declares whether it needs a ' +
                'server, and an opaque context makes that undecidable.',
            })
          }
          if (fn?.body) {
            checkForConnect(fn.body, `test '${literalTitle(node)}'`)
          }
          return
        }

        if (callee && HOOK_CALLEES.has(callee)) {
          const fn = callbackOf(node)
          if (fn?.body) {
            checkForConnect(fn.body, `${callee} hook`)
          }
          return
        }
      }
      ts.forEachChild(node, visit)
    }

    const checkForConnect = (body: ts.Node, where: string): void => {
      const scan = (node: ts.Node): void => {
        if (ts.isCallExpression(node)) {
          const text = node.expression.getText(source)
          if (/(^|\.)connect$/.test(text) && !/env\.openCluster/.test(text)) {
            violations.push({
              file: fileName,
              line: lineOf(node),
              rule: 'connect-in-test',
              message:
                `${where} calls ${text}(...). Connections come from a fixture, ` +
                'or from env.openCluster() which the env closes for you: a ' +
                'connection opened in a test body is left open by any failure ' +
                'before its close().',
            })
          }
        }
        ts.forEachChild(node, scan)
      }
      scan(body)
    }

    ts.forEachChild(body, visit)

    if (!isSuiteBody) {
      return
    }

    const cluster = tests.filter(isClusterTest)
    const unit = tests.filter((t) => !isClusterTest(t) && !t.opaqueContext)
    if (cluster.length > 0 && unit.length > 0) {
      violations.push({
        file: fileName,
        line: unit[0].line,
        rule: 'mixed-kinds',
        message:
          `Block '${blockTitle}' mixes kinds: ` +
          `${cluster.length} test(s) take cluster fixtures ` +
          `(e.g. '${cluster[0].title}') and ${unit.length} take none ` +
          `(e.g. '${unit[0].title}'). Split them into separate blocks, so a ` +
          'cluster-free block can run with no server at all.',
      })
    }
  }

  // A file that creates buckets of its own says so in its name, and may flush
  // one. See the rule's statement at the top of this file.
  const ownsItsBuckets = /\.exclusive\.test\.tsx?$/.test(fileName)

  const checkForFlush = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && !ownsItsBuckets) {
      const text = node.expression.getText(source)
      if (/(^|\.)flushBucket$/.test(text)) {
        violations.push({
          file: fileName,
          line: lineOf(node),
          rule: 'flush-in-suite',
          message:
            `Calls ${text}(...). Flushing is what leases replace: a suite ` +
            'needing a clean slate declares CollectionStrategy.Named and ' +
            'gets a collection that is empty because it was just created. ' +
            'Flushing the shared bucket destroys documents other suites are ' +
            'using, and does not isolate this one from anything created after ' +
            'it. A suite whose subject is the flush API itself names its file ' +
            '*.exclusive.test.ts and flushes a bucket it created.',
        })
      }
    }
    ts.forEachChild(node, checkForFlush)
  }

  // Walked over the whole file rather than per block: a flush inside a helper
  // function below the suite is the same defect as one inside a hook, and the
  // block walk would not reach it.
  checkForFlush(source)

  checkBlock('<file>', source, false)
  return violations
}

/** Every `.ts` file under `dir`, recursively. */
export function collectFiles(dir: string): string[] {
  const found: string[] = []
  const walk = (current: string): void => {
    for (const entry of readdirSync(current)) {
      if (entry === 'node_modules' || entry.startsWith('.')) {
        continue
      }
      const full = join(current, entry)
      if (statSync(full).isDirectory()) {
        walk(full)
      } else if (extname(full) === '.ts') {
        found.push(full)
      }
    }
  }
  walk(dir)
  return found
}

export function checkTree(roots: readonly string[], base: string): Violation[] {
  const violations: Violation[] = []
  for (const root of roots) {
    for (const file of collectFiles(root)) {
      violations.push(
        ...checkSource(relative(base, file), readFileSync(file, 'utf8'))
      )
    }
  }
  return violations
}

export function formatViolations(violations: readonly Violation[]): string {
  return violations
    .map((v) => `${v.file}:${v.line} [${v.rule}] ${v.message}`)
    .join('\n\n')
}
