import { AttributeValue, SpanStatus, TimeInput } from "@opentelemetry/api";

import {
  MetricsConfig as MetricsConfigPb,
  TracingConfig as TracingConfigPb,
} from "../../proto/observability.config_pb";
import { SpanCreateRequest as SpanCreateRequestPb } from "../../proto/observability.top_pb";

export interface IRequestSpan {
  readonly name: string;
  setAttribute(key: string, value: AttributeValue): void;
  addEvent(key: string, startTime?: TimeInput): void;
  setStatus(status: SpanStatus): void;
  end(endTime?: TimeInput): void;
}

export interface IRequestTracer {
  requestSpan(
    name: string,
    parentSpan?: IRequestSpan,
    startTime?: TimeInput,
  ): IRequestSpan;
}

export interface IValueRecorder {
  recordValue(value: number): void;
}

export interface IMeter {
  valueRecorder(name: string, tags: Record<string, string>): IValueRecorder;
}

export interface ISpanOwner {
  getSpan(spanId: string): IRequestSpan;
  createSpan(tracer: IRequestTracer, request: SpanCreateRequestPb): void;
  finishSpan(spanId: string): void;
}

export interface IObservableConnection {
  meter: IMeter | undefined;
  tracer: IRequestTracer | undefined;

  createMeter(metricsConfig: MetricsConfigPb): void;

  createTracer(tracingConfig: TracingConfigPb): void;

  shutdown(): Promise<void>;
}
