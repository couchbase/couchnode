/**
 * OpenTelemetry Tracing and Metrics Example (TypeScript)
 *
 * This example demonstrates how to use OpenTelemetry tracing and metrics with the Couchbase Node.js SDK
 * and export metrics to Jaeger (tracing) and Prometheus (metrics) for visualization in a web UI.
 *
 * What this example does:
 * - Sets up OpenTelemetry tracing and metrics with OTLP exporters for Jaeger and Prometheus
 * - Creates a Couchbase cluster connection with OTel tracing enabled
 * - Performs various KV and query operations
 * - Exports all traces to Jaeger and metrics to Prometheus for visualization in the UI
 * - Exports all metrics to Prometheus for visualization in the UI
 *
 * Prerequisites:
 * - Jaeger, Prometheus and OTel Collector running locally
 * - Couchbase Server running
 * - OpenTelemetry packages installed
 *
 * Installation:
 *   npm install:
 *       - @opentelemetry/api (^1.9.0)
 *       - @opentelemetry/sdk-node (^0.213.0)
 *       - @opentelemetry/sdk-metrics-node (^2.6.0)
 *       - @opentelemetry/exporter-metrics-otlp-grpc (^0.213.0)
 *       - @opentelemetry/exporter-trace-otlp-grpc (^0.213.0)
 *
 * Quick Start with Docker:
 *   # Start containers
 *   docker-compose up -d
 *
 *   # Run this example
 *   tsx otel-otlp-metrics-and-tracing.ts
 * 
 *   # Open Jaeger UI in browser
 *   # http://localhost:16686
 * 
 *   # Open Prometheus UI in browser
 *   # http://localhost:9090
 *
 * Expected output:
 * - Console logs showing operations being performed
 * - Traces should be visible in Jaeger UI at http://localhost:16686
 *    - Search "couchbase-otel-combined-example" service and look for spans like "kv.upsert", "kv.get", "cluster.query", etc.
 * - Metrics should visible in Prometheus UI at http://localhost:9090
 *    - Search "db_client_operation_duration_seconds_bucket" in UI
 */

import { trace, metrics } from '@opentelemetry/api'
import {
  defaultResource,
  resourceFromAttributes,
  Resource,
} from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions'
import {
  AlwaysOnSampler,
  NodeTracerProvider,
  ParentBasedSampler,
  BatchSpanProcessor,
} from '@opentelemetry/sdk-trace-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc'
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc'
import {
  Cluster,
  Collection,
  connect,
  getOTelTracer,
  getOTelMeter,
  RequestTracer,
} from 'couchbase'

// Configuration
const SERVICE_NAME = 'couchbase-otel-combined-example'
const OTLP_ENDPOINT = 'http://localhost:4317' // Both traces and metrics go here
const CONNECTION_STRING = 'couchbase://localhost'
const BUCKET_NAME = 'default'
const USERNAME = 'Administrator'
const PASSWORD = 'password'

function setupOtelTracing(resource: Resource): NodeTracerProvider {
  const traceExporter = new OTLPTraceExporter({ url: OTLP_ENDPOINT })
  const spanProcessor = new BatchSpanProcessor(traceExporter)

  const tracerProvider = new NodeTracerProvider({
    resource: resource,
    sampler: new ParentBasedSampler({ root: new AlwaysOnSampler() }),
    spanProcessors: [spanProcessor],
  })

  // Set as the global tracer provider
  tracerProvider.register()

  return tracerProvider
}

function setupOtelMetrics(resource: Resource): MeterProvider {
  const metricExporter = new OTLPMetricExporter({ url: OTLP_ENDPOINT })

  const meterProvider = new MeterProvider({
    resource: resource,
    readers: [
      new PeriodicExportingMetricReader({
        exporter: metricExporter,
        exportIntervalMillis: 1000,
      }),
    ],
  })

  // Set as global meter provider so the SDK can pick it up
  metrics.setGlobalMeterProvider(meterProvider)

  return meterProvider
}

function printBanner() {
  console.log('\n' + '='.repeat(80))
  console.log('OpenTelemetry OTLP Combined (Metrics + Tracing) Example')
  console.log('='.repeat(80) + '\n')
}

async function performOperations(collection: any, cluster: any) {
  console.log('\n' + '-'.repeat(80))
  console.log('Performing Operations (Generating Traces & Metrics)')
  console.log('-'.repeat(80) + '\n')

  const docs: Record<string, any> = {
    'testdoc:1': { name: 'Alice', age: 30, type: 'user', user_role: 'admin' },
    'testdoc:2': { name: 'Bob', age: 25, type: 'user', user_role: 'developer' },
    'testdoc:3': {
      name: 'Charlie',
      age: 35,
      type: 'user',
      user_role: 'manager',
    },
  }
  const docKeys = Object.keys(docs)

  console.log('1. Upserting documents...')
  for (const key of docKeys) {
    await collection.upsert(key, docs[key])
    console.log(`   ✓ Upserted '${key}'`)
  }

  console.log('\n2. Retrieving documents...')
  for (let roundNum = 1; roundNum <= 3; roundNum++) {
    for (const key of docKeys) {
      await collection.get(key)
    }
    console.log(`   ✓ Round ${roundNum} complete`)
  }

  console.log('\n3. Executing N1QL query...')
  try {
    const query = `SELECT name, user_role FROM \`${BUCKET_NAME}\` WHERE type = 'user' LIMIT 3`
    const result = await cluster.query(query)
    console.log(`   ✓ Query returned ${result.rows.length} rows`)
  } catch (e: any) {
    console.log(`   ⚠ Query failed: ${e.message}`)
  }

  console.log('\n4. Cleaning up...')
  for (const key of docKeys) {
    try {
      await collection.remove(key)
    } catch (e) {} // Ignore
  }
}

async function performOperationsWithParent(
  collection: Collection,
  cluster: Cluster,
  cbTracer: RequestTracer
) {
  console.log('\n' + '-'.repeat(80))
  console.log('Executing Workloads with Custom Parent Spans')
  console.log('-'.repeat(80) + '\n')

  const appTracer = trace.getTracer('my-node-app')
  const testKey = 'doc:explicit_vs_implicit'
  const testDoc = { type: 'user', active: true }

  // ========================================================================
  // PATTERN 1: IMPLICIT CONTEXT
  // ========================================================================
  console.log('Pattern 1: Implicit Context (startActiveSpan)...')

  await appTracer.startActiveSpan(
    'process_implicit_batch',
    async (parentSpan) => {
      try {
        // The SDK automatically finds 'process_implicit_batch' in AsyncLocalStorage
        await collection.upsert(testKey, testDoc)
        await collection.get(testKey)
        console.log('   ✓ Implicit workload complete')
      } finally {
        parentSpan.end()
      }
    }
  )

  // ========================================================================
  // PATTERN 2: EXPLICIT CONTEXT
  // ========================================================================
  console.log('\nPattern 2: Explicit Context (Manual Span Passing)...')

  // Notice we use couchbase wrapper tracer
  const explicitSpan = cbTracer.requestSpan('process_explicit_batch')

  try {
    // We MUST pass the span explicitly, otherwise the SDK won't know about it
    await collection.upsert(testKey, testDoc, { parentSpan: explicitSpan })
    await collection.get(testKey, { parentSpan: explicitSpan })

    // Example with cluster query
    try {
      const query = `SELECT * FROM \`${BUCKET_NAME}\` LIMIT 1`
      await cluster.query(query, { parentSpan: explicitSpan })
    } catch (e) {} // Ignore

    await collection.remove(testKey, { parentSpan: explicitSpan })

    console.log('   ✓ Explicit workload complete')
  } finally {
    explicitSpan.end()
  }
}

async function main() {
  printBanner()
  let tProvider: NodeTracerProvider | null = null
  let mProvider: MeterProvider | null = null

  // Create a shared resource so both metrics and traces share the exact same service name
  const customResource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: SERVICE_NAME,
  })
  const resource = defaultResource().merge(customResource)

  try {
    console.log('Setting up OpenTelemetry...')

    // Setup providers cleanly
    tProvider = setupOtelTracing(resource)
    mProvider = setupOtelMetrics(resource)

    console.log(`Connecting to Couchbase at ${CONNECTION_STRING}...`)

    // Extract the Couchbase-specific wrappers
    const cbTracer = getOTelTracer(tProvider)
    const cbMeter = getOTelMeter(mProvider)

    const cluster = await connect(CONNECTION_STRING, {
      username: USERNAME,
      password: PASSWORD,
      tracer: cbTracer, // Inject Tracer
      meter: cbMeter, // Inject Meter
    })

    const collection = cluster.bucket(BUCKET_NAME).defaultCollection()
    console.log('✓ Connected to Couchbase\n')

    await performOperations(collection, cluster)
    await performOperationsWithParent(collection, cluster, cbTracer)

    console.log('\nClosing cluster connection...')
    await cluster.close()

    // Wait a moment for the periodic metric reader to catch the final data
    await new Promise((resolve) => setTimeout(resolve, 2000))
  } catch (e) {
    console.error(`\nERROR:`, e)
  } finally {
    console.log('\nFlushing telemetry data...')

    // Shut down both providers to flush all remaining data
    if (tProvider) await tProvider.shutdown()
    if (mProvider) await mProvider.shutdown()

    console.log('✓ Telemetry flushed gracefully.\n')

    console.log('📊 VIEW YOUR DATA:')
    console.log('  • Traces:  http://localhost:16686 (Jaeger)')
    console.log('  • Metrics: http://localhost:9090  (Prometheus)')
    console.log('='.repeat(80) + '\n')
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
