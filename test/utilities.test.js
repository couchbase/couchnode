'use strict'

const assert = require('chai').assert

const { PromiseHelper } = require('../lib/utilities')

describe('#utilities', function () {
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

  function resetResult() {
    return {
      success: 0,
      error: 0,
      unhandledRejection: 0,
    }
  }

  function setExpected(success, error, unhandledRejection) {
    return {
      success: success,
      error: error,
      unhandledRejection: unhandledRejection,
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

  describe('#promisehelper', function () {
    it('should wrap function and return resolved promise', async function () {
      const expected = setExpected(1, 0, 0)
      const result = resetResult()
      rejectionHandler = () => result.unhandledRejection++

      const res = await PromiseHelper.wrap((cb) => {
        result.success++
        cb(null, 'Success!')
      })

      assert.deepStrictEqual(res, 'Success!')
      processResults(result, expected)
    })

    it('should wrap function and return rejected promise', async function () {
      const expected = setExpected(0, 1, 0)
      const result = resetResult()
      rejectionHandler = () => result.unhandledRejection++

      try {
        const res = await PromiseHelper.wrap((cb) => {
          result.error++
          cb(new Error('Oh no!!'), null)
        })
        // we should not get here
        assert.notExists(res)
      } catch (err) {
        assert.instanceOf(err, Error)
        assert.equal(err.message, 'Oh no!!')
        processResults(result, expected)
      }
    })

    it('should wrap function and pass resolved promise result to callback', function (done) {
      const expected = setExpected(1, 0, 0)
      const result = resetResult()
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
        assert.deepStrictEqual(result.res, 'Success!')
        assert.notExists(result.err)
      }

      PromiseHelper.wrap((cb) => {
        cb(null, 'Success!')
      }, localCallback)

      setTimeout(processResults, 500, result, expected, done, otherChecks)
    })

    it('should wrap function and pass rejected promise result to callback', function (done) {
      const expected = setExpected(0, 1, 0)
      const result = resetResult()
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
        assert.instanceOf(result.err, Error)
        assert.deepStrictEqual(result.err.message, 'Oh no!!')
        assert.notExists(result.res)
      }

      PromiseHelper.wrap((cb) => {
        cb(new Error('Oh no!!'), null)
      }, localCallback)

      setTimeout(processResults, 500, result, expected, done, otherChecks)
    })

    it('should wrap function and handle callback that throws uncaught error', function (done) {
      // this test should result in an unhandled rejection
      const expected = setExpected(1, 0, 1)
      const result = resetResult()
      rejectionHandler = () => result.unhandledRejection++
      const localCallback = (err, res) => {
        if (err) {
          result.error++
        }
        if (res) {
          result.success++
          throw new Error('Oops!')
        }
      }

      PromiseHelper.wrap((cb) => {
        cb(null, result)
      }, localCallback)

      setTimeout(processResults, 500, result, expected, done)
    })

    it('should wrap function and and allow continued execution', function (done) {
      const expected = setExpected(1, 1, 0)
      const result = resetResult()
      rejectionHandler = () => result.unhandledRejection++
      const localCallback = (err, res) => {
        if (err) {
          result.error++
          PromiseHelper.wrap((cb) => {
            cb(null, result)
          }, localCallback)
        }
        if (res) {
          result.success++
        }
      }

      PromiseHelper.wrap((cb) => {
        cb(new Error('Oh no!!'), null)
      }, localCallback)

      setTimeout(processResults, 500, result, expected, done)
    })
  })

  describe('#promisehelperasync', function () {
    it('should wrapAsync function and return resolved promise', async function () {
      const expected = setExpected(1, 0, 0)
      const result = resetResult()
      rejectionHandler = () => result.unhandledRejection++
      const res = await PromiseHelper.wrapAsync(() => {
        result.success++
        return Promise.resolve('Success!')
      })

      assert.deepStrictEqual(res, 'Success!')
      processResults(result, expected)
    })

    it('should wrapAsync function and return rejected promise', async function () {
      const expected = setExpected(0, 1, 0)
      const result = resetResult()
      rejectionHandler = () => result.unhandledRejection++
      try {
        const res = await PromiseHelper.wrapAsync(() => {
          result.error++
          return Promise.reject(new Error('Oh no!!'))
        })
        // we should not get here
        assert.notExists(res)
      } catch (err) {
        assert.instanceOf(err, Error)
        assert.equal(err.message, 'Oh no!!')
        processResults(result, expected)
      }
    })

    it('should wrapAsync function and pass resolved promise result to callback', function (done) {
      const expected = setExpected(1, 0, 0)
      const result = resetResult()
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
        assert.deepStrictEqual(result.res, 'Success!')
        assert.notExists(result.err)
      }

      PromiseHelper.wrapAsync(() => {
        return Promise.resolve('Success!')
      }, localCallback)

      setTimeout(processResults, 500, result, expected, done, otherChecks)
    })

    it('should wrapAsync function and pass rejected promise result to callback', function (done) {
      const expected = setExpected(0, 1, 0)
      const result = resetResult()
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
        assert.instanceOf(result.err, Error)
        assert.equal(result.err.message, 'Oh no!!')
        assert.notExists(result.res)
      }

      PromiseHelper.wrapAsync(() => {
        return Promise.reject(new Error('Oh no!!'))
      }, localCallback)

      setTimeout(processResults, 500, result, expected, done, otherChecks)
    })

    it('should wrapAsync function and handle callback that throws uncaught error', function (done) {
      // this test should result in an unhandled rejection
      const expected = setExpected(1, 0, 1)
      const result = resetResult()
      rejectionHandler = () => result.unhandledRejection++
      const localCallback = (err, res) => {
        if (err) {
          result.error++
        }
        if (res) {
          result.success++
          throw new Error('Oops!')
        }
      }

      PromiseHelper.wrapAsync(() => {
        return Promise.resolve('Success!')
      }, localCallback)

      setTimeout(processResults, 500, result, expected, done)
    })

    it('should wrapAsync function and allow continued execution', function (done) {
      const expected = setExpected(1, 1, 0)
      const result = resetResult()
      rejectionHandler = () => result.unhandledRejection++

      const localCallback = (err, res) => {
        if (err) {
          result.error++
          PromiseHelper.wrapAsync(() => {
            return Promise.resolve('Success!')
          }, localCallback)
        }
        if (res) {
          result.success++
        }
      }

      PromiseHelper.wrapAsync(() => {
        return Promise.reject(new Error('Oh no!!'))
      }, localCallback)

      setTimeout(processResults, 500, result, expected, done)
    })
  })
})
