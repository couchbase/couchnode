import EventEmitter from 'events'
import { describe, expect, it } from 'vitest'

import {
  CouchbaseError,
  DocumentNotFoundError,
  InvalidArgumentError,
  ParsingFailureError,
} from '../../../../lib/errors'
import {
  QueryMetaData,
  QueryResult,
  QueryStatus,
} from '../../../../lib/querytypes'
import {
  StreamablePromise,
  StreamableReplicasPromise,
  StreamableRowPromise,
  StreamableScanPromise,
} from '../../../../lib/streamablepromises'
import { PromiseHelper } from '../../../../lib/utilities'
import { expectCouchbaseError } from '../../asserts/errors'
import { watchRejections } from '../../infra/rejections'

const ROWS = [
  {
    id: 10,
    type: 'airline',
    name: '40-Mile Air',
    iata: 'Q5',
    icao: 'MLA',
    callsign: 'MILE-AIR',
    country: 'United States',
  },
  {
    id: 10123,
    type: 'airline',
    name: 'Texas Wings',
    iata: 'TQ',
    icao: 'TXW',
    callsign: 'TXW',
    country: 'UnitedStates',
  },
  {
    id: 10226,
    type: 'airline',
    name: 'Atifly',
    iata: 'A1',
    icao: 'A1F',
    callsign: 'atifly',
    country: 'United States',
  },
  {
    id: 10642,
    type: 'airline',
    name: 'Jc royal.britannica',
    iata: null,
    icao: 'JRB',
    callsign: null,
    country: 'United Kingdom',
  },
  {
    id: 10748,
    type: 'airline',
    name: 'Locair',
    iata: 'ZQ',
    icao: 'LOC',
    callsign: 'LOCAIR',
    country: 'United States',
  },
  {
    id: 10765,
    type: 'airline',
    name: 'SeaPort Airlines',
    iata: 'K5',
    icao: 'SQH',
    callsign: 'SASQUATCH',
    country: 'United States',
  },
  {
    id: 109,
    type: 'airline',
    name: 'Alaska Central Express',
    iata: 'KO',
    icao: 'AER',
    callsign: 'ACE AIR',
    country: 'United States',
  },
  {
    id: 112,
    type: 'airline',
    name: 'Astraeus',
    iata: '5W',
    icao: 'AEU',
    callsign: 'FLYSTAR',
    country: 'United Kingdom',
  },
  {
    id: 1191,
    type: 'airline',
    name: 'Air Austral',
    iata: 'UU',
    icao: 'REU',
    callsign: 'REUNION',
    country: 'France',
  },
  {
    id: 1203,
    type: 'airline',
    name: 'Airlinair',
    iata: 'A5',
    icao: 'RLA',
    callsign: 'AIRLINAIR',
    country: 'France',
  },
]

// `warnings` is required by the declared type, though no assertion reads it.
const META = new QueryMetaData({
  requestId: 'c675ce2a-31b7-4531-bb69-574f66ce464f',
  clientContextId: '125a63-df8e-3f47-7d10-f68dd7e9108c89',
  status: QueryStatus.Success,
  signature: { '*': '*' },
  warnings: [],
})

/** Time before the first event, standing in for a request starting up. */
const START_DELAY_MS = 10
/** Gap between events when the driver is streaming them one at a time. */
const STREAM_STEP_MS = 5
/**
 * How long a promise is watched to establish it is *not* going to settle. A few
 * turns suffice: the driver's script has been emitted and the listeners that
 * could settle it are gone.
 */
const PENDING_WINDOW_MS = 25

type Emission = readonly [event: string, payload?: unknown]

/**
 * The emitter's own clock, so a test says *when* it acts rather than sleeping
 * long enough to be fairly sure.
 */
interface Driver {
  /** Resolves once `count` events have been emitted. */
  after(count: number): Promise<void>
  readonly drained: Promise<void>
}

function drive(
  emitter: EventEmitter,
  script: readonly Emission[],
  streaming: boolean
): Driver {
  let emitted = 0
  const waiters: { count: number; resolve: () => void }[] = []

  const settleWaiters = (): void => {
    for (let i = waiters.length - 1; i >= 0; --i) {
      if (waiters[i].count <= emitted) {
        waiters.splice(i, 1)[0].resolve()
      }
    }
  }

  const emitOne = (): void => {
    const [event, payload] = script[emitted]
    ++emitted
    if (payload === undefined) {
      emitter.emit(event)
    } else {
      emitter.emit(event, payload)
    }
    settleWaiters()
  }

  const step = (): void => {
    if (emitted >= script.length) {
      return
    }
    emitOne()
    setTimeout(step, STREAM_STEP_MS)
  }

  const burst = (): void => {
    // Non-streaming is the production case, not a simplification of it: the C++
    // core hands the whole response over at once, so every event arrives in a
    // single synchronous run and a listener registered afterwards sees nothing.
    while (emitted < script.length) {
      emitOne()
    }
  }

  setTimeout(streaming ? step : burst, START_DELAY_MS)

  const drained = new Promise<void>((resolve) => {
    waiters.push({ count: script.length, resolve })
  })

  return {
    drained,
    after: (count) =>
      new Promise<void>((resolve) => {
        if (emitted >= count) {
          resolve()
          return
        }
        waiters.push({ count, resolve })
      }),
  }
}

/**
 * A `StreamablePromise` subclass that keeps what its internal listeners saw.
 *
 * `_depromisify()` removes those listeners the moment a caller registers its
 * own, so the split between these fields and what the caller collects is
 * exactly the boundary the caching test is about.
 */
class CachingRowPromise extends StreamablePromise<QueryResult> {
  _rows: unknown[] = []
  _meta: QueryMetaData | undefined

  constructor() {
    super((emitter, resolve, reject) => {
      let err: Error | undefined
      emitter.on('row', (r) => this._rows.push(r))
      emitter.on('meta', (m) => (this._meta = m))
      emitter.on('error', (e) => (err = e))
      emitter.on('end', () => {
        if (err) {
          return reject(err)
        }
        resolve(
          new QueryResult({
            rows: this._rows,
            meta: this._meta as QueryMetaData,
          })
        )
      })
    })
  }
}

interface Built {
  readonly promise: StreamablePromise<unknown>
  readonly driver: Driver
}

interface BuildConfig {
  readonly streaming?: boolean
  readonly withError?: boolean
}

interface StreamKind {
  /** The describe block's name, which is also the class under test. */
  readonly block: string
  /** The event carrying one item of the result set. */
  readonly event: string
  readonly error: new () => CouchbaseError
  readonly hasMeta: boolean
  build(config?: BuildConfig): Built
  /** The result set inside whatever the promise resolved to. */
  itemsOf(value: unknown): unknown[]
}

/** `[...items, meta?, end]`, or the error pair when the stream fails. */
function scriptFor(
  event: string,
  hasMeta: boolean,
  error: Error | undefined
): Emission[] {
  if (error) {
    // A queued error is emitted before anything else, so a failing stream
    // produces no items at all.
    return [['error', error], ['end']]
  }
  const script: Emission[] = ROWS.map((row) => [event, row] as Emission)
  if (hasMeta) {
    script.push(['meta', META])
  }
  script.push(['end'])
  return script
}

function buildWith(
  kind: Omit<StreamKind, 'build'>,
  create: () => StreamablePromise<unknown>,
  config: BuildConfig
): Built {
  const promise = create()
  const error = config.withError ? new kind.error() : undefined
  return {
    promise,
    driver: drive(
      promise,
      scriptFor(kind.event, kind.hasMeta, error),
      config.streaming ?? false
    ),
  }
}

function kindOf(
  spec: Omit<StreamKind, 'build'>,
  create: () => StreamablePromise<unknown>
): StreamKind {
  return { ...spec, build: (config = {}) => buildWith(spec, create, config) }
}

const ROW_KIND = kindOf(
  {
    block: '#streamablerowpromise',
    event: 'row',
    error: ParsingFailureError,
    hasMeta: true,
    itemsOf: (value) => (value as QueryResult).rows,
  },
  () =>
    new StreamableRowPromise<QueryResult, unknown, QueryMetaData>(
      (rows, meta) => new QueryResult({ rows, meta })
    )
)

const REPLICA_KIND = kindOf(
  {
    block: '#streamablereplicapromise',
    event: 'replica',
    error: DocumentNotFoundError,
    hasMeta: false,
    itemsOf: (value) => value as unknown[],
  },
  () =>
    new StreamableReplicasPromise<unknown[], unknown>((replicas) => replicas)
)

const SCAN_KIND = kindOf(
  {
    block: '#streamablescanpromise',
    event: 'result',
    error: InvalidArgumentError,
    hasMeta: false,
    itemsOf: (value) => value as unknown[],
  },
  () => new StreamableScanPromise<unknown[], unknown>((results) => results)
)

const KINDS = [ROW_KIND, REPLICA_KIND, SCAN_KIND]
const STREAMING_TYPES = ['streaming', 'non-streaming'] as const

interface Streamed {
  readonly items: unknown[]
  readonly meta: QueryMetaData | undefined
}

/** Consumes a streamable as an event emitter, the way an application would. */
function streamAll(
  promise: StreamablePromise<unknown>,
  event: string
): Promise<Streamed> {
  return new Promise<Streamed>((resolve, reject) => {
    const items: unknown[] = []
    let meta: QueryMetaData | undefined
    promise
      .on(event, (item) => items.push(item))
      .on('meta', (m) => (meta = m))
      .on('end', () => resolve({ items, meta }))
      .on('error', (err) => reject(err))
  })
}

/**
 * Registers listeners and nothing else, which is all it takes to depromisify.
 * No wrapping promise, which would itself leak a rejection on the error event.
 */
function attachListeners(
  promise: StreamablePromise<unknown>,
  event: string
): void {
  promise
    .on(event, () => undefined)
    .on('meta', () => undefined)
    .on('end', () => undefined)
    .on('error', () => undefined)
}

/** Resolves to `false` if `promise` settles within the window, else `true`. */
async function staysPending(promise: Promise<unknown>): Promise<boolean> {
  const pending = Symbol('pending')
  const settled = await Promise.race([
    promise.then(
      () => 'resolved',
      () => 'rejected'
    ),
    new Promise((resolve) =>
      setTimeout(() => resolve(pending), PENDING_WINDOW_MS)
    ),
  ])
  return settled === pending
}

describe('streamablepromise', () => {
  for (const kind of KINDS) {
    describe(kind.block, () => {
      for (const streamingType of STREAMING_TYPES) {
        const streaming = streamingType === 'streaming'

        it(`should return resolved promise (${streamingType})`, async () => {
          const value = await kind.build({ streaming }).promise

          const items = kind.itemsOf(value)
          expect(Array.isArray(items)).toBe(true)
          expect(items).toHaveLength(ROWS.length)
          if (kind.hasMeta) {
            expect(value).toBeInstanceOf(QueryResult)
            expect((value as QueryResult).meta).toBeInstanceOf(QueryMetaData)
          }
        })

        it(`should return promise and resolve after delayed await (${streamingType})`, async () => {
          const { promise, driver } = kind.build({ streaming })
          // The stream is over before anything awaits, so the promise has to
          // have held its result rather than needing a live listener.
          await driver.drained
          const value = await promise

          const items = kind.itemsOf(value)
          expect(Array.isArray(items)).toBe(true)
          expect(items).toHaveLength(ROWS.length)
          if (kind.hasMeta) {
            expect(value).toBeInstanceOf(QueryResult)
            expect((value as QueryResult).meta).toBeInstanceOf(QueryMetaData)
          }
        })

        it(`should process rows via event emitter (${streamingType})`, async () => {
          // Regression guard (JSCBC-1450): built with `streamingType`'s pacing,
          // so the streaming case exercises the streaming path.
          const { promise } = kind.build({ streaming })
          const streamed = await streamAll(promise, kind.event)

          expect(Array.isArray(streamed.items)).toBe(true)
          expect(streamed.items).toHaveLength(ROWS.length)
          if (kind.hasMeta) {
            expect(streamed.meta).toBeInstanceOf(QueryMetaData)
          }
        })
      }

      describe('#delayedemitter', () => {
        if (kind === ROW_KIND) {
          it('should stop caching rows after event registration', async () => {
            const promise = new CachingRowPromise()
            const driver = drive(
              promise,
              scriptFor('row', true, undefined),
              true
            )

            // Mid-stream: three rows have arrived and the rest, plus the meta,
            // have not.
            await driver.after(3)

            const streamed = await streamAll(promise, 'row')

            expect(streamed.items.length + promise._rows.length).toBe(
              ROWS.length
            )
            expect(streamed.meta).toBeTruthy()
            // The internal listeners were removed before the meta was emitted,
            // so the cache never saw it.
            expect(promise._meta).toBeUndefined()
          })
        }

        // Registering after the response has been handed over means the events
        // are already gone, so a promise built from those listeners never
        // settles (see `burst` in `drive`), hence "timeout".
        it('Should timeout if event emitter registration is delayed', async () => {
          const { promise, driver } = kind.build()
          await driver.drained

          const items: unknown[] = []
          let meta: QueryMetaData | undefined
          const streamed = new Promise((resolve, reject) => {
            promise
              .on(kind.event, (item) => items.push(item))
              .on('meta', (m) => (meta = m))
              .on('end', () => resolve({ items, meta }))
              .on('error', (err) => reject(err))
          })

          expect(await staysPending(streamed)).toBe(true)
          expect(items).toHaveLength(0)
          // Regression guard (JSCBC-1451): reads the live `meta` variable, so a
          // meta arriving during the wait is observed.
          expect(meta).toBeUndefined()
        })

        it('Should timeout if event emitter registration is delayed (stream error)', async () => {
          await watchRejections(async (rejections) => {
            const { promise, driver } = kind.build({ withError: true })
            await driver.drained

            const items: unknown[] = []
            const streamed = new Promise((resolve, reject) => {
              promise
                .on(kind.event, (item) => items.push(item))
                .on('end', () => resolve(items))
                .on('error', (err) => reject(err))
            })

            expect(await staysPending(streamed)).toBe(true)
            expect(items).toHaveLength(0)
            // The internal listeners rejected the promise before anything
            // registered, and nothing was ever in a position to handle it.
            expect(await rejections.settle()).toBe(1)
          })
        })
      })

      describe('#error', () => {
        it('should return rejected promise', async () => {
          await watchRejections(async (rejections) => {
            let handled = 0
            // The handler is attached before the stream starts, which is what
            // keeps this off the unhandled-rejection path.
            const caught = await kind
              .build({ withError: true })
              .promise.catch((err: unknown) => {
                ++handled
                return err
              })

            expect(caught).toBeInstanceOf(kind.error)
            expect(handled).toBe(1)
            expect(await rejections.settle()).toBe(0)
          })
        })

        it('should return promise and reject after delayed await', async () => {
          await watchRejections(async (rejections) => {
            const { promise, driver } = kind.build({ withError: true })
            await driver.drained

            // Settled before the await, and the order is the point: awaiting
            // first would attach a handler in time, and the rejection would
            // never have been unhandled.
            expect(await rejections.settle()).toBe(1)

            let handled = 0
            const caught = await promise.catch((err: unknown) => {
              ++handled
              return err
            })
            expect(caught).toBeInstanceOf(kind.error)
            expect(handled).toBe(1)
          })
        })

        it('should raise unhandled rejection if not awaited', async () => {
          await watchRejections(async (rejections) => {
            // Building must not throw: the failure has to arrive as a
            // rejection, which is the only route by which it can go unhandled.
            let built: Built | undefined
            expect(() => {
              built = kind.build({ withError: true })
            }).not.toThrow()
            await built?.driver.drained

            expect(await rejections.settle()).toBe(1)
            expect(rejections.reasons[0]).toBeInstanceOf(kind.error)
          })
        })

        it('should return error to callback', async () => {
          await watchRejections(async (rejections) => {
            let error: Error | null = null
            let successes = 0

            // Built outside the thunk only so the driver is reachable; the
            // thunk still runs synchronously, so the callback is attached
            // before the stream starts either way.
            const built = kind.build({ withError: true })
            PromiseHelper.wrapAsync(
              () => built.promise,
              (err, res) => {
                if (err) {
                  error = err
                }
                if (res) {
                  ++successes
                }
              }
            )
            await built.driver.drained

            expect(await rejections.settle()).toBe(0)
            expect(error).toBeInstanceOf(kind.error)
            expect(successes).toBe(0)
          })
        })

        it('should raise error via event emitter', async () => {
          const { promise } = kind.build({ withError: true })
          await expectCouchbaseError(
            () => streamAll(promise, kind.event),
            kind.error,
            { op: kind.block }
          )
        })

        it('should raise error if awaiting promise after event registrations', async () => {
          const { promise } = kind.build()
          attachListeners(promise, kind.event)

          await expect(promise).rejects.toThrow(
            'Cannot await a promise that is already registered for events'
          )
        })

        it('should raise error if awaiting promise after event registrations (stream error)', async () => {
          const { promise } = kind.build({ withError: true })
          attachListeners(promise, kind.event)

          await expect(promise).rejects.toThrow(
            'Cannot await a promise that is already registered for events'
          )
        })
      })
    })
  }
})
