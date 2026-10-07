// `NoOpTestMeter` must extend `NoOpMeter`: `observabilityhandler.ts` picks the
// no-op path by `instanceof NoOpMeter`, so any recorder appearing under it
// means the handler took the recording path for a meter that opted out.

import type { Meter, ValueRecorder } from '../../../../lib/metrics'
import { NoOpMeter, NoOpValueRecorder } from '../../../../lib/observability'
import { OpAttributeName } from '../../../../lib/observabilitytypes'

/** What the SDK passes as a recorder's tags. Values are whatever it sets. */
export type RecorderAttributes = Readonly<Record<string, unknown>>

export class TestValueRecorder implements ValueRecorder {
  readonly values: number[] = []
  /** The operation named in the tags; recorders are looked up by it. */
  readonly opName: string | undefined

  constructor(
    readonly name: string,
    readonly attributes: RecorderAttributes
  ) {
    const op = attributes[OpAttributeName.OperationName]
    this.opName = typeof op === 'string' ? op : undefined
  }

  recordValue(value: number): void {
    this.values.push(value)
  }
}

export class TestMeter implements Meter {
  /** Recorders by metric name, in creation order. */
  readonly recorders = new Map<string, TestValueRecorder[]>()

  valueRecorder(name: string, attributes: RecorderAttributes): ValueRecorder {
    const recorder = new TestValueRecorder(name, attributes)
    const existing = this.recorders.get(name)
    if (existing) {
      existing.push(recorder)
    } else {
      this.recorders.set(name, [recorder])
    }
    return recorder
  }

  /** The operation-duration recorder for `opName`, if the SDK made one. */
  getValueRecorderByOpName(opName: string): TestValueRecorder | undefined {
    return this.getValueRecordersByOpName(opName)[0]
  }

  /**
   * Every operation-duration recorder for `opName`, in creation order. The SDK
   * creates one per recording, so the length is the recording count.
   */
  getValueRecordersByOpName(opName: string): TestValueRecorder[] {
    const forDuration =
      this.recorders.get(OpAttributeName.MeterNameOpDuration) ?? []
    return forDuration.filter((recorder) => recorder.opName === opName)
  }

  clear(): void {
    this.recorders.clear()
  }
}

/**
 * A recorder under a no-op meter, which should never receive a value. It
 * records anyway, so one arriving is visible.
 */
export class NoOpTestValueRecorder extends NoOpValueRecorder {
  readonly values: number[] = []

  constructor(
    readonly name: string,
    readonly attributes: RecorderAttributes
  ) {
    super()
  }

  override recordValue(value: number): void {
    this.values.push(value)
  }
}

export class NoOpTestMeter extends NoOpMeter {
  readonly recorders = new Map<string, NoOpTestValueRecorder[]>()

  override valueRecorder(
    name: string,
    attributes: RecorderAttributes
  ): ValueRecorder {
    const recorder = new NoOpTestValueRecorder(name, attributes)
    const existing = this.recorders.get(name)
    if (existing) {
      existing.push(recorder)
    } else {
      this.recorders.set(name, [recorder])
    }
    return recorder
  }

  clear(): void {
    this.recorders.clear()
  }
}

/** Either test meter, so a suite can be written once and run against both. */
export type AnyTestMeter = TestMeter | NoOpTestMeter
