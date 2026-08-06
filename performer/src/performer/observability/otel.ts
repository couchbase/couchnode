import * as jspb from "google-protobuf";
import { metrics } from "@opentelemetry/api";
import {
  defaultResource,
  resourceFromAttributes,
  Resource,
} from "@opentelemetry/resources";
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { NodeTracerProvider as TracerProvider } from "@opentelemetry/sdk-trace-node";
import {
  AlwaysOffSampler,
  AlwaysOnSampler,
  BatchSpanProcessor,
  ParentBasedSampler,
  SimpleSpanProcessor,
  TraceIdRatioBasedSampler,
} from "@opentelemetry/sdk-trace-node";

import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-grpc";

import { Attribute as AttributePb } from "../../proto/observability.top_pb";

import {
  MetricsConfig as MetricsConfigPb,
  TracingConfig as TracingConfigPb,
} from "../../proto/observability.config_pb";

const SAMPLING_PERCENTAGE_EPSILON = 0.00001;

export function getAttributesMap(
  attributeMap: jspb.Map<string, AttributePb>,
): Record<string, string | number | boolean> {
  const attributes: Record<string, string | number | boolean> = {};

  attributeMap.forEach((value: AttributePb, key: string) => {
    switch (value.getValueCase()) {
      case AttributePb.ValueCase.VALUE_STRING:
        attributes[key] = value.getValueString();
        break;

      case AttributePb.ValueCase.VALUE_LONG:
        attributes[key] = value.getValueLong();
        break;

      case AttributePb.ValueCase.VALUE_BOOLEAN:
        attributes[key] = value.getValueBoolean();
        break;

      case AttributePb.ValueCase.VALUE_NOT_SET:
      default:
        break;
    }
  });

  return attributes;
}

export function createResource(
  resourceMap: jspb.Map<string, AttributePb>,
): Resource {
  const attributes = getAttributesMap(resourceMap);
  const customResource = resourceFromAttributes(attributes);
  const finalResource = defaultResource().merge(customResource);
  return finalResource;
}

export function createTracerProvider(
  tracingConfig: TracingConfigPb,
): TracerProvider {
  const endpointHostname = tracingConfig.getEndpointHostname();
  // gRPC wants host:port w/o scheme
  const grpcHost = endpointHostname.replace(/^https?:\/\//, "");

  const exporter = new OTLPTraceExporter({
    url: grpcHost,
  });

  const spanProcessor = tracingConfig.getBatching()
    ? new BatchSpanProcessor(exporter, {
        scheduledDelayMillis: tracingConfig.getExportEveryMillis(),
      })
    : new SimpleSpanProcessor(exporter);

  let rootSampler;
  const samplingPercentage = tracingConfig.getSamplingPercentage();
  if (samplingPercentage < SAMPLING_PERCENTAGE_EPSILON) {
    rootSampler = new AlwaysOffSampler();
  } else if (samplingPercentage > 1.0 - SAMPLING_PERCENTAGE_EPSILON) {
    rootSampler = new AlwaysOnSampler();
  } else {
    rootSampler = new TraceIdRatioBasedSampler(samplingPercentage);
  }

  const sampler = new ParentBasedSampler({
    root: rootSampler,
  });

  const provider = new TracerProvider({
    resource: createResource(tracingConfig.getResourcesMap()),
    sampler: sampler,
    spanProcessors: [spanProcessor],
  });
  provider.register();

  return provider;
}

export function createMeterProvider(
  metricsConfig: MetricsConfigPb,
): MeterProvider {
  const endpointHostname = metricsConfig.getEndpointHostname();
  // gRPC wants host:port w/o scheme
  const grpcHost = endpointHostname.replace(/^https?:\/\//, "");

  const exporter = new OTLPMetricExporter({
    url: grpcHost,
  });

  const metricReader = new PeriodicExportingMetricReader({
    exporter: exporter,
    exportIntervalMillis: metricsConfig.getExportEveryMillis(),
  });

  const meterProvider = new MeterProvider({
    resource: createResource(metricsConfig.getResourcesMap()),
    readers: [metricReader],
  });
  metrics.setGlobalMeterProvider(meterProvider);
  return meterProvider;
}
