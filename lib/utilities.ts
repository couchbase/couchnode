import { DurabilityLevel } from './generaltypes'
import { InvalidArgumentError } from './errors'
import * as qs from 'querystring'

/**
 * CAS represents an opaque value which can be used to compare documents to
 * determine if a change has occurred.
 *
 * @category Key-Value
 */
export interface Cas {
  /**
   * Generates a string representation of this CAS.
   */
  toString(): string

  /**
   * Generates a JSON representation of this CAS.
   */
  toJSON(): any
}

/**
 * CasIn represents the supported types that can be provided to an operation
 * that receive a CAS.
 *
 * @category Key-Value
 */
export type CasInput = Cas | string | Buffer

/**
 * Reprents a node-style callback which receives an optional error or result.
 *
 * @category Utilities
 */
export interface NodeCallback<T> {
  (err: Error | null, result: T | null): void
}

/**
 * @internal
 */
export class PromiseHelper {
  /**
   * @internal
   */
  static wrapAsync<T, U extends Promise<T>>(
    fn: () => U,
    callback?: (err: Error | null, result: T | null) => void
  ): U {
    // If a callback in in use, we wrap the promise with a handler which
    // forwards to the callback and return undefined.  If there is no
    // callback specified.  We directly return the promise.
    if (callback) {
      const prom = fn()
      prom.then(
        (res) => callback(null, res),
        (err) => callback(err, null)
      )
      return prom
    }

    return fn()
  }

  /**
   * @internal
   */
  static wrap<T>(
    fn: (callback: NodeCallback<T>) => void,
    callback?: NodeCallback<T> | null
  ): Promise<T> {
    const prom: Promise<T> = new Promise((resolve, reject) => {
      fn((err, res) => {
        if (err) {
          reject(err as Error)
        } else {
          resolve(res as T)
        }
      })
    })

    if (callback) {
      prom.then(
        (res) => callback(null, res),
        (err) => callback(err, null)
      )
    }

    return prom
  }
}

/**
 * @internal
 */
export class CompoundTimeout {
  private _start: [number, number]
  private _timeout: number | undefined

  /**
   * @internal
   */
  constructor(timeout: number | undefined) {
    this._start = process.hrtime()
    this._timeout = timeout
  }

  /**
   * @internal
   */
  left(): number | undefined {
    if (this._timeout === undefined) {
      return undefined
    }

    const period = process.hrtime(this._start)

    const periodMs = period[0] * 1e3 + period[1] / 1e6
    if (periodMs > this._timeout) {
      return 0
    }

    return this._timeout - periodMs
  }

  /**
   * @internal
   */
  expired(): boolean {
    const timeLeft = this.left()
    if (timeLeft === undefined) {
      return false
    }

    return timeLeft <= 0
  }
}

/**
 * @internal
 */
export function duraLevelToNsServerStr(
  level: DurabilityLevel | string | undefined
): string | undefined {
  if (level === undefined) {
    return undefined
  }

  if (typeof level === 'string') {
    return level as string
  }

  if (level === DurabilityLevel.None) {
    return 'none'
  } else if (level === DurabilityLevel.Majority) {
    return 'majority'
  } else if (level === DurabilityLevel.MajorityAndPersistOnMaster) {
    return 'majorityAndPersistActive'
  } else if (level === DurabilityLevel.PersistToMajority) {
    return 'persistToMajority'
  } else {
    throw new Error('invalid durability level specified')
  }
}

/**
 * @internal
 */
export function nsServerStrToDuraLevel(
  level: string | undefined
): DurabilityLevel {
  if (level === undefined) {
    return DurabilityLevel.None
  }

  if (level === 'none') {
    return DurabilityLevel.None
  } else if (level === 'majority') {
    return DurabilityLevel.Majority
  } else if (level === 'majorityAndPersistActive') {
    return DurabilityLevel.MajorityAndPersistOnMaster
  } else if (level === 'persistToMajority') {
    return DurabilityLevel.PersistToMajority
  } else {
    throw new Error('invalid durability level string')
  }
}

/**
 * @internal
 */
export function cbQsStringify(
  values: { [key: string]: any },
  options?: { boolAsString?: boolean }
): string {
  const cbValues: { [key: string]: any } = {}
  for (const i in values) {
    if (values[i] === undefined) {
      // skipped
    } else if (typeof values[i] === 'boolean') {
      if (options && options.boolAsString) {
        cbValues[i] = values[i] ? 'true' : 'false'
      } else {
        cbValues[i] = values[i] ? 1 : 0
      }
    } else {
      cbValues[i] = values[i]
    }
  }
  return qs.stringify(cbValues)
}

// See JSCBC-1357 For more details on the expiry handling.
const thirtyDaysInSeconds = 30 * 24 * 60 * 60
const fiftyYearsInSeconds = 50 * 365 * 24 * 60 * 60
// The server treats values <= 259200 (30 days) as relative to the current time.
// So, the minimum expiry date is 259201 which corresponds to 1970-01-31T00:00:01Z
const minExpiryDate = new Date('1970-01-31T00:00:01Z')
const minExpiry = 259201
// 2106-02-07T06:28:15Z in seconds which is max 32-bit unsigned integer (server max expiry)
const maxExpiry = 4294967295
const maxExpiryDate = new Date('2106-02-07T06:28:15Z')
const zeroSecondDate = new Date('1970-01-31T00:00:00Z')

/**
 * @internal
 */
export function parseExpiry(expiry?: number | Date): number {
  if (!expiry) {
    return 0
  }

  if (typeof expiry !== 'number' && !(expiry instanceof Date)) {
    throw new InvalidArgumentError(
      new Error('Expected expiry to be a number or Date.')
    )
  }

  if (expiry instanceof Date) {
    if (isNaN(expiry.getTime())) {
      throw new InvalidArgumentError(
        new Error('Expected expiry to be a valid Date.')
      )
    }

    if (expiry.getTime() == zeroSecondDate.getTime()) {
      return 0
    }

    // A Date expiry MUST represent an absolute expiry time; therefore, it must be between 259201 and 4294967295
    if (
      expiry.getTime() < minExpiryDate.getTime() ||
      expiry.getTime() > maxExpiryDate.getTime()
    ) {
      const msg = `Expected expiry to be greater than ${minExpiryDate.toISOString()} (${minExpiry}) 
      and less than ${maxExpiryDate.toISOString()} (${maxExpiry}) but got ${expiry.toISOString()}.`
      throw new InvalidArgumentError(new Error(msg))
    }

    // return the Date as an epoch second (value is between 259201 and 4294967295)
    return Math.floor(expiry.getTime() / 1000)
  }

  if (expiry < 0) {
    throw new InvalidArgumentError(
      new Error(
        `Expected expiry to be either zero (for no expiry) or greater but got ${expiry}.`
      )
    )
  }

  if (expiry > maxExpiry) {
    throw new InvalidArgumentError(
      new Error(
        `Expected expiry to be less than ${maxExpiry} (${maxExpiryDate.toISOString()}) but got ${expiry}.`
      )
    )
  }

  if (expiry > fiftyYearsInSeconds) {
    const msg = `The specified expiry (${expiry}) is greater than 50 years (in seconds). 
    Unix timestamps passed directly as a number are not supported as an expiry. Instead, construct a Date from the timestamp (e.g. new Date(UNIX_TIMESTAMP * 1000)).`
    process.emitWarning(msg)
  }

  if (expiry < thirtyDaysInSeconds) {
    return expiry
  }
  // The relative expiry is >= 30 days, convert it to an absolute expiry and confirm it will not exceed the maximum expiry
  const unixTimeSecs = Math.floor(Date.now() / 1000)
  const maxExpiryDuration = maxExpiry - unixTimeSecs
  if (expiry > maxExpiryDuration) {
    const msg = `Expected expiry duration to be less than ${maxExpiryDuration} but got ${expiry}.`
    throw new InvalidArgumentError(new Error(msg))
  }
  return expiry + unixTimeSecs
}
