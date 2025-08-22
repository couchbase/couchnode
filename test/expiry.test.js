'use strict'

const assert = require('chai').assert
const H = require('./harness')

function genericTests(collFn) {
  /* eslint-disable mocha/no-setup-in-describe */
  describe('#expiry', function () {
    const thirtyDaysInSeconds = 30 * 24 * 60 * 60
    const fiftyYearsInSeconds = 50 * 365 * 24 * 60 * 60
    // The server treats values <= 259200 (30 days) as relative to the current time.
    // So, the minimum expiry date is 259201 which corresponds to 1970-01-31T00:00:01Z
    const minExpiryDate = new Date('1970-01-31T00:00:01Z')
    // 2106-02-07T06:28:15Z in seconds (4294967295) is max 32-bit unsigned integer and server max expiry
    const maxExpiry = 4294967295
    const maxExpiryDate = new Date('2106-02-07T06:28:15Z')
    const zeroSecondDate = new Date('1970-01-31T00:00:00Z')

    let testKeyMutExp
    let testKeyUpExp
    let testKeyTouchExp
    let originalWarningListener
    let warningHandler

    function warningListener() {
      if (warningHandler instanceof Function) {
        warningHandler()
      }
    }

    before(async function () {
      H.skipIfMissingFeature(this, H.Features.Xattr)
      testKeyMutExp = H.genTestKey()
      testKeyUpExp = H.genTestKey()
      testKeyTouchExp = H.genTestKey()

      originalWarningListener = process.listeners('warning').pop()
      process.removeListener('warning', originalWarningListener)
      process.on('warning', warningListener)
    })

    after(function () {
      // don't need to handle the warning listener if we skipped the tests
      if (H.supportsFeature(H.Features.Xattr)) {
        process.addListener('warning', originalWarningListener)
        process.removeListener('warning', warningListener)
      }
    })

    const kvMutationMethodMap = {
      insert: { value: { foo: 'bar' }, opts: {} },
      upsert: { value: { foo: 'bar' }, opts: {} },
      decrement: { value: 1, opts: { initial: 10 } },
      increment: { value: 1, opts: { initial: 10 } },
    }

    const kvUpdateMethodMap = {
      replace: { value: { foo: 'bar' }, opts: {} },
      mutateIn: {
        value: [H.lib.MutateInSpec.upsert('foo', 'world')],
        opts: {},
      },
    }

    const kvTouchMethods = ['getAndTouch', 'touch']

    // **IMPORTANT** The SDK does not support setting expiry as a unix timestamp directly, a Date should be used instead.
    //
    // These tests are here to confirm the behavior when a timestamp is passed in.  The expiry will not be what a users expects
    // as an additional Math.floor(Date.now() / 1000) will be added to the expiry.
    // These tests will also confirm that a warning is emitted to the user to inform them of the unsupported unix timestamp usage.
    describe('#expiryUnixTimestamp', function () {
      // Math.floor(Date.now() / 1000) = 1755879101 (as of 2025-08-22)
      // So all values converted to Unix timestamp will be greater than 50 years (1576800000)
      const testCases = [
        1800, // 30 minutes
        thirtyDaysInSeconds - 1, // < 30 days expiry
        thirtyDaysInSeconds, // == 30 days expiry
        thirtyDaysInSeconds + 1, // > 30 days expiry
        thirtyDaysInSeconds * 2, // == 60 days expiry
      ]

      Object.keys(kvMutationMethodMap).forEach((funcName) => {
        describe(`#expiryUnixTimestamp-${funcName}`, function () {
          afterEach(async function () {
            try {
              await collFn().remove(testKeyMutExp)
            } catch (e) {
              // ignore
            }
            warningHandler = null
          })

          testCases.forEach((expiry) => {
            it(`executes w/ expiry=${expiry} - ${funcName}`, async function () {
              let warningCount = 0
              warningHandler = () => warningCount++
              const before = Math.floor(Date.now() / 1000) - 3
              const { value, opts } = kvMutationMethodMap[funcName]
              const expiryUnix = Math.floor(Date.now() / 1000) + expiry
              opts.expiry = expiryUnix
              let res
              if (funcName === 'decrement' || funcName === 'increment') {
                res = await collFn()
                  .binary()
                  [funcName](testKeyMutExp, value, opts)
              } else {
                res = await collFn()[funcName](testKeyMutExp, value, opts)
              }
              assert.isObject(res.cas)
              const expiryRes = (
                await collFn().lookupIn(testKeyMutExp, [
                  H.lib.LookupInSpec.get(H.lib.LookupInMacro.Expiry, {
                    xattr: true,
                  }),
                ])
              ).content[0].value
              const after = Math.floor(Date.now() / 1000) + 3
              assert.isTrue(
                expiryRes >= before + expiryUnix,
                `expiryRes: ${expiryRes}, before: ${before}, expiryUnix: ${expiryUnix}`
              )
              assert.isTrue(
                expiryRes <= expiryUnix + after,
                `expiryRes: ${expiryRes}, expiryUnix: ${expiryUnix}, after: ${after}`
              )
              assert.equal(warningCount, 1)
            })
          })
        })
      })

      Object.keys(kvUpdateMethodMap).forEach((funcName) => {
        describe(`#expiryUnixTimestamp-${funcName}`, function () {
          beforeEach(async function () {
            await collFn().upsert(testKeyUpExp, { foo: 'bar' })
          })

          afterEach(async function () {
            try {
              await collFn().remove(testKeyUpExp)
            } catch (e) {
              // ignore
            }
            warningHandler = null
          })

          testCases.forEach((expiry) => {
            it(`executes w/ expiry=${expiry} - ${funcName}`, async function () {
              let warningCount = 0
              warningHandler = () => warningCount++
              const before = Math.floor(Date.now() / 1000) - 3
              const { value, opts } = kvUpdateMethodMap[funcName]
              const expiryUnix = Math.floor(Date.now() / 1000) + expiry
              opts.expiry = expiryUnix
              const res = await collFn()[funcName](testKeyUpExp, value, opts)
              assert.isObject(res.cas)
              const expiryRes = (
                await collFn().lookupIn(testKeyUpExp, [
                  H.lib.LookupInSpec.get(H.lib.LookupInMacro.Expiry, {
                    xattr: true,
                  }),
                ])
              ).content[0].value
              const after = Math.floor(Date.now() / 1000) + 3
              assert.isTrue(
                expiryRes >= before + expiryUnix,
                `expiryRes: ${expiryRes}, before: ${before}, expiryUnix: ${expiryUnix}`
              )
              assert.isTrue(
                expiryRes <= expiryUnix + after,
                `expiryRes: ${expiryRes}, expiryUnix: ${expiryUnix}, after: ${after}`
              )
              assert.equal(warningCount, 1)
            })
          })
        })
      })

      kvTouchMethods.forEach((funcName) => {
        describe(`#expiryUnixTimestamp-${funcName}`, function () {
          beforeEach(async function () {
            await collFn().upsert(testKeyTouchExp, { foo: 'bar' })
          })

          afterEach(async function () {
            try {
              await collFn().remove(testKeyTouchExp)
            } catch (e) {
              // ignore
            }
            warningHandler = null
          })

          testCases.forEach((expiry) => {
            it(`executes w/ expiry=${expiry} - ${funcName}`, async function () {
              let warningCount = 0
              warningHandler = () => warningCount++
              const before = Math.floor(Date.now() / 1000) - 3
              const expiryUnix = Math.floor(Date.now() / 1000) + expiry
              const res = await collFn()[funcName](testKeyTouchExp, expiryUnix)
              assert.isObject(res)
              const expiryRes = (
                await collFn().lookupIn(testKeyTouchExp, [
                  H.lib.LookupInSpec.get(H.lib.LookupInMacro.Expiry, {
                    xattr: true,
                  }),
                ])
              ).content[0].value
              const after = Math.floor(Date.now() / 1000) + 3
              assert.isTrue(
                expiryRes >= before + expiryUnix,
                `expiryRes: ${expiryRes}, before: ${before}, expiryUnix: ${expiryUnix}`
              )
              assert.isTrue(
                expiryRes <= expiryUnix + after,
                `expiryRes: ${expiryRes}, expiryUnix: ${expiryUnix}, after: ${after}`
              )
              assert.equal(warningCount, 1)
            })
          })
        })
      })
    })

    describe('#expiryInvalid', function () {
      const kvMutationMethodMapClone = JSON.parse(
        JSON.stringify(kvMutationMethodMap)
      )
      const kvUpdateMethodMapClone = JSON.parse(
        JSON.stringify(kvUpdateMethodMap)
      )

      const failureCases = [
        -1, // negative
        '100', // not a number
        maxExpiry + 1, // greater than max expiry
        new Date('not a real date'), // invalid date
        new Date('1970-01-30T23:59:59Z'), // < min expiry Date
        new Date('2106-02-07T06:28:16Z'), // > max expiry Date
      ]

      Object.keys(kvMutationMethodMapClone).forEach((funcName) => {
        describe(`#expiryInvalid-${funcName}`, function () {
          failureCases.forEach((expiry) => {
            it(`correctly handles invalid expiry (${expiry}) - ${funcName}`, async function () {
              const { value, opts } = kvMutationMethodMapClone[funcName]
              opts.expiry = expiry
              await H.throwsHelper(async () => {
                if (funcName === 'decrement' || funcName === 'increment') {
                  await collFn().binary()[funcName](testKeyMutExp, value, opts)
                } else {
                  await collFn()[funcName](testKeyMutExp, value, opts)
                }
              }, H.lib.InvalidArgumentError)
            })
          })
        })
      })

      Object.keys(kvUpdateMethodMapClone).forEach((funcName) => {
        describe(`#expiryInvalid-${funcName}`, function () {
          failureCases.forEach((expiry) => {
            it(`correctly handles invalid expiry (${expiry}) - ${funcName}`, async function () {
              const { value, opts } = kvUpdateMethodMapClone[funcName]
              opts.expiry = expiry
              await H.throwsHelper(async () => {
                await collFn()[funcName](testKeyUpExp, value, opts)
              }, H.lib.InvalidArgumentError)
            })
          })
        })
      })

      kvTouchMethods.forEach((funcName) => {
        describe(`#expiryInvalid-${funcName}`, function () {
          failureCases.forEach((expiry) => {
            it(`correctly handles invalid expiry (${expiry}) - ${funcName}`, async function () {
              await H.throwsHelper(async () => {
                await collFn()[funcName](testKeyTouchExp, expiry)
              }, H.lib.InvalidArgumentError)
            })
          })
        })
      })
    })

    describe('#noExpiry', function () {
      const kvMutationMethodMapClone = JSON.parse(
        JSON.stringify(kvMutationMethodMap)
      )
      const kvUpdateMethodMapClone = JSON.parse(
        JSON.stringify(kvUpdateMethodMap)
      )

      Object.keys(kvMutationMethodMapClone).forEach((funcName) => {
        describe(`#noExpiry-${funcName}`, function () {
          afterEach(async function () {
            try {
              await collFn().remove(testKeyMutExp)
            } catch (e) {
              // ignore
            }
            warningHandler = null
          })

          it(`correctly executes with no expiry - ${funcName}`, async function () {
            const { value, opts } = kvMutationMethodMapClone[funcName]
            let res
            if (funcName === 'decrement' || funcName === 'increment') {
              res = await collFn()
                .binary()
                [funcName](testKeyMutExp, value, opts)
            } else {
              res = await collFn()[funcName](testKeyMutExp, value)
            }
            assert.isObject(res.cas)
            const expiryRes = (
              await collFn().lookupIn(testKeyMutExp, [
                H.lib.LookupInSpec.get(H.lib.LookupInMacro.Expiry, {
                  xattr: true,
                }),
              ])
            ).content[0].value
            assert.strictEqual(expiryRes, 0)
          })

          it(`correctly executes with zero expiry - ${funcName}`, async function () {
            const { value, opts } = kvMutationMethodMapClone[funcName]
            opts.expiry = 0
            let res
            if (funcName === 'decrement' || funcName === 'increment') {
              res = await collFn()
                .binary()
                [funcName](testKeyMutExp, value, opts)
            } else {
              res = await collFn()[funcName](testKeyMutExp, value, opts)
            }
            assert.isObject(res.cas)
            const expiryRes = (
              await collFn().lookupIn(testKeyMutExp, [
                H.lib.LookupInSpec.get(H.lib.LookupInMacro.Expiry, {
                  xattr: true,
                }),
              ])
            ).content[0].value
            assert.strictEqual(expiryRes, 0)
          })

          it(`correctly executes with zero instant date expiry - ${funcName}`, async function () {
            const { value, opts } = kvMutationMethodMapClone[funcName]
            opts.expiry = zeroSecondDate
            let res
            if (funcName === 'decrement' || funcName === 'increment') {
              res = await collFn()
                .binary()
                [funcName](testKeyMutExp, value, opts)
            } else {
              res = await collFn()[funcName](testKeyMutExp, value, opts)
            }
            assert.isObject(res.cas)
            const expiryRes = (
              await collFn().lookupIn(testKeyMutExp, [
                H.lib.LookupInSpec.get(H.lib.LookupInMacro.Expiry, {
                  xattr: true,
                }),
              ])
            ).content[0].value
            assert.strictEqual(expiryRes, 0)
          })
        })
      })

      Object.keys(kvUpdateMethodMapClone).forEach((funcName) => {
        describe(`#noExpiry-${funcName}`, function () {
          beforeEach(async function () {
            await collFn().upsert(testKeyUpExp, { foo: 'bar' })
          })

          afterEach(async function () {
            try {
              await collFn().remove(testKeyUpExp)
            } catch (e) {
              // ignore
            }
            warningHandler = null
          })

          it(`correctly executes with no expiry - ${funcName}`, async function () {
            const { value } = kvUpdateMethodMapClone[funcName]
            const res = await collFn()[funcName](testKeyUpExp, value)
            assert.isObject(res.cas)
            const expiryRes = (
              await collFn().lookupIn(testKeyUpExp, [
                H.lib.LookupInSpec.get(H.lib.LookupInMacro.Expiry, {
                  xattr: true,
                }),
              ])
            ).content[0].value
            assert.strictEqual(expiryRes, 0)
          })

          it(`correctly executes with zero expiry - ${funcName}`, async function () {
            const { value, opts } = kvUpdateMethodMapClone[funcName]
            opts.expiry = 0
            const res = await collFn()[funcName](testKeyUpExp, value, opts)
            assert.isObject(res.cas)
            const expiryRes = (
              await collFn().lookupIn(testKeyUpExp, [
                H.lib.LookupInSpec.get(H.lib.LookupInMacro.Expiry, {
                  xattr: true,
                }),
              ])
            ).content[0].value
            assert.strictEqual(expiryRes, 0)
          })

          it(`correctly executes with zero instant date expiry - ${funcName}`, async function () {
            const { value, opts } = kvUpdateMethodMapClone[funcName]
            opts.expiry = zeroSecondDate
            const res = await collFn()[funcName](testKeyUpExp, value, opts)
            assert.isObject(res.cas)
            const expiryRes = (
              await collFn().lookupIn(testKeyUpExp, [
                H.lib.LookupInSpec.get(H.lib.LookupInMacro.Expiry, {
                  xattr: true,
                }),
              ])
            ).content[0].value
            assert.strictEqual(expiryRes, 0)
          })
        })
      })

      kvTouchMethods.forEach((funcName) => {
        describe(`#noExpiry-${funcName}`, function () {
          beforeEach(async function () {
            await collFn().upsert(testKeyTouchExp, { foo: 'bar' })
          })

          afterEach(async function () {
            try {
              await collFn().remove(testKeyTouchExp)
            } catch (e) {
              // ignore
            }
            warningHandler = null
          })

          it(`correctly executes with zero expiry - ${funcName}`, async function () {
            const res = await collFn()[funcName](testKeyTouchExp, 0)
            assert.isObject(res.cas)
            const expiryRes = (
              await collFn().lookupIn(testKeyTouchExp, [
                H.lib.LookupInSpec.get(H.lib.LookupInMacro.Expiry, {
                  xattr: true,
                }),
              ])
            ).content[0].value
            assert.strictEqual(expiryRes, 0)
          })

          it(`correctly executes with zero instant date expiry - ${funcName}`, async function () {
            const res = await collFn()[funcName](
              testKeyTouchExp,
              zeroSecondDate
            )
            assert.isObject(res.cas)
            const expiryRes = (
              await collFn().lookupIn(testKeyTouchExp, [
                H.lib.LookupInSpec.get(H.lib.LookupInMacro.Expiry, {
                  xattr: true,
                }),
              ])
            ).content[0].value
            assert.strictEqual(expiryRes, 0)
          })
        })
      })
    })

    describe('#expiryDuration', function () {
      const kvMutationMethodMapClone = JSON.parse(
        JSON.stringify(kvMutationMethodMap)
      )
      const kvUpdateMethodMapClone = JSON.parse(
        JSON.stringify(kvUpdateMethodMap)
      )

      const allowedCases = [
        1800, // 30 minutes expiry duration
        thirtyDaysInSeconds - 1, // < 30 days expiry duration
        thirtyDaysInSeconds, // == 30 days expiry duration
        thirtyDaysInSeconds + 1, // > 30 days expiry duration
        thirtyDaysInSeconds * 2, // == 60 days expiry duration
        // use Math.ceil() to ensure the expiryDuration when converted to expiryInstant will always be <= 4294967295
        // This is a contrived test to confirm expiryDuration is handled correctly.  If users want the max they should
        // use expiryInstant: 4294967295.
        // maxExpiry - Math.ceil(Date.now() / 1000), // max expiryDuration
      ]

      Object.keys(kvMutationMethodMapClone).forEach((funcName) => {
        describe(`#expiryDuration-${funcName}`, function () {
          afterEach(async function () {
            try {
              await collFn().remove(testKeyMutExp)
            } catch (e) {
              // ignore
            }
          })

          allowedCases.forEach((expiryDuration) => {
            it(`correctly executes w/ expiry as duration; expiry=${expiryDuration} - ${funcName}`, async function () {
              const before = Math.floor(Date.now() / 1000) - 3
              const { value, opts } = kvMutationMethodMapClone[funcName]
              opts.expiry = expiryDuration
              let res
              if (funcName === 'decrement' || funcName === 'increment') {
                res = await collFn()
                  .binary()
                  [funcName](testKeyMutExp, value, opts)
              } else {
                res = await collFn()[funcName](testKeyMutExp, value, opts)
              }
              assert.isObject(res.cas)
              const expiryRes = (
                await collFn().lookupIn(testKeyMutExp, [
                  H.lib.LookupInSpec.get(H.lib.LookupInMacro.Expiry, {
                    xattr: true,
                  }),
                ])
              ).content[0].value
              const after = Math.floor(Date.now() / 1000) + 3
              assert.isTrue(
                expiryRes >= before + expiryDuration,
                `expiryRes: ${expiryRes}, before: ${before}, expiryDuration: ${expiryDuration}`
              )
              assert.isTrue(
                expiryRes <= expiryDuration + after,
                `expiryRes: ${expiryRes}, expiryDuration: ${expiryDuration}, after: ${after}`
              )
            })
          })

          it(`correctly executes w/ max expiry duration - ${funcName}`, async function () {
            const before = Math.floor(Date.now() / 1000) - 3
            const { value, opts } = kvMutationMethodMapClone[funcName]
            const unixTimeSecs = Math.floor(Date.now() / 1000)
            let res, expiryDuration
            if (funcName === 'decrement' || funcName === 'increment') {
              // Max 32-bit unsigned int (0xFFFFFFFF) is a special case for increment/decrement.
              // Max allowed is 4294967294 which is 2106-02-07T06:28:14Z
              expiryDuration = maxExpiry - unixTimeSecs - 1
              opts.expiry = expiryDuration
              res = await collFn()
                .binary()
                [funcName](testKeyMutExp, value, opts)
            } else {
              expiryDuration = maxExpiry - unixTimeSecs
              opts.expiry = expiryDuration
              res = await collFn()[funcName](testKeyMutExp, value, opts)
            }
            assert.isObject(res.cas)
            const expiryRes = (
              await collFn().lookupIn(testKeyMutExp, [
                H.lib.LookupInSpec.get(H.lib.LookupInMacro.Expiry, {
                  xattr: true,
                }),
              ])
            ).content[0].value
            const after = Math.floor(Date.now() / 1000) + 3
            assert.isTrue(
              expiryRes >= before + expiryDuration,
              `expiryRes: ${expiryRes}, before: ${before}, expiryDuration: ${expiryDuration}`
            )
            assert.isTrue(
              expiryRes <= expiryDuration + after,
              `expiryRes: ${expiryRes}, expiryDuration: ${expiryDuration}, after: ${after}`
            )
          })
        })
      })

      Object.keys(kvUpdateMethodMapClone).forEach((funcName) => {
        describe(`#expiryDuration-${funcName}`, function () {
          beforeEach(async function () {
            await collFn().upsert(testKeyUpExp, { foo: 'bar' })
          })

          afterEach(async function () {
            try {
              await collFn().remove(testKeyUpExp)
            } catch (e) {
              // ignore
            }
          })

          allowedCases.forEach((expiryDuration) => {
            it(`correctly executes w/ expiry as duration; expiry=${expiryDuration} - ${funcName}`, async function () {
              const before = Math.floor(Date.now() / 1000) - 3
              const { value, opts } = kvUpdateMethodMapClone[funcName]
              opts.expiry = expiryDuration
              const res = await collFn()[funcName](testKeyUpExp, value, opts)
              assert.isObject(res.cas)
              const expiryRes = (
                await collFn().lookupIn(testKeyUpExp, [
                  H.lib.LookupInSpec.get(H.lib.LookupInMacro.Expiry, {
                    xattr: true,
                  }),
                ])
              ).content[0].value
              const after = Math.floor(Date.now() / 1000) + 3
              assert.isTrue(
                expiryRes >= before + expiryDuration,
                `expiryRes: ${expiryRes}, before: ${before}, expiryDuration: ${expiryDuration}`
              )
              assert.isTrue(
                expiryRes <= expiryDuration + after,
                `expiryRes: ${expiryRes}, expiryDuration: ${expiryDuration}, after: ${after}`
              )
            })
          })

          it(`correctly executes w/ max expiry duration - ${funcName}`, async function () {
            const before = Math.floor(Date.now() / 1000) - 3
            const { value, opts } = kvUpdateMethodMapClone[funcName]
            const unixTimeSecs = Math.floor(Date.now() / 1000)
            const expiryDuration = maxExpiry - unixTimeSecs
            opts.expiry = expiryDuration
            const res = await collFn()[funcName](testKeyUpExp, value, opts)
            assert.isObject(res.cas)
            const expiryRes = (
              await collFn().lookupIn(testKeyUpExp, [
                H.lib.LookupInSpec.get(H.lib.LookupInMacro.Expiry, {
                  xattr: true,
                }),
              ])
            ).content[0].value
            const after = Math.floor(Date.now() / 1000) + 3
            assert.isTrue(
              expiryRes >= before + expiryDuration,
              `expiryRes: ${expiryRes}, before: ${before}, expiryDuration: ${expiryDuration}`
            )
            assert.isTrue(
              expiryRes <= expiryDuration + after,
              `expiryRes: ${expiryRes}, expiryDuration: ${expiryDuration}, after: ${after}`
            )
          })
        })
      })

      kvTouchMethods.forEach((funcName) => {
        describe(`#expiryDuration-${funcName}`, function () {
          beforeEach(async function () {
            await collFn().upsert(testKeyTouchExp, { foo: 'bar' })
          })

          afterEach(async function () {
            try {
              await collFn().remove(testKeyTouchExp)
            } catch (e) {
              // ignore
            }
            warningHandler = null
          })

          allowedCases.forEach((expiryDuration) => {
            it(`correctly executes w/ expiry as duration; expiry=${expiryDuration} - ${funcName}`, async function () {
              const before = Math.floor(Date.now() / 1000) - 3
              const res = await collFn()[funcName](
                testKeyTouchExp,
                expiryDuration
              )
              assert.isObject(res.cas)
              const expiryRes = (
                await collFn().lookupIn(testKeyTouchExp, [
                  H.lib.LookupInSpec.get(H.lib.LookupInMacro.Expiry, {
                    xattr: true,
                  }),
                ])
              ).content[0].value
              const after = Math.floor(Date.now() / 1000) + 3
              assert.isTrue(
                expiryRes >= before + expiryDuration,
                `expiryRes: ${expiryRes}, before: ${before}, expiryDuration: ${expiryDuration}`
              )
              assert.isTrue(
                expiryRes <= expiryDuration + after,
                `expiryRes: ${expiryRes}, expiryDuration: ${expiryDuration}, after: ${after}`
              )
            })
          })

          it(`correctly executes w/ max expiry duration - ${funcName}`, async function () {
            const unixTimeSecs = Math.floor(Date.now() / 1000)
            const before = unixTimeSecs - 3
            const expiryDuration = maxExpiry - unixTimeSecs
            const res = await collFn()[funcName](
              testKeyTouchExp,
              expiryDuration
            )
            assert.isObject(res.cas)
            const expiryRes = (
              await collFn().lookupIn(testKeyTouchExp, [
                H.lib.LookupInSpec.get(H.lib.LookupInMacro.Expiry, {
                  xattr: true,
                }),
              ])
            ).content[0].value
            const after = Math.floor(Date.now() / 1000) + 3
            assert.isTrue(
              expiryRes >= before + expiryDuration,
              `expiryRes: ${expiryRes}, before: ${before}, expiryDuration: ${expiryDuration}`
            )
            assert.isTrue(
              expiryRes <= expiryDuration + after,
              `expiryRes: ${expiryRes}, expiryDuration: ${expiryDuration}, after: ${after}`
            )
          })
        })
      })
    })

    describe('#expiryInstant', function () {
      const kvMutationMethodMapClone = JSON.parse(
        JSON.stringify(kvMutationMethodMap)
      )
      const kvUpdateMethodMapClone = JSON.parse(
        JSON.stringify(kvUpdateMethodMap)
      )

      const expiryAsAbsoluteDate = (seconds) => {
        const now = new Date()
        return new Date(now.getTime() + seconds * 1000)
      }

      const allowedCases = [
        1800, // 30 minutes
        thirtyDaysInSeconds - 1, // < 30 days
        thirtyDaysInSeconds, // == 30 days
        thirtyDaysInSeconds + 1, // > 30 days
        thirtyDaysInSeconds * 2, // == 60 days
        fiftyYearsInSeconds, // 50 years
        fiftyYearsInSeconds + 1, // 50 years + 1 second
      ]

      Object.keys(kvMutationMethodMapClone).forEach((funcName) => {
        describe(`#expiryInstant-${funcName}`, function () {
          afterEach(async function () {
            try {
              await collFn().remove(testKeyMutExp)
            } catch (e) {
              // ignore
            }
            warningHandler = null
          })

          allowedCases.forEach((expiryInstant) => {
            it(`correctly executes w/ expiry as Date; expiry=${expiryInstant} - ${funcName}`, async function () {
              const { value, opts } = kvMutationMethodMapClone[funcName]
              const expiry = expiryAsAbsoluteDate(expiryInstant)
              opts.expiry = expiry
              let res
              if (funcName === 'decrement' || funcName === 'increment') {
                res = await collFn()
                  .binary()
                  [funcName](testKeyMutExp, value, opts)
              } else {
                res = await collFn()[funcName](testKeyMutExp, value, opts)
              }
              assert.isObject(res.cas)
              const expiryRes = (
                await collFn().lookupIn(testKeyMutExp, [
                  H.lib.LookupInSpec.get(H.lib.LookupInMacro.Expiry, {
                    xattr: true,
                  }),
                ])
              ).content[0].value
              const expiryInstantEpochSeconds = Math.floor(
                expiry.getTime() / 1000
              )
              // expiryRes should equal expiryInstant (as epoch seconds); allow +/- 1 second for tests to run smoothly
              assert.isTrue(
                expiryRes >= expiryInstantEpochSeconds - 1,
                `expiryRes: ${expiryRes}, expiryInstantEpochSeconds-1: ${expiryInstantEpochSeconds - 1}`
              )
              assert.isTrue(
                expiryRes <= expiryInstantEpochSeconds + 1,
                `expiryRes: ${expiryRes}, expiryInstantEpochSeconds+1: ${expiryInstantEpochSeconds + 1}`
              )
            })
          })

          // Valid date, but in the past so the document should immediately expire
          it(`correctly executes w/ expiry=minExpiryDate (${minExpiryDate.toISOString()}) - ${funcName}`, async function () {
            const { value, opts } = kvMutationMethodMapClone[funcName]
            opts.expiry = minExpiryDate
            let res
            if (funcName === 'decrement' || funcName === 'increment') {
              res = await collFn()
                .binary()
                [funcName](testKeyMutExp, value, opts)
            } else {
              res = await collFn()[funcName](testKeyMutExp, value, opts)
            }
            assert.isObject(res.cas)
            await H.throwsHelper(async () => {
              await collFn().get(testKeyMutExp)
            }, H.lib.DocumentNotFoundError)
          })

          it(`correctly executes w/ expiry=maxExpiryDate (${maxExpiryDate.toISOString()}) - ${funcName}`, async function () {
            const { value, opts } = kvMutationMethodMapClone[funcName]
            let res
            if (funcName === 'decrement' || funcName === 'increment') {
              // Max 32-bit unsigned int (0xFFFFFFFF) is a special case for increment/decrement.
              // Max allowed is 4294967294 which is 2106-02-07T06:28:14Z
              opts.expiry = new Date('2106-02-07T06:28:14Z')
              res = await collFn()
                .binary()
                [funcName](testKeyMutExp, value, opts)
            } else {
              opts.expiry = maxExpiryDate
              res = await collFn()[funcName](testKeyMutExp, value, opts)
            }
            assert.isObject(res.cas)
            const expiryRes = (
              await collFn().lookupIn(testKeyMutExp, [
                H.lib.LookupInSpec.get(H.lib.LookupInMacro.Expiry, {
                  xattr: true,
                }),
              ])
            ).content[0].value
            // handle increment/decrement special case
            if (funcName === 'decrement' || funcName === 'increment') {
              assert.isTrue(
                expiryRes == maxExpiry - 1,
                `expiryRes: ${expiryRes}, maxExpiry-1: ${maxExpiry - 1}`
              )
            } else {
              assert.isTrue(
                expiryRes == maxExpiry,
                `expiryRes: ${expiryRes}, maxExpiry: ${maxExpiry}`
              )
            }
          })
        })
      })

      Object.keys(kvUpdateMethodMapClone).forEach((funcName) => {
        describe(`#expiryInstant-${funcName}`, function () {
          beforeEach(async function () {
            await collFn().upsert(testKeyUpExp, { foo: 'bar' })
          })

          afterEach(async function () {
            try {
              await collFn().remove(testKeyUpExp)
            } catch (e) {
              // ignore
            }
          })

          allowedCases.forEach((expiryInstant) => {
            it(`correctly executes w/ expiry as Date; expiry=${expiryInstant} - ${funcName}`, async function () {
              const { value, opts } = kvUpdateMethodMapClone[funcName]
              const expiry = expiryAsAbsoluteDate(expiryInstant)
              opts.expiry = expiry
              const res = await collFn()[funcName](testKeyUpExp, value, opts)
              assert.isObject(res.cas)
              const expiryRes = (
                await collFn().lookupIn(testKeyUpExp, [
                  H.lib.LookupInSpec.get(H.lib.LookupInMacro.Expiry, {
                    xattr: true,
                  }),
                ])
              ).content[0].value
              const expiryInstantEpochSeconds = Math.floor(
                expiry.getTime() / 1000
              )
              // expiryRes should equal expiryInstant (as epoch seconds); allow +/- 1 second for tests to run smoothly
              assert.isTrue(
                expiryRes >= expiryInstantEpochSeconds - 1,
                `expiryRes: ${expiryRes}, expiryInstantEpochSeconds-1: ${expiryInstantEpochSeconds - 1}`
              )
              assert.isTrue(
                expiryRes <= expiryInstantEpochSeconds + 1,
                `expiryRes: ${expiryRes}, expiryInstantEpochSeconds+1: ${expiryInstantEpochSeconds + 1}`
              )
            })
          })

          // Valid date, but in the past so the document should immediately expire
          it(`correctly executes w/ expiry=minExpiryDate (${minExpiryDate.toISOString()}) - ${funcName}`, async function () {
            const { value, opts } = kvUpdateMethodMapClone[funcName]
            opts.expiry = minExpiryDate
            const res = await collFn()[funcName](testKeyUpExp, value, opts)
            assert.isObject(res.cas)
            await H.throwsHelper(async () => {
              await collFn().get(testKeyUpExp)
            }, H.lib.DocumentNotFoundError)
          })

          it(`correctly executes w/ expiry=maxExpiryDate (${maxExpiryDate.toISOString()}) - ${funcName}`, async function () {
            const { value, opts } = kvUpdateMethodMap[funcName]
            opts.expiry = maxExpiryDate
            const res = await collFn()[funcName](testKeyUpExp, value, opts)
            assert.isObject(res.cas)
            const expiryRes = (
              await collFn().lookupIn(testKeyUpExp, [
                H.lib.LookupInSpec.get(H.lib.LookupInMacro.Expiry, {
                  xattr: true,
                }),
              ])
            ).content[0].value
            assert.isTrue(
              expiryRes == maxExpiry,
              `expiryRes: ${expiryRes}, maxExpiry: ${maxExpiry}`
            )
          })
        })
      })

      kvTouchMethods.forEach((funcName) => {
        describe(`#expiryInstant-${funcName}`, function () {
          beforeEach(async function () {
            await collFn().upsert(testKeyTouchExp, { foo: 'bar' })
          })

          afterEach(async function () {
            try {
              await collFn().remove(testKeyTouchExp)
            } catch (e) {
              // ignore
            }
            warningHandler = null
          })

          allowedCases.forEach((expiryInstant) => {
            it(`correctly executes w/ expiry as Date; expiry=${expiryInstant} - ${funcName}`, async function () {
              const expiry = expiryAsAbsoluteDate(expiryInstant)
              const res = await collFn()[funcName](testKeyTouchExp, expiry)
              assert.isObject(res.cas)
              const expiryRes = (
                await collFn().lookupIn(testKeyTouchExp, [
                  H.lib.LookupInSpec.get(H.lib.LookupInMacro.Expiry, {
                    xattr: true,
                  }),
                ])
              ).content[0].value
              const expiryInstantEpochSeconds = Math.floor(
                expiry.getTime() / 1000
              )
              // expiryRes should equal expiryInstant (as epoch seconds); allow +/- 1 second for tests to run smoothly
              assert.isTrue(
                expiryRes >= expiryInstantEpochSeconds - 1,
                `expiryRes: ${expiryRes}, expiryInstantEpochSeconds-1: ${expiryInstantEpochSeconds - 1}`
              )
              assert.isTrue(
                expiryRes <= expiryInstantEpochSeconds + 1,
                `expiryRes: ${expiryRes}, expiryInstantEpochSeconds+1: ${expiryInstantEpochSeconds + 1}`
              )
            })
          })

          // Valid date, but in the past so the document should immediately expire
          it(`correctly executes w/ expiry=minExpiryDate (${minExpiryDate.toISOString()}) - ${funcName}`, async function () {
            const res = await collFn()[funcName](testKeyTouchExp, minExpiryDate)
            assert.isObject(res.cas)
            await H.throwsHelper(async () => {
              await collFn().get(testKeyTouchExp)
            }, H.lib.DocumentNotFoundError)
          })

          it(`correctly executes w/ expiry=maxExpiryDate (${maxExpiryDate.toISOString()}) - ${funcName}`, async function () {
            const res = await collFn()[funcName](testKeyTouchExp, maxExpiryDate)
            assert.isObject(res.cas)
            const expiryRes = (
              await collFn().lookupIn(testKeyTouchExp, [
                H.lib.LookupInSpec.get(H.lib.LookupInMacro.Expiry, {
                  xattr: true,
                }),
              ])
            ).content[0].value
            assert.isTrue(
              expiryRes == maxExpiry,
              `expiryRes: ${expiryRes}, maxExpiry: ${maxExpiry}`
            )
          })
        })
      })
    })
  })
}

describe('#default-collection', function () {
  /* eslint-disable-next-line mocha/no-setup-in-describe */
  genericTests(() => H.dco)
})

describe('#named-collection', function () {
  /* eslint-disable-next-line mocha/no-hooks-for-single-case */
  before(async function () {
    H.skipIfMissingFeature(this, H.Features.Collections)
    this.timeout(5000)
    try {
      await H.consistencyUtils.waitUntilCollectionPresent(
        H.bucketName,
        H.scopeName,
        H.collectionName
      )
    } catch (e) {
      const msg = `Collection ${H.bucketName}.${H.scopeName}.${H.collectionName} not found. Skipping collection tests.`
      console.warn(msg)
      this.skip()
    }
  })

  /* eslint-disable-next-line mocha/no-setup-in-describe */
  genericTests(() => H.co)
})
