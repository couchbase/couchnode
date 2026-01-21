import {
  CppError,
  CppObservableRequests,
  CppObservableResponse,
  ObservableBindingFunc,
} from './binding'
import { errorFromCpp } from './bindingutilities'
import { ValueRecorder, Meter } from './metrics'
import { ObservableRequestHandler } from './observabilityhandler'
import { RequestSpan, RequestTracer } from './tracing'

/**
 * @internal
 */
export class NoOpSpan implements RequestSpan {
  /**
   * @internal
   */
  setAttribute(): void {}

  /**
   * @internal
   */
  addEvent(): void {}

  /**
   * @internal
   */
  setStatus(): void {}

  /**
   * @internal
   */
  end(): void {}

  /**
   * @internal
   */
  get name(): string {
    return ''
  }
}

/**
 * @internal
 */
export class NoOpTracer implements RequestTracer {
  /**
   * @internal
   */
  requestSpan(): RequestSpan {
    return new NoOpSpan()
  }
}

/**
 * @internal
 */
export async function wrapObservableBindingCall<
  TReq extends CppObservableRequests,
  TResp extends CppObservableResponse,
>(
  fn: ObservableBindingFunc<TReq, TResp>,
  req: TReq,
  obsReqHandler: ObservableRequestHandler
): Promise<[Error | null, TResp]> {
  return await new Promise(
    (resolve: (res: [Error | null, res: TResp]) => void) => {
      req.wrapper_span_name = obsReqHandler.wrapperSpanName
      fn(req, (cppErr: CppError | null, res: TResp) => {
        let err = null
        if (cppErr) {
          err = errorFromCpp(cppErr)
          obsReqHandler.processCoreSpan(cppErr.cpp_core_span)
        } else {
          obsReqHandler.processCoreSpan(res.cpp_core_span)
        }
        resolve([err, res])
      })
    }
  )
}

/**
 * @internal
 */
export class NoOpValueRecorder implements ValueRecorder {
  /**
   * @internal
   */
  recordValue(_value: number): void {}
}

/**
 * @internal
 */
export class NoOpMeter implements Meter {
  /**
   * @internal
   */
  valueRecorder(_name: string, _tags: Record<string, string>): ValueRecorder {
    return new NoOpValueRecorder()
  }
}
