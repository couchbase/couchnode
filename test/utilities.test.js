'use strict'

const assert = require('chai').assert

const { PromiseHelper } = require('../lib/utilities')

describe('#utilities', function () {
  describe('#promisehelper', function () {
    it('should wrap function and return resolved promise', async function () {
      const expected = {
        success: 1,
        error: 0,
      }
      let result = {
        success: 0,
        error: 0,
      }
      const res = await PromiseHelper.wrap((cb) => {
        result.success++
        cb(null, 'Success!')
      })

      assert.deepStrictEqual(res, 'Success!')
      assert.equal(result.success, expected.success)
      assert.equal(result.error, expected.error)
    })

    it('should wrap function and return rejected promise', async function () {
      const expected = {
        success: 0,
        error: 1,
      }
      let result = {
        success: 0,
        error: 0,
      }
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
        assert.equal(result.success, expected.success)
        assert.equal(result.error, expected.error)
      }
    })

    it('should wrap function and pass resolved promise result to callback', function (done) {
      const expected = {
        success: 2,
        error: 0,
      }
      let result = {
        success: 0,
        error: 0,
      }
      const localCallback = (err, res) => {
        if (err) {
          result.error++
        }
        if (res) {
          result.success++
        }
        try {
          assert.deepStrictEqual(res, 'Success!')
          assert.notExists(err)
          assert.deepStrictEqual(result.success, expected.success)
          assert.deepStrictEqual(result.error, expected.error)
          done(null)
        } catch (e) {
          done(e)
        }
      }
      PromiseHelper.wrap((cb) => {
        result.success++
        cb(null, 'Success!')
      }, localCallback)
    })

    it('should wrap function and pass rejected promise result to callback', function (done) {
      const expected = {
        success: 0,
        error: 2,
      }
      let result = {
        success: 0,
        error: 0,
      }
      const localCallback = (err, res) => {
        if (err) {
          result.error++
        }
        if (res) {
          result.success++
        }
        try {
          assert.instanceOf(err, Error)
          assert.equal(err.message, 'Oh no!!')
          assert.notExists(res)
          assert.deepStrictEqual(result.success, expected.success)
          assert.deepStrictEqual(result.error, expected.error)
          done(null)
        } catch (e) {
          done(e)
        }
      }
      PromiseHelper.wrap((cb) => {
        result.error++
        cb(new Error('Oh no!!'), null)
      }, localCallback)
    })

    // BUG(JSCBC-1298): PromiseHelper wrap methods chain then() into catch()
    it('should wrap function and handle callback that throws uncaught error', function (done) {
      this.skip('Skip until JSCBC-1298 is fixed')
      const expected = {
        success: 2,
        error: 0,
      }
      let result = {
        success: 0,
        error: 0,
      }
      const localCallback = (err, res) => {
        if (err) {
          result.error++
        }
        if (res) {
          result.success++
          throw new Error('Oops!')
        }
      }
      const promise = PromiseHelper.wrap((cb) => {
        result.success++
        cb(null, result)
      }, localCallback)

      // if we wait a little bit that gives time for confirm if the callback is hit twice
      setTimeout(() => {
        promise.then(() => {
          try {
            assert.deepStrictEqual(result.success, expected.success)
            assert.deepStrictEqual(result.error, expected.error)
            done(null)
          } catch (e) {
            done(e)
          }
        })
      }, 1000)
    }).timeout(3000)
  })

  describe('#promisehelperasync', function () {
    it('should wrapAsync function and return resolved promise', async function () {
      const expected = {
        success: 1,
        error: 0,
      }
      let result = {
        success: 0,
        error: 0,
      }
      const res = await PromiseHelper.wrapAsync(() => {
        result.success++
        return Promise.resolve('Success!')
      })

      assert.deepStrictEqual(res, 'Success!')
      assert.equal(result.success, expected.success)
      assert.equal(result.error, expected.error)
    })

    it('should wrapAsync function and return rejected promise', async function () {
      const expected = {
        success: 0,
        error: 1,
      }
      let result = {
        success: 0,
        error: 0,
      }
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
        assert.equal(result.success, expected.success)
        assert.equal(result.error, expected.error)
      }
    })

    it('should wrapAsync function and pass resolved promise result to callback', function (done) {
      const expected = {
        success: 2,
        error: 0,
      }
      let result = {
        success: 0,
        error: 0,
      }
      const localCallback = (err, res) => {
        if (err) {
          result.error++
        }
        if (res) {
          result.success++
        }
        try {
          assert.deepStrictEqual(res, 'Success!')
          assert.notExists(err)
          assert.deepStrictEqual(result.success, expected.success)
          assert.deepStrictEqual(result.error, expected.error)
          done(null)
        } catch (e) {
          done(e)
        }
      }
      PromiseHelper.wrapAsync(() => {
        result.success++
        return Promise.resolve('Success!')
      }, localCallback)
    })

    it('should wrapAsync function and pass rejected promise result to callback', function (done) {
      const expected = {
        success: 0,
        error: 2,
      }
      let result = {
        success: 0,
        error: 0,
      }
      const localCallback = (err, res) => {
        if (err) {
          result.error++
        }
        if (res) {
          result.success++
        }
        try {
          assert.instanceOf(err, Error)
          assert.equal(err.message, 'Oh no!!')
          assert.notExists(res)
          assert.deepStrictEqual(result.success, expected.success)
          assert.deepStrictEqual(result.error, expected.error)
          done(null)
        } catch (e) {
          done(e)
        }
      }
      PromiseHelper.wrapAsync(() => {
        result.error++
        return Promise.reject(new Error('Oh no!!'))
      }, localCallback)
    })

    // BUG(JSCBC-1298): PromiseHelper wrap methods chain then() into catch()
    it('should wrapAsync function and handle callback that throws uncaught error', function (done) {
      this.skip('Skip until JSCBC-1298 is fixed')
      const expected = {
        success: 2,
        error: 0,
      }
      let result = {
        success: 0,
        error: 0,
      }
      const localCallback = (err, res) => {
        if (err) {
          result.error++
        }
        if (res) {
          result.success++
          throw new Error('Oops!')
        }
      }
      const promise = PromiseHelper.wrapAsync(() => {
        result.success++
        return Promise.resolve('Success!')
      }, localCallback)

      // if we wait a little bit that gives time for confirm if the callback is hit twice
      setTimeout(() => {
        promise.then(() => {
          try {
            assert.deepStrictEqual(result.success, expected.success)
            assert.deepStrictEqual(result.error, expected.error)
            done(null)
          } catch (e) {
            done(e)
          }
        })
      }, 1000)
    }).timeout(3000)
  })
})
