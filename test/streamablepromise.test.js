'use strict'

const util = require('util')

const assert = require('chai').assert

const { QueryMetaData, QueryResult } = require('../lib/querytypes')
const { PromiseHelper } = require('../lib/utilities')

const {
  StreamablePromise,
  StreamableRowPromise,
  StreamableReplicasPromise,
  StreamableScanPromise,
} = require('../lib/streamablepromises')
const {
  DocumentNotFoundError,
  InvalidArgumentError,
  ParsingFailureError,
} = require('../lib/errors')

const H = require('./harness')

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

class TestStreamableRowPromise extends StreamablePromise {
  _err
  _rows
  _meta

  constructor(fn) {
    super((emitter, resolve, reject) => {
      emitter.on('row', (r) => this._rows.push(r))
      emitter.on('meta', (m) => (this._meta = m))
      emitter.on('error', (e) => (this._err = e))
      emitter.on('end', () => {
        if (this._err) {
          return reject(this._err)
        }
        resolve(fn(this._rows, this._meta))
      })
    })
    this._err = undefined
    this._rows = []
    this._meta = undefined
  }
}

class StreamablePromiseBuilder {
  static buildStreamableRowPromise(
    config = { simulateStreaming: false, withError: false, useTestClass: false }
  ) {
    const resultFunc = (rows, meta) => {
      return new QueryResult({
        rows: rows,
        meta: meta,
      })
    }

    const emitter = config.useTestClass
      ? new TestStreamableRowPromise(resultFunc)
      : new StreamableRowPromise(resultFunc)

    const emitMap = new Map()
    if (config.withError) {
      emitMap.set('err', new ParsingFailureError())
    }
    emitMap.set('row', [...ROWS])
    emitMap.set(
      'meta',
      new QueryMetaData({
        requestId: 'c675ce2a-31b7-4531-bb69-574f66ce464f',
        clientContextId: '125a63-df8e-3f47-7d10-f68dd7e9108c89',
        status: 'success',
        signature: { '*': '*' },
      })
    )
    emitMap.set('end', undefined)
    const processMap = function (key, idx) {
      if (emitMap.size == 0) {
        return
      }

      const err = emitMap.get('err')
      if (err) {
        emitter.emit('error', err)
        emitter.emit('end')
        emitMap.clear()
        return
      }

      if (key === 'row') {
        let rows = emitMap.get(key)
        const row = rows.shift()
        emitter.emit('row', row)
        emitMap.set(key, rows)
        if (rows.length == 0) {
          key = 'meta'
        }
      } else if (key === 'meta') {
        emitter.emit('meta', emitMap.get(key))
        key = 'end'
      } else if (key === 'end') {
        emitter.emit('end')
        emitMap.clear()
      }
      if (config.simulateStreaming) {
        const delay = Math.floor(Math.random() * 100)
        setTimeout(processMap, delay, key, ++idx)
      } else {
        processMap(key, ++idx)
      }
    }

    // add a slight delay to simulat time to start executing request
    setTimeout(processMap, 250, 'row', 0)
    return emitter
  }

  static buildStreamableReplicaPromise(
    config = { simulateStreaming: false, withError: false }
  ) {
    const emitter = new StreamableReplicasPromise((replicas) => replicas)

    const emitMap = new Map()
    if (config.withError) {
      emitMap.set('err', new DocumentNotFoundError())
    }
    emitMap.set('replica', [...ROWS])
    emitMap.set('end', undefined)
    const processMap = function (key, idx) {
      if (emitMap.size == 0) {
        return
      }

      const err = emitMap.get('err')
      if (err) {
        emitter.emit('error', err)
        emitter.emit('end')
        emitMap.clear()
        return
      }

      if (key === 'replica') {
        let replicas = emitMap.get(key)
        const replica = replicas.shift()

        emitter.emit('replica', replica)
        emitMap.set(key, replicas)
        if (replicas.length == 0) {
          key = 'end'
        }
      } else if (key === 'end') {
        emitter.emit('end')
        emitMap.clear()
      }
      if (config.simulateStreaming) {
        const delay = Math.floor(Math.random() * 100)
        setTimeout(processMap, delay, key, ++idx)
      } else {
        processMap(key, ++idx)
      }
    }

    // add a slight delay to simulate time to start executing request
    setTimeout(processMap, 250, 'replica', 0)
    return emitter
  }

  static buildStreamableScanPromise(
    config = { simulateStreaming: false, withError: false }
  ) {
    const emitter = new StreamableScanPromise((replicas) => replicas)

    const emitMap = new Map()
    if (config.withError) {
      emitMap.set('err', new InvalidArgumentError())
    }
    emitMap.set('result', [...ROWS])
    emitMap.set('end', undefined)
    const processMap = function (key, idx) {
      if (emitMap.size == 0) {
        return
      }

      const err = emitMap.get('err')
      if (err) {
        emitter.emit('error', err)
        emitter.emit('end')
        emitMap.clear()
        return
      }

      if (key === 'result') {
        let results = emitMap.get(key)
        const result = results.shift()

        emitter.emit('result', result)
        emitMap.set(key, results)
        if (results.length == 0) {
          key = 'end'
        }
      } else if (key === 'end') {
        emitter.emit('end')
        emitMap.clear()
      }
      if (config.simulateStreaming) {
        const delay = Math.floor(Math.random() * 100)
        setTimeout(processMap, delay, key, ++idx)
      } else {
        processMap(key, ++idx)
      }
    }

    // add a slight delay to simulat time to start executing request
    setTimeout(processMap, 250, 'result', 0)
    return emitter
  }
}

describe('streamablepromise', function () {
  const streamingTypes = ['streaming', 'non-streaming']
  let originalListener
  let rejectionHandler

  function unhandledRejectionListener() {
    if (rejectionHandler instanceof Function) {
      rejectionHandler()
    }
  }

  function processResults(result, expected, done, otherChecks) {
    try {
      if (otherChecks instanceof Function) {
        otherChecks()
      }
      assert.deepStrictEqual(
        result.success,
        expected.success,
        'Success count mismatch'
      )
      assert.deepStrictEqual(
        result.error,
        expected.error,
        'Error count mismatch'
      )
      assert.deepStrictEqual(
        result.unhandledRejection,
        expected.unhandledRejection,
        'Unhandled Rejection count mismatch'
      )
      if (done instanceof Function) {
        done(null)
      }
    } catch (e) {
      if (done instanceof Function) {
        done(e)
      } else {
        throw e
      }
    }
  }

  before(function () {
    // remove the initial Mocha listener (it seems to add one globally and for the #utilities suite)
    // Mocha will remove the suite's listener and then emit the event.  This way we should be the only listener
    // on the unhandedRejection event.
    // Github (v10.4.0): https://github.com/mochajs/mocha/blob/ffd9557ee291047f7beef71a24796ea2da256614/lib/runner.js#L175-L197
    originalListener = process.listeners('unhandledRejection').pop()
    process.removeListener('unhandledRejection', originalListener)
    process.on('unhandledRejection', unhandledRejectionListener)
  })

  after(function () {
    process.addListener('unhandledRejection', originalListener)
    process.removeListener('unhandledRejection', unhandledRejectionListener)
  })

  /* eslint-disable mocha/no-setup-in-describe */
  describe('#streamablerowpromise', function () {
    streamingTypes.forEach((streamingType) => {
      it(`should return resolved promise (${streamingType})`, async function () {
        const qResult =
          await StreamablePromiseBuilder.buildStreamableRowPromise({
            simulateStreaming: streamingType === 'streaming',
          })

        assert.instanceOf(qResult, QueryResult)
        assert.isArray(qResult.rows)
        assert.lengthOf(qResult.rows, ROWS.length)
        assert.instanceOf(qResult.meta, QueryMetaData)
      })

      it(`should return promise and resolve after delayed await (${streamingType})`, async function () {
        const executorPromise =
          StreamablePromiseBuilder.buildStreamableRowPromise({
            simulateStreaming: streamingType === 'streaming',
          })
        await H.sleep(2000)
        const qResult = await executorPromise
        assert.instanceOf(qResult, QueryResult)
        assert.isArray(qResult.rows)
        assert.lengthOf(qResult.rows, ROWS.length)
        assert.instanceOf(qResult.meta, QueryMetaData)
      }).timeout(5000)

      it(`should process rows via event emitter (${streamingType})`, async function () {
        const streamRows = () => {
          return new Promise((resolve, reject) => {
            let rowsOut = []
            let metaOut = null
            StreamablePromiseBuilder.buildStreamableRowPromise()
              .on('row', (row) => {
                rowsOut.push(row)
              })
              .on('meta', (meta) => {
                metaOut = meta
              })
              .on('end', () => {
                resolve({
                  rows: rowsOut,
                  meta: metaOut,
                })
              })
              .on('error', (err) => {
                reject(err)
              })
          })
        }
        const qResult = await streamRows()
        assert.isArray(qResult.rows)
        assert.lengthOf(qResult.rows, ROWS.length)
        assert.instanceOf(qResult.meta, QueryMetaData)
      })
    })

    describe('#delayedemitter', function () {
      this.timeout(3000)

      const checkRowsPromise = function (promise, cb, rowsOut, metaOut) {
        try {
          assert.isTrue(util.inspect(promise).includes('pending'))
          assert.isArray(rowsOut)
          assert.lengthOf(rowsOut, 0)
          assert.isNull(metaOut)
          cb(null)
        } catch (err) {
          cb(err)
        }
      }

      it('should stop caching rows after event registration', async function () {
        const executorPromise =
          StreamablePromiseBuilder.buildStreamableRowPromise({
            simulateStreaming: true,
            useTestClass: true,
          })

        await H.sleep(350)

        const streamRows = () => {
          const rowsOut = []
          let metaOut = null
          return new Promise((resolve, reject) => {
            executorPromise
              .on('row', (row) => {
                rowsOut.push(row)
              })
              .on('meta', (meta) => {
                metaOut = meta
              })
              .on('end', () => {
                resolve({
                  rows: rowsOut,
                  meta: metaOut,
                })
              })
              .on('error', (err) => {
                reject(err)
              })
          })
        }
        const streamResults = await streamRows()
        assert.equal(
          streamResults.rows.length + executorPromise._rows.length,
          ROWS.length
        )
        assert.isOk(streamResults.meta)
        assert.notExists(executorPromise._meta)
      })

      /**
       * Right now streaming is not available in the C++ core, so when we get the response back
       * we emit all the rows synchronously, followed by the meta (if applicable) and end events.
       * This means that if the query response is relatively fast and the user has a delay in registering
       * streaming events, those events will never be captured as all the events will have already been
       * emitted. Hence why this test expects a timeout.
       * If the test were to simulate streaming, the expectation wouldn't be a timeout, but that rows caught
       * w/in the user registered events are less than the total rows from the query results b/c only the
       * initial row events would have been missed.
       */
      it('Should timeout if event emitter registration is delayed', function (done) {
        const executorPromise =
          StreamablePromiseBuilder.buildStreamableRowPromise()

        let rowsOut = []
        let metaOut = null

        const createStreamPromise = (execPromise) => {
          const streamRows = () => {
            return new Promise((resolve, reject) => {
              execPromise
                .on('row', (row) => {
                  rowsOut.push(row)
                })
                .on('meta', (meta) => {
                  metaOut = meta
                })
                .on('end', () => {
                  resolve({
                    rows: rowsOut,
                    meta: metaOut,
                  })
                })
                .on('error', (err) => {
                  reject(err)
                })
            })
          }
          const rowsPromise = streamRows()
          setTimeout(
            checkRowsPromise,
            2000,
            rowsPromise,
            done,
            rowsOut,
            metaOut
          )
        }
        setTimeout(createStreamPromise, 350, executorPromise)
      })

      it('Should timeout if event emitter registration is delayed (stream error)', function (done) {
        const executorPromise =
          StreamablePromiseBuilder.buildStreamableRowPromise({
            withError: true,
          })

        let rowsOut = []
        let metaOut = null

        const createStreamPromise = (execPromise) => {
          const streamRows = () => {
            return new Promise((resolve, reject) => {
              execPromise
                .on('row', (row) => {
                  rowsOut.push(row)
                })
                .on('meta', (meta) => {
                  metaOut = meta
                })
                .on('end', () => {
                  resolve({
                    rows: rowsOut,
                    meta: metaOut,
                  })
                })
                .on('error', (err) => {
                  reject(err)
                })
            })
          }
          const rowsPromise = streamRows()
          setTimeout(
            checkRowsPromise,
            2000,
            rowsPromise,
            done,
            rowsOut,
            metaOut
          )
        }
        setTimeout(createStreamPromise, 350, executorPromise)
      })
    })

    describe('#error', function () {
      it('should return rejected promise', async function () {
        const expected = { unhandledRejection: 0, error: 1 }
        const result = { unhandledRejection: 0, error: 0 }
        rejectionHandler = () => result.unhandledRejection++
        await StreamablePromiseBuilder.buildStreamableRowPromise({
          withError: true,
        })
          .catch((err) => {
            assert.instanceOf(err, ParsingFailureError)
            result.error++
          })
          .finally(() => {
            assert.equal(result.error, expected.error)
            assert.equal(result.unhandledRejection, expected.unhandledRejection)
          })
      })

      it('should return promise and reject after delayed await', async function () {
        this.skip('Skip until JSCBC-1334 is fixed')
        const expected = { unhandledRejection: 1, error: 1 }
        const result = { unhandledRejection: 0, error: 0 }
        rejectionHandler = () => result.unhandledRejection++
        try {
          const executorPromise =
            StreamablePromiseBuilder.buildStreamableRowPromise({
              withError: true,
            })
          await H.sleep(2000)
          await executorPromise
        } catch (err) {
          assert.instanceOf(err, ParsingFailureError)
          result.error++
        }

        assert.equal(result.error, expected.error)
        assert.equal(result.unhandledRejection, expected.unhandledRejection)
      }).timeout(5000)

      it('should raise unhandled rejection if not awaited', async function () {
        this.skip('Skip until JSCBC-1334 is fixed')
        const expected = { unhandledRejection: 1, error: 0 }
        const result = { unhandledRejection: 0, error: 0 }
        rejectionHandler = () => result.unhandledRejection++
        try {
          StreamablePromiseBuilder.buildStreamableRowPromise({
            withError: true,
          })
        } catch (err) {
          assert.instanceOf(err, ParsingFailureError)
          result.error++
        }
        // give time for the unhandledRejectionListener
        await H.sleep(250)
        assert.equal(result.error, expected.error)
        assert.equal(result.unhandledRejection, expected.unhandledRejection)
      })

      it('should return error to callback', function (done) {
        const expected = { success: 0, unhandledRejection: 0, error: 1 }
        const result = { success: 0, unhandledRejection: 0, error: 0 }
        rejectionHandler = () => result.unhandledRejection++
        const localCallback = (err, res) => {
          if (err) {
            result.error++
            result.err = err
          }
          if (res) {
            result.success++
            result.res = res
          }
        }
        const otherChecks = () => {
          assert.instanceOf(result.err, ParsingFailureError)
        }

        PromiseHelper.wrapAsync(
          () =>
            StreamablePromiseBuilder.buildStreamableRowPromise({
              withError: true,
            }),
          localCallback
        )

        setTimeout(processResults, 500, result, expected, done, otherChecks)
      })

      it('should raise error via event emitter', async function () {
        const streamRows = () => {
          return new Promise((resolve, reject) => {
            let rowsOut = []
            let metaOut = null
            StreamablePromiseBuilder.buildStreamableRowPromise({
              withError: true,
            })
              .on('row', (row) => {
                rowsOut.push(row)
              })
              .on('meta', (meta) => {
                metaOut = meta
              })
              .on('end', () => {
                resolve({
                  rows: rowsOut,
                  meta: metaOut,
                })
              })
              .on('error', (err) => {
                reject(err)
              })
          })
        }
        await H.throwsHelper(async () => {
          await streamRows()
        }, ParsingFailureError)
      })

      it('should raise error if awaiting promise after event registrations', async function () {
        let rowsOut = []
        let metaOut = null // eslint-disable-line @typescript-eslint/no-unused-vars
        const executorPromise =
          StreamablePromiseBuilder.buildStreamableRowPromise()
        executorPromise
          .on('row', (row) => {
            rowsOut.push(row)
          })
          .on('meta', (meta) => {
            metaOut = meta
          })
          .on('end', () => {})
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          .on('error', (err) => {})
        await H.throwsHelper(
          async () => {
            await executorPromise
          },
          Error,
          'Cannot await a promise that is already registered for events'
        )
      })

      it('should raise error if awaiting promise after event registrations (stream error)', async function () {
        let rowsOut = []
        let metaOut = null // eslint-disable-line @typescript-eslint/no-unused-vars
        const executorPromise =
          StreamablePromiseBuilder.buildStreamableRowPromise({
            withError: true,
          })
        executorPromise
          .on('row', (row) => {
            rowsOut.push(row)
          })
          .on('meta', (meta) => {
            metaOut = meta
          })
          .on('end', () => {})
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          .on('error', (err) => {})
        await H.throwsHelper(
          async () => {
            await executorPromise
          },
          Error,
          'Cannot await a promise that is already registered for events'
        )
      })
    })
  })

  describe('#streamablereplicapromise', function () {
    streamingTypes.forEach((streamingType) => {
      it(`should return resolved promise (${streamingType})`, async function () {
        const qResult =
          await StreamablePromiseBuilder.buildStreamableReplicaPromise({
            simulateStreaming: streamingType === 'streaming',
          })
        assert.isArray(qResult)
        assert.lengthOf(qResult, ROWS.length)
      })

      it(`should return promise and resolve after delayed await (${streamingType})`, async function () {
        const executorPromise =
          StreamablePromiseBuilder.buildStreamableReplicaPromise({
            simulateStreaming: streamingType === 'streaming',
          })
        await H.sleep(2000)
        const qResult = await executorPromise
        assert.isArray(qResult)
        assert.lengthOf(qResult, ROWS.length)
      }).timeout(5000)

      it(`should process rows via event emitter (${streamingType})`, async function () {
        const streamReplicas = () => {
          return new Promise((resolve, reject) => {
            let replicasOut = []
            StreamablePromiseBuilder.buildStreamableReplicaPromise()
              .on('replica', (replica) => {
                replicasOut.push(replica)
              })
              .on('end', () => {
                resolve({
                  replicas: replicasOut,
                })
              })
              .on('error', (err) => {
                reject(err)
              })
          })
        }
        const qResult = await streamReplicas()
        assert.isArray(qResult.replicas)
        assert.lengthOf(qResult.replicas, ROWS.length)
      })
    })

    describe('#delayedemitter', function () {
      this.timeout(3000)

      const checkReplicasPromise = function (promise, cb, replicasOut) {
        try {
          assert.isTrue(util.inspect(promise).includes('pending'))
          assert.isArray(replicasOut)
          assert.lengthOf(replicasOut, 0)
          cb(null)
        } catch (err) {
          cb(err)
        }
      }

      it('Should timeout if event emitter registration is delayed', function (done) {
        const executorPromise =
          StreamablePromiseBuilder.buildStreamableReplicaPromise()

        let replicasOut = []

        const createStreamPromise = (execPromise) => {
          const streamReplicas = () => {
            return new Promise((resolve, reject) => {
              execPromise
                .on('replica', (replica) => {
                  replicasOut.push(replica)
                })
                .on('end', () => {
                  resolve({
                    replicas: replicasOut,
                  })
                })
                .on('error', (err) => {
                  reject(err)
                })
            })
          }
          const replicasPromise = streamReplicas()
          setTimeout(
            checkReplicasPromise,
            2000,
            replicasPromise,
            done,
            replicasOut
          )
        }
        setTimeout(createStreamPromise, 350, executorPromise)
      })

      it('Should timeout if event emitter registration is delayed (stream error)', function (done) {
        const executorPromise =
          StreamablePromiseBuilder.buildStreamableReplicaPromise({
            withError: true,
          })

        let replicasOut = []

        const createStreamPromise = (execPromise) => {
          const streamReplicas = () => {
            return new Promise((resolve, reject) => {
              execPromise
                .on('replica', (replica) => {
                  replicasOut.push(replica)
                })
                .on('end', () => {
                  resolve({
                    replicas: replicasOut,
                  })
                })
                .on('error', (err) => {
                  reject(err)
                })
            })
          }
          const replicasPromise = streamReplicas()
          setTimeout(
            checkReplicasPromise,
            2000,
            replicasPromise,
            done,
            replicasOut
          )
        }
        setTimeout(createStreamPromise, 350, executorPromise)
      })
    })

    describe('#error', function () {
      it('should return rejected promise', async function () {
        const expected = { unhandledRejection: 0, error: 1 }
        const result = { unhandledRejection: 0, error: 0 }
        rejectionHandler = () => result.unhandledRejection++
        await StreamablePromiseBuilder.buildStreamableReplicaPromise({
          withError: true,
        })
          .catch((err) => {
            assert.instanceOf(err, DocumentNotFoundError)
            result.error++
          })
          .finally(() => {
            assert.equal(result.error, expected.error)
            assert.equal(result.unhandledRejection, expected.unhandledRejection)
          })
      })

      it('should return promise and reject after delayed await', async function () {
        this.skip('Skip until JSCBC-1334 is fixed')
        const expected = { unhandledRejection: 1, error: 1 }
        const result = { unhandledRejection: 0, error: 0 }
        rejectionHandler = () => result.unhandledRejection++
        try {
          const executorPromise =
            StreamablePromiseBuilder.buildStreamableReplicaPromise({
              withError: true,
            })
          await H.sleep(2000)
          await executorPromise
        } catch (err) {
          assert.instanceOf(err, DocumentNotFoundError)
          result.error++
        }

        assert.equal(result.error, expected.error)
        assert.equal(result.unhandledRejection, expected.unhandledRejection)
      }).timeout(5000)

      it('should raise unhandled rejection if not awaited', async function () {
        this.skip('Skip until JSCBC-1334 is fixed')
        const expected = { unhandledRejection: 1, error: 0 }
        const result = { unhandledRejection: 0, error: 0 }
        rejectionHandler = () => result.unhandledRejection++
        try {
          StreamablePromiseBuilder.buildStreamableReplicaPromise({
            withError: true,
          })
        } catch (err) {
          assert.instanceOf(err, DocumentNotFoundError)
          result.error++
        }
        // give time for the unhandledRejectionListener
        await H.sleep(250)
        assert.equal(result.error, expected.error)
        assert.equal(result.unhandledRejection, expected.unhandledRejection)
      })

      it('should return error to callback', function (done) {
        const expected = { success: 0, unhandledRejection: 0, error: 1 }
        const result = { success: 0, unhandledRejection: 0, error: 0 }
        rejectionHandler = () => result.unhandledRejection++
        const localCallback = (err, res) => {
          if (err) {
            result.error++
            result.err = err
          }
          if (res) {
            result.success++
            result.res = res
          }
        }
        const otherChecks = () => {
          assert.instanceOf(result.err, DocumentNotFoundError)
        }

        PromiseHelper.wrapAsync(
          () =>
            StreamablePromiseBuilder.buildStreamableReplicaPromise({
              withError: true,
            }),
          localCallback
        )

        setTimeout(processResults, 500, result, expected, done, otherChecks)
      })

      it('should raise error via event emitter', async function () {
        const streamReplicas = () => {
          return new Promise((resolve, reject) => {
            let replicasOut = []
            StreamablePromiseBuilder.buildStreamableReplicaPromise({
              withError: true,
            })
              .on('replica', (replica) => {
                replicasOut.push(replica)
              })
              .on('end', () => {
                resolve({
                  replicas: replicasOut,
                })
              })
              .on('error', (err) => {
                reject(err)
              })
          })
        }
        await H.throwsHelper(async () => {
          await streamReplicas()
        }, DocumentNotFoundError)
      })

      it('should raise error if awaiting promise after event registrations', async function () {
        let replicasOut = []
        const executorPromise =
          StreamablePromiseBuilder.buildStreamableReplicaPromise()
        executorPromise
          .on('replica', (replica) => {
            replicasOut.push(replica)
          })
          .on('end', () => {})
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          .on('error', (err) => {})
        await H.throwsHelper(
          async () => {
            await executorPromise
          },
          Error,
          'Cannot await a promise that is already registered for events'
        )
      })

      it('should raise error if awaiting promise after event registrations (stream error)', async function () {
        let replicasOut = []
        const executorPromise =
          StreamablePromiseBuilder.buildStreamableReplicaPromise({
            withError: true,
          })
        executorPromise
          .on('replica', (replica) => {
            replicasOut.push(replica)
          })
          .on('end', () => {})
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          .on('error', (err) => {})
        await H.throwsHelper(
          async () => {
            await executorPromise
          },
          Error,
          'Cannot await a promise that is already registered for events'
        )
      })
    })
  })

  describe('#streamablescanpromise', function () {
    streamingTypes.forEach((streamingType) => {
      it(`should return resolved promise (${streamingType})`, async function () {
        const qResult =
          await StreamablePromiseBuilder.buildStreamableScanPromise({
            simulateStreaming: streamingType === 'streaming',
          })
        assert.isArray(qResult)
        assert.lengthOf(qResult, ROWS.length)
      })

      it(`should return promise and resolve after delayed await (${streamingType})`, async function () {
        const executorPromise =
          StreamablePromiseBuilder.buildStreamableScanPromise({
            simulateStreaming: streamingType === 'streaming',
          })
        await H.sleep(2000)
        const qResult = await executorPromise
        assert.isArray(qResult)
        assert.lengthOf(qResult, ROWS.length)
      }).timeout(5000)

      it(`should process rows via event emitter (${streamingType})`, async function () {
        const streamScan = () => {
          return new Promise((resolve, reject) => {
            let results = []
            StreamablePromiseBuilder.buildStreamableScanPromise()
              .on('result', (result) => {
                results.push(result)
              })
              .on('end', () => {
                resolve({
                  results: results,
                })
              })
              .on('error', (err) => {
                reject(err)
              })
          })
        }
        const qResult = await streamScan()
        assert.isArray(qResult.results)
        assert.lengthOf(qResult.results, ROWS.length)
      })
    })

    describe('#delayedemitter', function () {
      this.timeout(3000)

      const checkResultsPromise = function (promise, cb, resultsOut) {
        try {
          assert.isTrue(util.inspect(promise).includes('pending'))
          assert.isArray(resultsOut)
          assert.lengthOf(resultsOut, 0)
          cb(null)
        } catch (err) {
          cb(err)
        }
      }

      it('Should timeout if event emitter registration is delayed', function (done) {
        const executorPromise =
          StreamablePromiseBuilder.buildStreamableScanPromise()

        let resultsOut = []

        const createStreamPromise = (execPromise) => {
          const streamResults = () => {
            return new Promise((resolve, reject) => {
              execPromise
                .on('result', (result) => {
                  resultsOut.push(result)
                })
                .on('end', () => {
                  resolve({
                    results: resultsOut,
                  })
                })
                .on('error', (err) => {
                  reject(err)
                })
            })
          }
          const resultsPromise = streamResults()
          setTimeout(
            checkResultsPromise,
            2000,
            resultsPromise,
            done,
            resultsOut
          )
        }
        setTimeout(createStreamPromise, 350, executorPromise)
      })

      it('Should timeout if event emitter registration is delayed (stream error)', function (done) {
        const executorPromise =
          StreamablePromiseBuilder.buildStreamableScanPromise({
            withError: true,
          })

        let resultsOut = []

        const createStreamPromise = (execPromise) => {
          const streamResults = () => {
            return new Promise((resolve, reject) => {
              execPromise
                .on('result', (result) => {
                  resultsOut.push(result)
                })
                .on('end', () => {
                  resolve({
                    results: resultsOut,
                  })
                })
                .on('error', (err) => {
                  reject(err)
                })
            })
          }
          const resultsPromise = streamResults()
          setTimeout(
            checkResultsPromise,
            2000,
            resultsPromise,
            done,
            resultsOut
          )
        }
        setTimeout(createStreamPromise, 350, executorPromise)
      })
    })

    describe('#error', function () {
      it('should return rejected promise', async function () {
        const expected = { unhandledRejection: 0, error: 1 }
        const result = { unhandledRejection: 0, error: 0 }
        rejectionHandler = () => result.unhandledRejection++
        await StreamablePromiseBuilder.buildStreamableScanPromise({
          withError: true,
        })
          .catch((err) => {
            assert.instanceOf(err, InvalidArgumentError)
            result.error++
          })
          .finally(() => {
            assert.equal(result.error, expected.error)
            assert.equal(result.unhandledRejection, expected.unhandledRejection)
          })
      })

      it('should return promise and reject after delayed await', async function () {
        this.skip('Skip until JSCBC-1334 is fixed')
        const expected = { unhandledRejection: 1, error: 1 }
        const result = { unhandledRejection: 0, error: 0 }
        rejectionHandler = () => result.unhandledRejection++
        try {
          const executorPromise =
            StreamablePromiseBuilder.buildStreamableScanPromise({
              withError: true,
            })
          await H.sleep(2000)
          await executorPromise
        } catch (err) {
          assert.instanceOf(err, InvalidArgumentError)
          result.error++
        }

        assert.equal(result.error, expected.error)
        assert.equal(result.unhandledRejection, expected.unhandledRejection)
      }).timeout(5000)

      it('should raise unhandled rejection if not awaited', async function () {
        this.skip('Skip until JSCBC-1334 is fixed')
        const expected = { unhandledRejection: 1, error: 0 }
        const result = { unhandledRejection: 0, error: 0 }
        rejectionHandler = () => result.unhandledRejection++
        try {
          StreamablePromiseBuilder.buildStreamableScanPromise({
            withError: true,
          })
        } catch (err) {
          assert.instanceOf(err, InvalidArgumentError)
          result.error++
        }
        // give time for the unhandledRejectionListener
        await H.sleep(250)
        assert.equal(result.error, expected.error)
        assert.equal(result.unhandledRejection, expected.unhandledRejection)
      })

      it('should return error to callback', function (done) {
        const expected = { success: 0, unhandledRejection: 0, error: 1 }
        const result = { success: 0, unhandledRejection: 0, error: 0 }
        rejectionHandler = () => result.unhandledRejection++
        const localCallback = (err, res) => {
          if (err) {
            result.error++
            result.err = err
          }
          if (res) {
            result.success++
            result.res = res
          }
        }
        const otherChecks = () => {
          assert.instanceOf(result.err, InvalidArgumentError)
        }

        PromiseHelper.wrapAsync(
          () =>
            StreamablePromiseBuilder.buildStreamableScanPromise({
              withError: true,
            }),
          localCallback
        )

        setTimeout(processResults, 500, result, expected, done, otherChecks)
      })

      it('should raise error via event emitter', async function () {
        const streamScan = () => {
          return new Promise((resolve, reject) => {
            let results = []
            StreamablePromiseBuilder.buildStreamableScanPromise({
              withError: true,
            })
              .on('result', (result) => {
                results.push(result)
              })
              .on('end', () => {
                resolve({
                  results: results,
                })
              })
              .on('error', (err) => {
                reject(err)
              })
          })
        }
        await H.throwsHelper(async () => {
          await streamScan()
        }, InvalidArgumentError)
      })

      it('should raise error if awaiting promise after event registrations', async function () {
        let results = []
        const executorPromise =
          StreamablePromiseBuilder.buildStreamableScanPromise()
        executorPromise
          .on('result', (result) => {
            results.push(result)
          })
          .on('end', () => {})
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          .on('error', (err) => {})
        await H.throwsHelper(
          async () => {
            await executorPromise
          },
          Error,
          'Cannot await a promise that is already registered for events'
        )
      })

      it('should raise error if awaiting promise after event registrations (stream error)', async function () {
        let results = []
        const executorPromise =
          StreamablePromiseBuilder.buildStreamableScanPromise({
            withError: true,
          })
        executorPromise
          .on('result', (result) => {
            results.push(result)
          })
          .on('end', () => {})
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          .on('error', (err) => {})
        await H.throwsHelper(
          async () => {
            await executorPromise
          },
          Error,
          'Cannot await a promise that is already registered for events'
        )
      })
    })
  })
})
