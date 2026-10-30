import type * as grpc from '@grpc/grpc-js'
import { setTimeout as sleepFor } from 'timers/promises'

import { mapServiceError, MappedError, RetryReason } from './errormapping'
import type { RequestContext } from './requestcontext'

/**
 * A strategy's answer: wait `delayMs` and retry, or give up when it is
 * undefined.
 *
 * @internal
 */
export interface RetryAction {
  /**
   * The milliseconds to wait before retrying, or undefined to give up.
   */
  delayMs: number | undefined
}

/**
 * The answer that gives up.
 *
 * @internal
 */
export const DO_NOT_RETRY: RetryAction = Object.freeze({ delayMs: undefined })

/**
 * What a strategy may read about the request it is deciding for.
 *
 * @internal
 */
export interface RetryRequest {
  /**
   * The request's own identifier, as logged with each retry.
   */
  readonly identifier: string

  /**
   * Whether sending the request twice has the same effect as sending it once.
   */
  readonly idempotent: boolean

  /**
   * The retries made so far, not counting the one being decided.
   */
  readonly retryAttempts: number

  /**
   * Each reason retried for so far, once, in the order first seen.
   */
  readonly retryReasons: readonly RetryReason[]
}

/**
 * Decides whether, and after how long, a request is retried for a reason
 * that does not always retry.
 *
 * @internal
 */
export interface RetryStrategy {
  /**
   * Whether, and after how long, `request` is retried for `reason`.
   */
  retryAfter(request: RetryRequest, reason: RetryReason): RetryAction
}

/**
 * The reasons that retry with controlled backoff without asking the
 * strategy.
 */
const ALWAYS_RETRY: ReadonlySet<RetryReason> = new Set<RetryReason>([
  'service_not_available',
  'key_value_locked',
])

/**
 * The reasons that may retry a request that is not idempotent. Both
 * couchbase2 reasons say the gateway did not apply the request, so retrying
 * a write cannot apply it twice.
 */
const ALLOWS_NON_IDEMPOTENT_RETRY: ReadonlySet<RetryReason> =
  new Set<RetryReason>(['service_not_available', 'key_value_locked'])

/**
 * Whether `reason` retries with controlled backoff without asking the
 * strategy.
 *
 * @internal
 */
export function alwaysRetries(reason: RetryReason): boolean {
  return ALWAYS_RETRY.has(reason)
}

/**
 * Whether a request that is not idempotent may be retried for `reason`.
 *
 * @internal
 */
export function allowsNonIdempotentRetry(reason: RetryReason): boolean {
  return ALLOWS_NON_IDEMPOTENT_RETRY.has(reason)
}

const CONTROLLED_BACKOFF_MS: readonly number[] = [1, 10, 50, 100, 500]
const CONTROLLED_BACKOFF_CEILING_MS = 1000

/**
 * The wait in milliseconds before retry number `retryAttempts + 1`. There is
 * no attempt cap; the request's deadline is one.
 *
 * @internal
 */
export function controlledBackoff(retryAttempts: number): number {
  return CONTROLLED_BACKOFF_MS[retryAttempts] ?? CONTROLLED_BACKOFF_CEILING_MS
}

/**
 * Retries with controlled backoff whenever retrying cannot apply a write
 * twice.
 *
 * @internal
 */
export class BestEffortRetryStrategy implements RetryStrategy {
  /**
   * Retries after the controlled backoff when `request` is idempotent or
   * `reason` says the gateway did not apply it; gives up otherwise.
   */
  retryAfter(request: RetryRequest, reason: RetryReason): RetryAction {
    if (request.idempotent || allowsNonIdempotentRetry(reason)) {
      return { delayMs: controlledBackoff(request.retryAttempts) }
    }
    return DO_NOT_RETRY
  }
}

/**
 * Sends a unary call through `ctx` until it succeeds or the request gives
 * up. `call` makes one attempt, given the call options to pass to grpc-js;
 * `sleep` waits between attempts.
 *
 * @internal
 */
export async function retryUnary<T>(
  ctx: RequestContext,
  call: (options: grpc.CallOptions) => Promise<T>,
  sleep: (ms: number) => Promise<unknown> = sleepFor
): Promise<T> {
  for (;;) {
    const stop = ctx.check()
    if (stop) {
      throw stop
    }

    let mapped: MappedError
    try {
      return await call(ctx.callOptions())
    } catch (err) {
      mapped = mapServiceError(err, ctx.readOnly)
    }

    const decision = ctx.onFailure(mapped)
    if (!decision.retry) {
      throw decision.error
    }
    await sleep(decision.delayMs)
  }
}

/**
 * Sends one unary call through `ctx`, retrying it as the context decides.
 * `send` makes one attempt, given the call options and the callback to pass
 * to the generated client.
 *
 * @internal
 */
export function unary<T>(
  ctx: RequestContext,
  send: (options: grpc.CallOptions, callback: grpc.requestCallback<T>) => void
): Promise<T> {
  return retryUnary(
    ctx,
    (options) =>
      new Promise<T>((resolve, reject) => {
        send(options, (err, resp) => {
          if (err) {
            reject(err)
          } else {
            resolve(resp as T)
          }
        })
      })
  )
}
