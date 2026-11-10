import * as grpc from '@grpc/grpc-js'
import { describe, expect, it } from 'vitest'

import { CLIENT_IDLE_TIMEOUT_MS } from '../../../../lib/couchbase2/channel'
import {
  watchConnectivity,
  WatchedChannel,
} from '../../../../lib/couchbase2/connectivity'
import { CouchbaseLogger } from '../../../../lib/logger'

const { connectivityState } = grpc

// A channel whose state the test sets, calling its watchers as grpc-js does:
// synchronously, once each, when the state differs from the one watched.
class FakeChannel implements WatchedChannel {
  state = connectivityState.IDLE
  connectRequests = 0
  watchers: { state: grpc.connectivityState; cb: () => void }[] = []
  deadlines: (Date | number)[] = []

  getConnectivityState(tryToConnect: boolean): grpc.connectivityState {
    if (tryToConnect) {
      this.connectRequests++
    }
    return this.state
  }

  watchConnectivityState(
    currentState: grpc.connectivityState,
    deadline: Date | number,
    cb: () => void
  ): void {
    if (this.state === connectivityState.SHUTDOWN) {
      throw new Error('Channel has been shut down')
    }
    this.deadlines.push(deadline)
    this.watchers.push({ state: currentState, cb })
  }

  set(state: grpc.connectivityState): void {
    this.state = state
    const due = this.watchers.filter((w) => w.state !== state)
    this.watchers = this.watchers.filter((w) => w.state === state)
    for (const w of due) {
      w.cb()
    }
  }
}

type Line = [string, string]

function setup(lastActivity?: () => number | undefined) {
  const lines: Line[] = []
  const logger = new CouchbaseLogger({
    debug: (m: string) => lines.push(['debug', m]),
    info: (m: string) => lines.push(['info', m]),
    warn: (m: string) => lines.push(['warn', m]),
  })
  const channel = new FakeChannel()
  let clock = 1_000_000
  const now = () => clock
  const advance = (ms: number) => {
    clock += ms
  }
  watchConnectivity(channel, logger, {
    target: 'gw:18098',
    lastActivity: lastActivity ?? (() => clock),
    now,
  })
  return { lines, channel, advance, now }
}

const levels = (lines: Line[]) => lines.map(([level]) => level)

describe('#couchbase2 connectivity log', () => {
  it('should log the first connection at info and nothing else at info', () => {
    const { lines, channel } = setup()
    channel.set(connectivityState.CONNECTING)
    channel.set(connectivityState.READY)
    expect(lines).toEqual([
      ['debug', 'couchbase2: connecting to the gateway at gw:18098'],
      ['info', 'couchbase2: connected to the gateway at gw:18098'],
    ])
  })

  it('should never ask the channel to connect, or arm a timer', () => {
    const { channel } = setup()
    channel.set(connectivityState.CONNECTING)
    channel.set(connectivityState.READY)
    expect(channel.connectRequests).toBe(0)
    expect(channel.deadlines.every((d) => d === Infinity)).toBe(true)
  })

  it('should warn once for a gateway that stays unreachable', () => {
    const { lines, channel, advance } = setup()
    channel.set(connectivityState.CONNECTING)
    channel.set(connectivityState.TRANSIENT_FAILURE)
    for (let i = 0; i < 5; i++) {
      channel.set(connectivityState.CONNECTING)
      channel.set(connectivityState.TRANSIENT_FAILURE)
    }
    advance(4200)
    channel.set(connectivityState.CONNECTING)
    channel.set(connectivityState.READY)
    expect(levels(lines).filter((l) => l !== 'debug')).toEqual(['warn', 'info'])
    expect(lines.find(([l]) => l === 'warn')?.[1]).toBe(
      'couchbase2: unable to connect to the gateway at gw:18098; retrying ' +
        'with backoff. A request that fails meanwhile reports the cause.'
    )
    expect(lines.at(-1)).toEqual([
      'info',
      'couchbase2: connected to the gateway at gw:18098 again, 4.2s after ' +
        'the connection was lost',
    ])
  })

  it('should warn when a connection in use is lost, once per outage', () => {
    const { lines, channel, advance } = setup()
    channel.set(connectivityState.CONNECTING)
    channel.set(connectivityState.READY)
    lines.length = 0
    channel.set(connectivityState.IDLE)
    channel.set(connectivityState.CONNECTING)
    channel.set(connectivityState.TRANSIENT_FAILURE)
    advance(1500)
    channel.set(connectivityState.CONNECTING)
    channel.set(connectivityState.READY)
    expect(lines.filter(([l]) => l !== 'debug')).toEqual([
      [
        'warn',
        'couchbase2: lost the connection to the gateway at gw:18098; ' +
          'reconnecting on the next request',
      ],
      [
        'info',
        'couchbase2: connected to the gateway at gw:18098 again, 1.5s ' +
          'after the connection was lost',
      ],
    ])
  })

  it('should take going idle after the idle timeout as no outage', () => {
    const activity: { last?: number } = {}
    const { lines, channel, now, advance } = setup(() => activity.last)
    channel.set(connectivityState.CONNECTING)
    channel.set(connectivityState.READY)
    activity.last = now()
    advance(CLIENT_IDLE_TIMEOUT_MS)
    lines.length = 0
    channel.set(connectivityState.IDLE)
    channel.set(connectivityState.CONNECTING)
    channel.set(connectivityState.READY)
    expect(levels(lines)).toEqual(['debug', 'debug', 'debug'])
  })

  it('should take going idle before any request as no outage', () => {
    const { lines, channel } = setup(() => undefined)
    channel.set(connectivityState.CONNECTING)
    channel.set(connectivityState.READY)
    lines.length = 0
    channel.set(connectivityState.IDLE)
    expect(levels(lines)).toEqual(['debug'])
  })

  it('should stop watching once the channel shuts down', () => {
    const { lines, channel } = setup()
    channel.set(connectivityState.CONNECTING)
    channel.set(connectivityState.READY)
    lines.length = 0
    channel.set(connectivityState.SHUTDOWN)
    expect(lines).toEqual([])
    expect(channel.watchers).toEqual([])
  })

  it('should keep watching when the logger throws', () => {
    const channel = new FakeChannel()
    const logger = new CouchbaseLogger({
      info: () => {
        throw new Error('broken logger')
      },
      debug: () => {
        throw new Error('broken logger')
      },
    })
    watchConnectivity(channel, logger, {
      target: 'gw:18098',
      lastActivity: () => undefined,
    })
    expect(() => channel.set(connectivityState.CONNECTING)).not.toThrow()
    expect(() => channel.set(connectivityState.READY)).not.toThrow()
    expect(channel.watchers).toHaveLength(1)
  })
})
