// `ids` is the only thing `load` returns and `purge` reads, so the two cannot
// disagree. Each document is written once (the retry stops on success), and
// `load` rejects if any document did not land, so a suite never queries a
// partial batch.

import type { Collection } from '../../../../lib/collection'
import { DocumentNotFoundError } from '../../../../lib/errors'
import { tryNTimes } from '../retry'
import { gridDocs } from './docs'

const DEFAULT_RETRIES = 3
const RETRY_DELAY_MS = 500

export interface DocBatchSpec {
  /** Defaults to the nine grid documents. */
  readonly docs?: readonly Record<string, unknown>[]
  /**
   * Prefix for the generated ids, also stamped on each document as `testUid`.
   * Suites match on it, so it has to be unique per batch; `env.key()` is the
   * intended source.
   */
  readonly uid: string
  readonly retries?: number
  readonly signal?: AbortSignal
}

export class DocBatch {
  private constructor(
    readonly uid: string,
    readonly ids: readonly string[],
    private readonly collection: Collection,
    private readonly docs: readonly Record<string, unknown>[],
    private readonly signal?: AbortSignal
  ) {}

  /** Rejects with an AggregateError naming every document that did not land. */
  static async load(
    collection: Collection,
    spec: DocBatchSpec
  ): Promise<DocBatch> {
    const source = spec.docs ?? gridDocs()
    // Copied, not stamped in place: the grid documents are shared and frozen,
    // and a caller's array is not ours to write to either.
    const docs = source.map((doc) => ({ ...doc, testUid: spec.uid }))
    const ids = docs.map((_, index) => `${spec.uid}::${index}`)
    const retries = spec.retries ?? DEFAULT_RETRIES

    const outcomes = await Promise.allSettled(
      docs.map((doc, index) =>
        tryNTimes(
          retries,
          RETRY_DELAY_MS,
          () => collection.upsert(ids[index], doc),
          spec.signal
        )
      )
    )

    const failures = outcomes.flatMap((outcome, index) =>
      outcome.status === 'rejected'
        ? [new Error(`${ids[index]}: ${describe(outcome.reason)}`)]
        : []
    )
    if (failures.length > 0) {
      // Whatever did land is dropped before rethrowing: a half-loaded batch is
      // documents the next suite would see, and the caller is about to get an
      // exception rather than a handle to purge with.
      const partial = new DocBatch(spec.uid, ids, collection, docs, spec.signal)
      await partial.purge()
      throw new AggregateError(
        failures,
        `${failures.length} of ${ids.length} document(s) in batch ` +
          `'${spec.uid}' could not be written`
      )
    }

    return new DocBatch(spec.uid, ids, collection, docs, spec.signal)
  }

  get size(): number {
    return this.ids.length
  }

  /** The document written under `ids[index]`, including its `testUid`. */
  doc(index: number): Record<string, unknown> {
    const doc = this.docs[index]
    if (!doc) {
      throw new Error(
        `Batch '${this.uid}' holds ${this.size} document(s); no index ${index}.`
      )
    }
    return doc
  }

  /**
   * Removes every document in the batch. Idempotent, and treats an already
   * absent document as success: a purge racing a suite's own cleanup, or
   * following a partial load, is the normal case rather than an error.
   */
  async purge(): Promise<void> {
    const outcomes = await Promise.allSettled(
      this.ids.map((id) =>
        tryNTimes(
          DEFAULT_RETRIES,
          RETRY_DELAY_MS,
          async () => {
            try {
              await this.collection.remove(id)
            } catch (err) {
              if (!(err instanceof DocumentNotFoundError)) {
                throw err
              }
            }
          },
          this.signal
        )
      )
    )

    const failures = outcomes.flatMap((outcome, index) =>
      outcome.status === 'rejected'
        ? [new Error(`${this.ids[index]}: ${describe(outcome.reason)}`)]
        : []
    )
    if (failures.length > 0) {
      throw new AggregateError(
        failures,
        `${failures.length} of ${this.ids.length} document(s) in batch ` +
          `'${this.uid}' could not be removed`
      )
    }
  }
}

function describe(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}
