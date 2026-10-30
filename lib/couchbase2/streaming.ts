import * as grpc from '@grpc/grpc-js'
import type { EventEmitter } from 'events'
import { setTimeout as sleepFor } from 'timers/promises'

import { mapServiceError, MappedError } from './errormapping'
import type { RequestContext } from './requestcontext'

/**
 * A call that can be canceled, as every grpc-js stream can.
 *
 * @internal
 */
export interface CancelableCall {
  /**
   * Ends the call on the client, failing it with `CANCELLED` if it is still
   * open.
   */
  cancel(): void
}

/**
 * The streams a cluster has open, so that closing it can cancel them before
 * the channel closes.
 *
 * @internal
 */
export class OpenStreams {
  private readonly _calls = new Set<CancelableCall>()

  /**
   * How many streams are open.
   */
  get size(): number {
    return this._calls.size
  }

  /**
   * Records `call` as open.
   */
  add(call: CancelableCall): void {
    this._calls.add(call)
  }

  /**
   * Records `call` as finished.
   */
  delete(call: CancelableCall): void {
    this._calls.delete(call)
  }

  /**
   * Cancels every open stream. Each fails its reader with `CANCELLED`.
   */
  cancelAll(): void {
    const calls = [...this._calls]
    this._calls.clear()
    for (const call of calls) {
      call.cancel()
    }
  }
}

/**
 * The optional parts of {@link retryStream}.
 *
 * @internal
 */
export interface RetryStreamOptions {
  /**
   * Where the stream is recorded while it is open.
   */
  streams?: OpenStreams

  /**
   * Waits between attempts.
   */
  sleep?: (ms: number) => Promise<unknown>
}

/**
 * One read off a stream: a message, its end, or the failure that ended it.
 */
type Read<T> = IteratorResult<T> | MappedError

/**
 * Reads the next message off `messages`, mapping a failure rather than
 * throwing it.
 */
async function readNext<T>(
  messages: AsyncIterator<T>,
  readOnly: boolean
): Promise<Read<T>> {
  try {
    return await messages.next()
  } catch (err) {
    return mapServiceError(err, readOnly)
  }
}

/**
 * Whether `read` is the failure that ended the stream.
 */
function isFailure<T>(read: Read<T>): read is MappedError {
  return !('done' in read)
}

/**
 * Yields a server streaming call's messages, one at a time and as they are
 * read, sending the call through `ctx`. `open` starts one attempt, given the
 * call options to pass to grpc-js.
 *
 * A failure before the first message is retried like a unary call. The first
 * message, an empty one included, latches the stream: retrying after it
 * would replay what the caller has already read, so a later failure ends the
 * stream instead. The deadline covers the whole stream.
 *
 * Nothing is sent until the first message is asked for. Returning early
 * cancels the call.
 *
 * @internal
 */
export async function* retryStream<T>(
  ctx: RequestContext,
  open: (options: grpc.CallOptions) => grpc.ClientReadableStream<T>,
  options: RetryStreamOptions = {}
): AsyncGenerator<T, void, undefined> {
  const sleep = options.sleep ?? sleepFor
  for (;;) {
    const stop = ctx.check()
    if (stop) {
      throw stop
    }

    const call = open(ctx.callOptions())
    // grpc-js reports a canceled call as an error event, which may come
    // after the reader below has stopped listening.
    call.on('error', () => undefined)
    options.streams?.add(call)
    const messages: AsyncIterator<T> = call[Symbol.asyncIterator]()
    try {
      let read = await readNext(messages, ctx.readOnly)
      if (isFailure(read)) {
        const decision = ctx.onFailure(read)
        if (!decision.retry) {
          throw decision.error
        }
        await sleep(decision.delayMs)
        continue
      }

      while (!read.done) {
        yield read.value
        read = await readNext(messages, ctx.readOnly)
        if (isFailure(read)) {
          throw ctx.onStreamFailure(read)
        }
      }
      return
    } finally {
      options.streams?.delete(call)
      call.cancel()
    }
  }
}

/**
 * Runs `fn`, rethrowing anything it throws on a later tick as an uncaught
 * exception, so that an `error` emitted with no listener, or a throwing
 * `end` listener, is never lost.
 *
 * @internal
 */
export function rethrowListenerErrors(fn: () => void): void {
  try {
    fn()
  } catch (err) {
    process.nextTick(() => {
      throw err
    })
  }
}

/**
 * Ends a streamed result's `emitter` with `err`, as a classic query or
 * search ends on a failure.
 *
 * @internal
 */
export function endWithError(emitter: EventEmitter, err: unknown): void {
  rethrowListenerErrors(() => {
    emitter.emit('error', err)
    emitter.emit('end')
  })
}
