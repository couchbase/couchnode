// Two eventing service quirks shape these helpers:
//
// - `/api/v1/status` can answer `500 INTERNAL_SERVER_ERROR` mid deploy, tagged
//   `"attributes": ["retry"]`, so waits and cleanups retry it.
// - A deployed function cannot be dropped, so cleanup undeploys first.

import type { EventingFunctionManager } from '../../../lib/eventingfunctionmanager'
import { EventingFunctionStatus } from '../../../lib/eventingfunctionmanager'
import { EventingFunctionNotFoundError } from '../../../lib/errors'
import type { ScopeEventingFunctionManager } from '../../../lib/scopeeventingfunctionmanager'
import { pollUntil, tryNTimes } from './retry'

/** The part of either manager (no shared base class) these helpers use. */
export type EventingStateManager = Pick<
  EventingFunctionManager | ScopeEventingFunctionManager,
  'functionsStatus' | 'undeployFunction' | 'dropFunction' | 'getAllFunctions'
>

export interface EventingStateOptions {
  readonly deadlineMs: number
  readonly intervalMs?: number
  /** Left out by a cleanup, which runs after the test whose signal it was. */
  readonly signal?: AbortSignal
}

const STATE_POLL_INTERVAL_MS = 500

const CLEANUP_ATTEMPTS = 5
const CLEANUP_DELAY_MS = 3_000

const DROP_DEADLINE_MS = 15_000

/**
 * Absent from the listing counts as "not yet", since a fresh upsert takes a
 * moment to appear. Errors are polled through until the deadline.
 */
export async function awaitEventingState(
  manager: EventingStateManager,
  name: string,
  state: EventingFunctionStatus,
  opts: EventingStateOptions
): Promise<void> {
  await pollUntil<true>(
    `eventing function ${name} to reach ${state}`,
    async (ctx) => {
      const statuses = await manager.functionsStatus()
      const status = statuses.functions.find((f) => f.name === name)
      if (!status) {
        ctx.note('the function is not in the status listing')
        return undefined
      }
      if (status.status !== state) {
        ctx.note(`the function is ${status.status}`)
        return undefined
      }
      return true
    },
    {
      deadlineMs: opts.deadlineMs,
      intervalMs: opts.intervalMs ?? STATE_POLL_INTERVAL_MS,
      retryErrors: true,
      signal: opts.signal,
    }
  )
}

/**
 * Undeploys `name` if needed, then drops it, whatever state it was left in.
 * The status read and undeploy are retried; the drop tolerates only not found.
 */
export async function ensureEventingFunctionDropped(
  manager: EventingStateManager,
  name: string,
  undeployDeadlineMs: number
): Promise<void> {
  const statuses = await tryNTimes(CLEANUP_ATTEMPTS, CLEANUP_DELAY_MS, () =>
    manager.functionsStatus()
  )
  const status = statuses.functions.find((f) => f.name === name)?.status
  if (status !== undefined && status !== EventingFunctionStatus.Undeployed) {
    // One already on its way down needs only the wait; asking again is
    // refused because it is no longer deployed.
    if (status !== EventingFunctionStatus.Undeploying) {
      await tryNTimes(CLEANUP_ATTEMPTS, CLEANUP_DELAY_MS, () =>
        manager.undeployFunction(name)
      )
    }
    await awaitEventingState(manager, name, EventingFunctionStatus.Undeployed, {
      deadlineMs: undeployDeadlineMs,
    })
  }

  try {
    await manager.dropFunction(name)
  } catch (err) {
    if (err instanceof EventingFunctionNotFoundError) {
      return
    }
    throw err
  }
  // The drop returns before the service forgets the function, and the suite's
  // scope, which holds the function's metadata collection, goes next.
  await pollUntil<true>(
    `eventing function ${name} to leave getAllFunctions after its drop`,
    async (ctx) => {
      const listed = (await manager.getAllFunctions()).map((f) => f.name)
      if (!listed.includes(name)) {
        return true
      }
      ctx.note('the function is still listed')
      return undefined
    },
    { deadlineMs: DROP_DEADLINE_MS, intervalMs: STATE_POLL_INTERVAL_MS }
  )
}
