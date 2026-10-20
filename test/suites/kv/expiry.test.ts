import { describe, expect } from 'vitest'

import { Collection } from '../../../lib/collection'
import { GetResult, MutationResult } from '../../../lib/crudoptypes'
import {
  DocumentNotFoundError,
  InvalidArgumentError,
} from '../../../lib/errors'
import { LookupInMacro, LookupInSpec, MutateInSpec } from '../../../lib/sdspecs'
import { AssertCtx, withCtx } from '../../asserts/ctx'
import { expectThrows } from '../../asserts/errors'
import { ServerFeature } from '../../infra/capabilities'
import { TestEnv } from '../../infra/env'
import type { LimitationId } from '../../infra/limitations'
import { CollectionStrategy } from '../../infra/requirements'
import { skipOptions } from '../../infra/skips'
import { SuiteContext, defineSuite } from '../../infra/suite'

// One `defineSuite` per collection rather than `CollectionStrategy.Both`, so
// the top-level titles are `#default-collection` and `#named-collection`;
// `Both` would emit `#expiry (default)`.
//
// Every test owns its key and registers its removal with the env, which runs
// on the failure path too, so a failed teardown in one test cannot surface as
// a `DocumentExistsError` in another.

const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60
const FIFTY_YEARS_SECONDS = 50 * 365 * 24 * 60 * 60

// The server treats values <= 259200 (30 days) as relative to the current time,
// so the minimum expiry date is 259201, which is 1970-01-31T00:00:01Z.
const MIN_EXPIRY_DATE = new Date('1970-01-31T00:00:01Z')
// 2106-02-07T06:28:15Z in seconds (4294967295) is the max 32-bit unsigned
// integer and the server's max expiry.
const MAX_EXPIRY = 4294967295
const MAX_EXPIRY_DATE = new Date('2106-02-07T06:28:15Z')
const ZERO_SECOND_DATE = new Date('1970-01-31T00:00:00Z')

// Max 32-bit unsigned int is a special case for increment and decrement: the
// most they accept is 4294967294, which is 2106-02-07T06:28:14Z.
const MAX_EXPIRY_BINARY = MAX_EXPIRY - 1
const MAX_EXPIRY_DATE_BINARY = new Date('2106-02-07T06:28:14Z')

const DOC = { foo: 'bar' }

type Expiry = number | Date

/**
 * The option fields the matrix sends. `initial` is set only for the binary
 * counters, the one pair of methods whose options declare it.
 */
interface MatrixOptions {
  expiry?: Expiry
  initial?: number
}

/** Anything the matrix can return; `getAndTouch` gives a GetResult. */
type CasResult = MutationResult | GetResult

interface Method {
  readonly name: string
  readonly needsDoc: boolean
  /** `touch` and `getAndTouch` take expiry positionally, not in options. */
  readonly positionalExpiry: boolean
  /** Options every call needs whatever the expiry, e.g. `initial`. */
  readonly baseOptions: Readonly<MatrixOptions>
  /** The largest expiry this method accepts, and the same value as a Date. */
  readonly maxExpiry: number
  readonly maxExpiryDate: Date
  /**
   * A backend defect that stops this method carrying an expiry at all.
   * Consulted only by the blocks that send one: `#noExpiry` sends none, and
   * `#expiryInvalid` is rejected by the SDK before reaching the server.
   */
  readonly limitation?: LimitationId
  readonly call: (
    collection: Collection,
    key: string,
    options: MatrixOptions | undefined,
    expiry: Expiry | undefined
  ) => Promise<CasResult>
}

/**
 * The per-method describe for a block that sends an expiry. A backend can
 * implement a method and still refuse it an expiry, which `features` cannot
 * express: GoCAVES runs `mutateIn` but rejects its expiry field.
 */
function methodBlock(
  limited: SuiteContext['limited'],
  method: Method,
  name: string,
  body: () => void
): void {
  const gate = method.limitation !== undefined && limited(method.limitation)
  if (gate) {
    describe.skip(name, skipOptions(gate), body)
  } else {
    describe(name, body)
  }
}

const STANDARD_MAX = { maxExpiry: MAX_EXPIRY, maxExpiryDate: MAX_EXPIRY_DATE }
const BINARY_MAX = {
  maxExpiry: MAX_EXPIRY_BINARY,
  maxExpiryDate: MAX_EXPIRY_DATE_BINARY,
}

const MUTATION_METHODS: readonly Method[] = [
  {
    name: 'insert',
    needsDoc: false,
    positionalExpiry: false,
    baseOptions: {},
    ...STANDARD_MAX,
    call: (collection, key, options) => collection.insert(key, DOC, options),
  },
  {
    name: 'upsert',
    needsDoc: false,
    positionalExpiry: false,
    baseOptions: {},
    ...STANDARD_MAX,
    call: (collection, key, options) => collection.upsert(key, DOC, options),
  },
  {
    name: 'decrement',
    needsDoc: false,
    positionalExpiry: false,
    baseOptions: { initial: 10 },
    ...BINARY_MAX,
    call: (collection, key, options) =>
      collection.binary().decrement(key, 1, options),
  },
  {
    name: 'increment',
    needsDoc: false,
    positionalExpiry: false,
    baseOptions: { initial: 10 },
    ...BINARY_MAX,
    call: (collection, key, options) =>
      collection.binary().increment(key, 1, options),
  },
]

const UPDATE_METHODS: readonly Method[] = [
  {
    name: 'replace',
    needsDoc: true,
    positionalExpiry: false,
    baseOptions: {},
    ...STANDARD_MAX,
    call: (collection, key, options) => collection.replace(key, DOC, options),
  },
  {
    name: 'mutateIn',
    needsDoc: true,
    positionalExpiry: false,
    baseOptions: {},
    ...STANDARD_MAX,
    limitation: 'gocaves-mutatein-expiry',
    call: (collection, key, options) =>
      collection.mutateIn(key, [MutateInSpec.upsert('foo', 'world')], options),
  },
]

const TOUCH_METHODS: readonly Method[] = [
  {
    name: 'getAndTouch',
    needsDoc: true,
    positionalExpiry: true,
    baseOptions: {},
    ...STANDARD_MAX,
    call: (collection, key, _options, expiry) =>
      collection.getAndTouch(key, expiry as Expiry),
  },
  {
    name: 'touch',
    needsDoc: true,
    positionalExpiry: true,
    baseOptions: {},
    ...STANDARD_MAX,
    call: (collection, key, _options, expiry) =>
      collection.touch(key, expiry as Expiry),
  },
]

const ALL_METHODS: readonly Method[] = [
  ...MUTATION_METHODS,
  ...UPDATE_METHODS,
  ...TOUCH_METHODS,
]

/** A fresh options object per call; never one shared with a sibling test. */
function optionsFor(method: Method, expiry?: Expiry): MatrixOptions {
  const options: MatrixOptions = { ...method.baseOptions }
  if (expiry !== undefined) {
    options.expiry = expiry
  }
  return options
}

function invoke(
  collection: Collection,
  method: Method,
  key: string,
  expiry?: Expiry
): Promise<CasResult> {
  return method.positionalExpiry
    ? method.call(collection, key, undefined, expiry)
    : method.call(collection, key, optionsFor(method, expiry), undefined)
}

/**
 * A key for this test, removed by the env whichever way the test goes.
 * `#expiryInvalid` does not seed: validation raises before any request is
 * made, so whether the document exists cannot matter.
 */
async function keyFor(
  collection: Collection,
  env: TestEnv,
  seed: boolean
): Promise<string> {
  const key = env.key()
  env.registerCleanup(async () => {
    await collection.remove(key).catch(() => undefined)
  })
  if (seed) {
    await collection.upsert(key, DOC)
  }
  return key
}

/** Read through the subdoc macro, which is why this suite needs `Xattr`. */
async function readExpiry(
  collection: Collection,
  key: string
): Promise<number> {
  const res = await collection.lookupIn(key, [
    LookupInSpec.get(LookupInMacro.Expiry, { xattr: true }),
  ])
  return res.content[0].value as number
}

/**
 * Not `assertMutationResult`, because `getAndTouch` returns a `GetResult` and
 * the matrix gives every method one return type.
 */
function assertCasReported(res: CasResult, c: AssertCtx = {}): void {
  expect(res, withCtx('operation returned no result', c)).toBeDefined()
  expect(res.cas, withCtx('operation returned no cas', c)).toBeTruthy()
}

async function assertExpiryWithin(
  collection: Collection,
  key: string,
  low: number,
  high: number,
  c: AssertCtx = {}
): Promise<void> {
  const expiry = await readExpiry(collection, key)
  expect(
    expiry,
    withCtx(`expiry ${expiry} is below ${low}`, c)
  ).toBeGreaterThanOrEqual(low)
  expect(
    expiry,
    withCtx(`expiry ${expiry} is above ${high}`, c)
  ).toBeLessThanOrEqual(high)
}

async function assertExpiryEquals(
  collection: Collection,
  key: string,
  expected: number,
  c: AssertCtx = {}
): Promise<void> {
  const expiry = await readExpiry(collection, key)
  expect(expiry, withCtx(`expiry should be ${expected}`, c)).toStrictEqual(
    expected
  )
}

/**
 * A unix timestamp is not a supported expiry form. The SDK adds the current
 * epoch second to any value beyond 30 days, so a timestamp stores roughly
 * twice itself, and emits a warning. Both are asserted.
 */
async function runUnixTimestampCase(
  collection: Collection,
  env: TestEnv,
  method: Method,
  key: string,
  offsetSeconds: number
): Promise<void> {
  const ctx = env.ctx({ op: method.name, key })
  const before = Math.floor(Date.now() / 1000) - 3
  const expiryUnix = Math.floor(Date.now() / 1000) + offsetSeconds

  let warnings = 0
  const listener = () => {
    warnings += 1
  }
  process.on('warning', listener)
  try {
    const res = await invoke(collection, method, key, expiryUnix)
    assertCasReported(res, ctx)

    const after = Math.floor(Date.now() / 1000) + 3
    // `process.emitWarning` defers to `nextTick`, so the warning may not have
    // fired when the operation resolves. The expiry read's round trip makes the
    // count deterministic, and the listener cannot be removed any earlier.
    await assertExpiryWithin(
      collection,
      key,
      before + expiryUnix,
      expiryUnix + after,
      ctx
    )
    expect(
      warnings,
      withCtx('unsupported-expiry warnings emitted', ctx)
    ).toStrictEqual(1)
  } finally {
    process.removeListener('warning', listener)
  }
}

async function runInvalidCase(
  collection: Collection,
  env: TestEnv,
  method: Method,
  key: string,
  expiry: Expiry
): Promise<void> {
  await expectThrows(
    () => invoke(collection, method, key, expiry),
    InvalidArgumentError,
    undefined,
    env.ctx({ op: method.name, key })
  )
}

/** No expiry, `0`, and the zero instant all mean the same: never expire. */
async function runNoExpiryCase(
  collection: Collection,
  env: TestEnv,
  method: Method,
  key: string,
  expiry?: Expiry
): Promise<void> {
  const ctx = env.ctx({ op: method.name, key })
  const res = await invoke(collection, method, key, expiry)
  assertCasReported(res, ctx)
  await assertExpiryEquals(collection, key, 0, ctx)
}

/** A relative duration is stored as an instant that far ahead. */
async function runDurationCase(
  collection: Collection,
  env: TestEnv,
  method: Method,
  key: string,
  duration: number
): Promise<void> {
  const ctx = env.ctx({ op: method.name, key })
  const before = Math.floor(Date.now() / 1000) - 3

  const res = await invoke(collection, method, key, duration)
  assertCasReported(res, ctx)

  const after = Math.floor(Date.now() / 1000) + 3
  await assertExpiryWithin(
    collection,
    key,
    before + duration,
    duration + after,
    ctx
  )
}

/**
 * The largest duration this method safely takes.
 *
 * Regression guard (JSCBC-1495): held one second below `cap - now`, because
 * `parseExpiry` reads the clock again and one tick later the duration resolves
 * past the cap.
 */
async function runMaxDurationCase(
  collection: Collection,
  env: TestEnv,
  method: Method,
  key: string
): Promise<void> {
  const ctx = env.ctx({ op: method.name, key })
  const nowSeconds = Math.floor(Date.now() / 1000)
  const before = nowSeconds - 3
  const duration = method.maxExpiry - nowSeconds - 1

  const res = await invoke(collection, method, key, duration)
  assertCasReported(res, ctx)

  const after = Math.floor(Date.now() / 1000) + 3
  await assertExpiryWithin(
    collection,
    key,
    before + duration,
    duration + after,
    ctx
  )
}

/** A `Date` is stored as its own epoch second, give or take one. */
async function runInstantCase(
  collection: Collection,
  env: TestEnv,
  method: Method,
  key: string,
  offsetSeconds: number
): Promise<void> {
  const ctx = env.ctx({ op: method.name, key })
  const instant = new Date(Date.now() + offsetSeconds * 1000)
  const epochSeconds = Math.floor(instant.getTime() / 1000)

  const res = await invoke(collection, method, key, instant)
  assertCasReported(res, ctx)

  await assertExpiryWithin(
    collection,
    key,
    epochSeconds - 1,
    epochSeconds + 1,
    ctx
  )
}

/** A valid instant in the past: the document is gone by the time we look. */
async function runImmediateExpiryCase(
  collection: Collection,
  env: TestEnv,
  method: Method,
  key: string
): Promise<void> {
  const res = await invoke(collection, method, key, MIN_EXPIRY_DATE)
  assertCasReported(res, env.ctx({ op: method.name, key }))
  await expectThrows(
    () => collection.get(key),
    DocumentNotFoundError,
    undefined,
    env.ctx({ op: 'get', key })
  )
}

/** The method's maximum instant, stored verbatim. */
async function runMaxInstantCase(
  collection: Collection,
  env: TestEnv,
  method: Method,
  key: string
): Promise<void> {
  const ctx = env.ctx({ op: method.name, key })
  const res = await invoke(collection, method, key, method.maxExpiryDate)
  assertCasReported(res, ctx)
  await assertExpiryEquals(collection, key, method.maxExpiry, ctx)
}

const RELATIVE_CASES: readonly number[] = [
  1800, // 30 minutes
  THIRTY_DAYS_SECONDS - 1, // < 30 days
  THIRTY_DAYS_SECONDS, // == 30 days
  THIRTY_DAYS_SECONDS + 1, // > 30 days
  THIRTY_DAYS_SECONDS * 2, // == 60 days
]

const INSTANT_CASES: readonly number[] = [
  ...RELATIVE_CASES,
  FIFTY_YEARS_SECONDS, // 50 years
  FIFTY_YEARS_SECONDS + 1, // 50 years + 1 second
]

const INVALID_CASES: readonly Expiry[] = [
  -1, // negative
  // @ts-expect-error a string is not an Expiry
  '100', // not a number
  MAX_EXPIRY + 1, // greater than max expiry
  new Date('not a real date'), // invalid date
  new Date('1970-01-30T23:59:59Z'), // < min expiry Date
  new Date('2106-02-07T06:28:16Z'), // > max expiry Date
]

// Regression guard (JSCBC-1464): titles render dates as ISO, independent of
// the machine's timezone. An invalid date has no ISO form, so keeps `String()`.
function expiryTitle(expiry: Expiry): string {
  if (expiry instanceof Date && !isNaN(expiry.getTime())) {
    return expiry.toISOString()
  }
  return String(expiry)
}

const COLLECTION_AXES = [
  {
    name: 'default',
    strategy: CollectionStrategy.DefaultCollection,
    features: [],
  },
  {
    name: 'named',
    strategy: CollectionStrategy.Named,
    features: [ServerFeature.Collections],
  },
] as const

for (const axis of COLLECTION_AXES) {
  defineSuite(
    `#${axis.name}-collection`,
    {
      features: [ServerFeature.KeyValue, ServerFeature.Xattr, ...axis.features],
      collection: axis.strategy,
    },
    ({ test, limited }) => {
      describe('#expiry', () => {
        describe('#expiryUnixTimestamp', () => {
          for (const method of ALL_METHODS) {
            methodBlock(
              limited,
              method,
              `#expiryUnixTimestamp-${method.name}`,
              () => {
                for (const offset of RELATIVE_CASES) {
                  test(`executes w/ expiry=${offset} - ${method.name}`, async ({
                    collection,
                    env,
                  }) => {
                    const key = await keyFor(collection, env, method.needsDoc)
                    await runUnixTimestampCase(
                      collection,
                      env,
                      method,
                      key,
                      offset
                    )
                  })
                }
              }
            )
          }
        })

        describe('#expiryInvalid', () => {
          for (const method of ALL_METHODS) {
            describe(`#expiryInvalid-${method.name}`, () => {
              for (const expiry of INVALID_CASES) {
                test(`correctly handles invalid expiry (${expiryTitle(expiry)}) - ${method.name}`, async ({
                  collection,
                  env,
                }) => {
                  const key = await keyFor(collection, env, false)
                  await runInvalidCase(collection, env, method, key, expiry)
                })
              }
            })
          }
        })

        describe('#noExpiry', () => {
          for (const method of ALL_METHODS) {
            describe(`#noExpiry-${method.name}`, () => {
              // `touch` and `getAndTouch` take expiry as a required positional
              // argument, so they have no no-expiry form.
              if (!method.positionalExpiry) {
                test(`correctly executes with no expiry - ${method.name}`, async ({
                  collection,
                  env,
                }) => {
                  const key = await keyFor(collection, env, method.needsDoc)
                  await runNoExpiryCase(collection, env, method, key)
                })
              }

              test(`correctly executes with zero expiry - ${method.name}`, async ({
                collection,
                env,
              }) => {
                const key = await keyFor(collection, env, method.needsDoc)
                await runNoExpiryCase(collection, env, method, key, 0)
              })

              test(`correctly executes with zero instant date expiry - ${method.name}`, async ({
                collection,
                env,
              }) => {
                const key = await keyFor(collection, env, method.needsDoc)
                await runNoExpiryCase(
                  collection,
                  env,
                  method,
                  key,
                  ZERO_SECOND_DATE
                )
              })
            })
          }
        })

        describe('#expiryDuration', () => {
          for (const method of ALL_METHODS) {
            methodBlock(
              limited,
              method,
              `#expiryDuration-${method.name}`,
              () => {
                for (const duration of RELATIVE_CASES) {
                  test(`correctly executes w/ expiry as duration; expiry=${duration} - ${method.name}`, async ({
                    collection,
                    env,
                  }) => {
                    const key = await keyFor(collection, env, method.needsDoc)
                    await runDurationCase(
                      collection,
                      env,
                      method,
                      key,
                      duration
                    )
                  })
                }

                test(`correctly executes w/ max expiry duration - ${method.name}`, async ({
                  collection,
                  env,
                }) => {
                  const key = await keyFor(collection, env, method.needsDoc)
                  await runMaxDurationCase(collection, env, method, key)
                })
              }
            )
          }
        })

        describe('#expiryInstant', () => {
          for (const method of ALL_METHODS) {
            methodBlock(
              limited,
              method,
              `#expiryInstant-${method.name}`,
              () => {
                for (const offset of INSTANT_CASES) {
                  test(`correctly executes w/ expiry as Date; expiry=${offset} - ${method.name}`, async ({
                    collection,
                    env,
                  }) => {
                    const key = await keyFor(collection, env, method.needsDoc)
                    await runInstantCase(collection, env, method, key, offset)
                  })
                }

                test(`correctly executes w/ expiry=minExpiryDate (${MIN_EXPIRY_DATE.toISOString()}) - ${method.name}`, async ({
                  collection,
                  env,
                }) => {
                  const key = await keyFor(collection, env, method.needsDoc)
                  await runImmediateExpiryCase(collection, env, method, key)
                })

                // The title names MAX_EXPIRY_DATE for every method, though
                // increment and decrement pass MAX_EXPIRY_DATE_BINARY, one
                // second lower.
                test(`correctly executes w/ expiry=maxExpiryDate (${MAX_EXPIRY_DATE.toISOString()}) - ${method.name}`, async ({
                  collection,
                  env,
                }) => {
                  const key = await keyFor(collection, env, method.needsDoc)
                  await runMaxInstantCase(collection, env, method, key)
                })
              }
            )
          }
        })
      })
    }
  )
}
