'use strict'

const util = require('util')

const assert = require('chai').assert

const { QueryMetaData, QueryResult } = require('../lib/querytypes')
const {
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

class StreamablePromiseBuilder {
  static buildStreamableRowPromise(
    config = { simulateStreaming: false, withError: false }
  ) {
    const emitter = new StreamableRowPromise((rows, meta) => {
      return new QueryResult({
        rows: rows,
        meta: meta,
      })
    })

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

    // add a slight delay to simulat time to start executing request
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

      // BUG(JSCBC-1301): StreamablePromise API must either be awaited or have events registered immediately
      it(`should return promise and resolve after delayed await (${streamingType})`, async function () {
        this.skip('Skip until JSCBC-1301 is fixed')
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

      // BUG(JSCBC-1301): StreamablePromise API must either be awaited or have events registered immediately
      it('Should timeout if event emitter registration is delayed (stream error)', function (done) {
        this.skip('Skip until JSCBC-1301 is fixed')
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
        await H.throwsHelper(async () => {
          await StreamablePromiseBuilder.buildStreamableRowPromise({
            withError: true,
          })
        }, ParsingFailureError)
      })

      // BUG(JSCBC-1301): StreamablePromise API must either be awaited or have events registered immediately
      it('should return promise and reject after delayed await', async function () {
        this.skip('Skip until JSCBC-1301 is fixed')
        await H.throwsHelper(async () => {
          const executorPromise =
            StreamablePromiseBuilder.buildStreamableRowPromise({
              withError: true,
            })
          await H.sleep(2000)
          await executorPromise
        }, ParsingFailureError)
      }).timeout(5000)

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

      // BUG(JSCBC-1301): StreamablePromise API must either be awaited or have events registered immediately
      it('should raise error if awaiting promise after event registrations', async function () {
        this.skip('Skip until JSCBC-1301 is fixed')
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

      // BUG(JSCBC-1301): StreamablePromise API must either be awaited or have events registered immediately
      it('should raise error if awaiting promise after event registrations (stream error)', async function () {
        this.skip('Skip until JSCBC-1301 is fixed')
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

      // BUG(JSCBC-1301): StreamablePromise API must either be awaited or have events registered immediately
      it(`should return promise and resolve after delayed await (${streamingType})`, async function () {
        this.skip('Skip until JSCBC-1301 is fixed')
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

      // BUG(JSCBC-1301): StreamablePromise API must either be awaited or have events registered immediately
      it('Should timeout if event emitter registration is delayed (stream error)', function (done) {
        this.skip('Skip until JSCBC-1301 is fixed')
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
        await H.throwsHelper(async () => {
          await StreamablePromiseBuilder.buildStreamableReplicaPromise({
            withError: true,
          })
        }, DocumentNotFoundError)
      })

      // BUG(JSCBC-1301): StreamablePromise API must either be awaited or have events registered immediately
      it('should return promise and reject after delayed await', async function () {
        this.skip('Skip until JSCBC-1301 is fixed')
        await H.throwsHelper(async () => {
          const executorPromise =
            StreamablePromiseBuilder.buildStreamableReplicaPromise({
              withError: true,
            })
          await H.sleep(2000)
          await executorPromise
        }, DocumentNotFoundError)
      }).timeout(5000)

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

      // BUG(JSCBC-1301): StreamablePromise API must either be awaited or have events registered immediately
      it('should raise error if awaiting promise after event registrations', async function () {
        this.skip('Skip until JSCBC-1301 is fixed')
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

      // BUG(JSCBC-1301): StreamablePromise API must either be awaited or have events registered immediately
      it('should raise error if awaiting promise after event registrations (stream error)', async function () {
        this.skip('Skip until JSCBC-1301 is fixed')
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

      // BUG(JSCBC-1301): StreamablePromise API must either be awaited or have events registered immediately
      it(`should return promise and resolve after delayed await (${streamingType})`, async function () {
        this.skip('Skip until JSCBC-1301 is fixed')
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

      // BUG(JSCBC-1301): StreamablePromise API must either be awaited or have events registered immediately
      it('Should timeout if event emitter registration is delayed (stream error)', function (done) {
        this.skip('Skip until JSCBC-1301 is fixed')
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
        await H.throwsHelper(async () => {
          await StreamablePromiseBuilder.buildStreamableScanPromise({
            withError: true,
          })
        }, InvalidArgumentError)
      })

      // BUG(JSCBC-1301): StreamablePromise API must either be awaited or have events registered immediately
      it('should return promise and reject after delayed await', async function () {
        this.skip('Skip until JSCBC-1301 is fixed')
        await H.throwsHelper(async () => {
          const executorPromise =
            StreamablePromiseBuilder.buildStreamableScanPromise({
              withError: true,
            })
          await H.sleep(2000)
          await executorPromise
        }, InvalidArgumentError)
      }).timeout(5000)

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

      // BUG(JSCBC-1301): StreamablePromise API must either be awaited or have events registered immediately
      it('should raise error if awaiting promise after event registrations', async function () {
        this.skip('Skip until JSCBC-1301 is fixed')
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

      // BUG(JSCBC-1301): StreamablePromise API must either be awaited or have events registered immediately
      it('should raise error if awaiting promise after event registrations (stream error)', async function () {
        this.skip('Skip until JSCBC-1301 is fixed')
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
