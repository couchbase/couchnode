import * as grpc from '@grpc/grpc-js'

import type { CouchbaseLogger } from '../logger'
import { systemData } from '../redaction'
import { CLIENT_IDLE_TIMEOUT_MS } from './channel'

const { connectivityState } = grpc

/**
 * The part of a channel the connectivity log reads.
 *
 * @internal
 */
export interface WatchedChannel {
  /**
   * As grpc-js's; the log always passes false.
   */
  getConnectivityState(tryToConnect: boolean): grpc.connectivityState

  /**
   * As grpc-js's; the log always passes an infinite deadline.
   */
  watchConnectivityState(
    currentState: grpc.connectivityState,
    deadline: Date | number,
    callback: (error?: Error) => void
  ): void
}

/**
 * What the connectivity log needs besides the channel.
 *
 * @internal
 */
export interface ConnectivityLogOptions {
  /**
   * The gateway's address, `host:port`.
   */
  target: string

  /**
   * When the most recent request began, on the `now` clock; undefined
   * before the first.
   */
  lastActivity: () => number | undefined

  /**
   * A clock in milliseconds.
   */
  now?: () => number
}

/**
 * Logs the channel's connection to the gateway as it changes, until the
 * channel shuts down. A healthy connection logs once, at info, when it first
 * connects. Losing it, or failing to make it, logs at warn once per outage,
 * and reconnecting logs at info with how long it was down. Everything else
 * is debug.
 *
 * The channel has one connection, so its state is that connection's. When
 * the connection closes the channel goes idle and reconnects on the next
 * call. It also goes idle after {@link CLIENT_IDLE_TIMEOUT_MS} with no call,
 * which is not an outage, so a channel that goes idle sooner than that after
 * the last request has lost its connection.
 *
 * The watch holds no timer, so it never keeps the process alive, and closing
 * the channel ends it. Nothing here asks the channel to connect.
 *
 * @internal
 */
export function watchConnectivity(
  channel: WatchedChannel,
  logger: CouchbaseLogger,
  options: ConnectivityLogOptions
): void {
  const now = options.now ?? Date.now
  const gateway = `the gateway at ${systemData(options.target)}`
  let previous = channel.getConnectivityState(false)
  let connected = false
  let downSince: number | undefined

  const log = (state: grpc.connectivityState) => {
    switch (state) {
      case connectivityState.READY:
        if (downSince !== undefined) {
          const seconds = ((now() - downSince) / 1000).toFixed(1)
          logger.info(
            `couchbase2: connected to ${gateway} again, ${seconds}s after ` +
              'the connection was lost'
          )
        } else if (!connected) {
          logger.info(`couchbase2: connected to ${gateway}`)
        } else {
          logger.debug(`couchbase2: reconnected to ${gateway}`)
        }
        connected = true
        downSince = undefined
        return
      case connectivityState.TRANSIENT_FAILURE:
        if (downSince === undefined) {
          downSince = now()
          logger.warn(
            `couchbase2: unable to connect to ${gateway}; retrying with ` +
              'backoff. A request that fails meanwhile reports the cause.'
          )
        } else {
          logger.debug(`couchbase2: still unable to connect to ${gateway}`)
        }
        return
      case connectivityState.IDLE: {
        const last = options.lastActivity()
        if (
          previous === connectivityState.READY &&
          last !== undefined &&
          now() - last < CLIENT_IDLE_TIMEOUT_MS
        ) {
          downSince = now()
          logger.warn(
            `couchbase2: lost the connection to ${gateway}; reconnecting ` +
              'on the next request'
          )
        } else {
          logger.debug(`couchbase2: connection to ${gateway} is idle`)
        }
        return
      }
      default:
        logger.debug(`couchbase2: connecting to ${gateway}`)
    }
  }

  const onChange = () => {
    const state = channel.getConnectivityState(false)
    if (state === connectivityState.SHUTDOWN) {
      return
    }
    // grpc-js calls this from inside its own state change, so a logger
    // that throws must not reach it.
    try {
      log(state)
    } catch {
      // A broken logger loses the line, not the connection.
    }
    previous = state
    channel.watchConnectivityState(state, Infinity, onChange)
  }
  channel.watchConnectivityState(previous, Infinity, onChange)
}
