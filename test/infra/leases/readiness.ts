// The management API lists a resource before every key-value node has it, so
// this asks key-value itself. One key reaches one node (by vbucket), so the
// probe is a fixed fan of keys spread across the vbucket space, and the wait
// ends only when every key answers within a single attempt, so a node that
// flaps earns nothing for an earlier answer. The spread is pinned by
// `selftest/readiness.test.ts`. Each probe is a `get` of a key nothing writes:
// `DocumentNotFoundError` is success, anything else is "not yet".

import type { Collection } from '../../../lib/collection'
import {
  CollectionNotFoundError,
  DocumentNotFoundError,
} from '../../../lib/errors'
import { HttpErrorContext } from '../../../lib/errorcontexts'
import type {
  EventingFunctionManager,
  IEventingFunction,
} from '../../../lib/eventingfunctionmanager'
import { pollUntil } from '../retry'

export const PROBE_KEY_PREFIX = '__lease_readiness_probe__'

/**
 * How wide the fan is: enough to dominate the heaviest suite workload
 * (`rangescan`'s hundred documents). The selftest's spread assertions are
 * written against this exact number.
 */
export const PROBE_KEY_COUNT = 128

/** Fixed: a random key would make each attempt ask a different question. */
export const PROBE_KEYS: readonly string[] = Array.from(
  { length: PROBE_KEY_COUNT },
  (_, i) => `${PROBE_KEY_PREFIX}${i}`
)

export interface ReadinessOptions {
  readonly deadlineMs: number
  readonly signal?: AbortSignal
}

export async function awaitKeyValueReady(
  collection: Collection,
  what: string,
  opts: ReadinessOptions
): Promise<void> {
  await pollUntil<true>(
    what,
    async (ctx) => {
      const refusals = new Map<string, number>()

      await Promise.all(
        PROBE_KEYS.map(async (key) => {
          try {
            await collection.get(key)
          } catch (err) {
            if (err instanceof DocumentNotFoundError) {
              return
            }
            const message = err instanceof Error ? err.message : String(err)
            refusals.set(message, (refusals.get(message) ?? 0) + 1)
          }
        })
      )

      if (refusals.size === 0) {
        return true
      }

      // Quoted so a timeout reads "82 of 128 said scope not found".
      const refused = [...refusals.values()].reduce((a, b) => a + b, 0)
      const because = [...refusals.entries()]
        .sort(([, a], [, b]) => b - a)
        .map(([message, count]) => `${count} said ${message}`)
        .join('; ')
      ctx.note(
        `${PROBE_KEY_COUNT - refused} of ${PROBE_KEY_COUNT} probes answered; ` +
          because
      )
      return undefined
    },
    {
      deadlineMs: opts.deadlineMs,
      intervalMs: 200,
      signal: opts.signal,
    }
  )
}

const EVENTING_PROBE_INTERVAL_MS = 500

/**
 * Upserts `probe` until the eventing service accepts its keyspaces. Eventing
 * refreshes its copy of the manifest on its own schedule, so it can refuse
 * (`ERR_COLLECTION_MISSING`) a collection key-value already serves, and the
 * upsert is the only way to ask. The probe is left in place: a drop straight
 * after the upsert can be refused, so the caller registers it as a cleanup.
 */
export async function awaitEventingKeyspaces(
  manager: EventingFunctionManager,
  probe: IEventingFunction,
  what: string,
  opts: ReadinessOptions
): Promise<void> {
  await pollUntil<true>(
    what,
    async (ctx) => {
      try {
        await manager.upsertFunction(probe)
        return true
      } catch (err) {
        if (!(err instanceof CollectionNotFoundError)) {
          throw err
        }
        // The body names the keyspace it refused, which the message does not.
        const said =
          err.context instanceof HttpErrorContext
            ? err.context.response_body
            : err.message
        ctx.note(`the eventing service said ${said}`)
        return undefined
      }
    },
    {
      deadlineMs: opts.deadlineMs,
      intervalMs: EVENTING_PROBE_INTERVAL_MS,
      signal: opts.signal,
    }
  )
}
