import { IRequestSpan, IRequestTracer, ISpanOwner } from "./observabilityTypes";
import { getAttributesMap } from "./otel";

import { SpanCreateRequest as SpanCreateRequestPb } from "../../proto/observability.top_pb";

export class SpanOwner implements ISpanOwner {
  private _spans: Map<string, IRequestSpan> = new Map();

  createSpan(tracer: IRequestTracer, request: SpanCreateRequestPb) {
    let parentSpan: IRequestSpan | undefined = undefined;
    if (request.hasParentSpanId()) {
      parentSpan = this.getSpan(request.getParentSpanId() as string);
    }

    const span = tracer.requestSpan(request.getName(), parentSpan);
    const attributes = getAttributesMap(request.getAttributesMap());
    for (const key in attributes) {
      span.setAttribute(key, attributes[key]);
    }
    this._spans.set(request.getId(), span);
  }

  finishSpan(spanId: string) {
    const span = this.getSpan(spanId);
    span.end();
    this._spans.delete(spanId);
  }

  getSpan(spanId: string): IRequestSpan {
    const span = this._spans.get(spanId);
    if (!span) {
      throw new Error(`Span with id ${spanId} does not exist`);
    }

    return span;
  }
}
