/**
 * OpenTelemetry Tracing and Metrics Example (JavaScript)
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
 *   node otel-otlp-metrics-and-tracing.js
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
 *    - Search "couchbase-otel-combined-example-js" service and look for spans like "kv.upsert", "kv.get", "cluster.query", etc.
 * - Metrics should visible in Prometheus UI at http://localhost:9090
 *    - Search "db_client_operation_duration_seconds_bucket" in UI
 */

const { trace, metrics } = require('@opentelemetry/api')
const {
  defaultResource,
  resourceFromAttributes,
} = require('@opentelemetry/resources')
const { ATTR_SERVICE_NAME } = require('@opentelemetry/semantic-conventions')
const {
  AlwaysOnSampler,
  NodeTracerProvider,
  ParentBasedSampler,
  BatchSpanProcessor,
} = require('@opentelemetry/sdk-trace-node')
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-grpc')
const {
  MeterProvider,
  PeriodicExportingMetricReader,
} = require('@opentelemetry/sdk-metrics')
const {
  OTLPMetricExporter,
} = require('@opentelemetry/exporter-metrics-otlp-grpc')
const { connect, getOTelTracer, getOTelMeter } = require('couchbase')

// Configuration
const SERVICE_NAME = 'couchbase-otel-combined-example-js'
const OTLP_ENDPOINT = 'http://localhost:4317' // Both traces and metrics go here
const CONNECTION_STRING = 'couchbase://localhost'
const BUCKET_NAME = 'default'
const USERNAME = 'Administrator'
const PASSWORD = 'password'

function setupOtelTracing(resource) {
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

function setupOtelMetrics(resource) {
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
  console.log('OpenTelemetry OTLP Combined Example (Plain JavaScript)')
  console.log('='.repeat(80) + '\n')
}

async function performOperations(collection, cluster) {
  console.log('\n' + '-'.repeat(80))
  console.log('Performing Operations (Generating Traces & Metrics)')
  console.log('-'.repeat(80) + '\n')

  const docs = {
    'testdoc:js:1': {
      name: 'Alice',
      age: 30,
      type: 'user',
      user_role: 'admin',
    },
    'testdoc:js:2': {
      name: 'Bob',
      age: 25,
      type: 'user',
      user_role: 'developer',
    },
    'testdoc:js:3': {
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
  } catch (e) {
    console.log(`   ⚠ Query failed: ${e.message}`)
  }

  console.log('\n4. Cleaning up...')
  for (const key of docKeys) {
    try {
      await collection.remove(key)
    } catch (e) {} // Ignore missing docs
  }
}

async function performOperationsWithParent(collection, cluster, cbTracer) {
  console.log('\n' + '-'.repeat(80))
  console.log('Executing Workloads with Custom Parent Spans')
  console.log('-'.repeat(80) + '\n')

  const appTracer = trace.getTracer('my-js-app')
  const testKey = 'doc:explicit_vs_implicit_js'
  const testDoc = { type: 'user', active: true }

  // ========================================================================
  // PATTERN 1: IMPLICIT CONTEXT (startActiveSpan)
  // ========================================================================
  console.log('Pattern 1: Implicit Context (startActiveSpan)...')

  await appTracer.startActiveSpan(
    'process_implicit_batch_js',
    async (parentSpan) => {
      try {
        await collection.upsert(testKey, testDoc)
        await collection.get(testKey)
        console.log('   ✓ Implicit workload complete')
      } finally {
        parentSpan.end()
      }
    }
  )

  // ========================================================================
  // PATTERN 2: EXPLICIT CONTEXT (Manual Span Passing)
  // ========================================================================
  console.log('\nPattern 2: Explicit Context (Manual Span Passing)...')

  // Use cbTracer.requestSpan() to generate the Couchbase-compatible span
  const explicitCbSpan = cbTracer.requestSpan('process_explicit_batch_js')

  try {
    // Pass the span manually via the options object
    await collection.upsert(testKey, testDoc, { parentSpan: explicitCbSpan })
    await collection.get(testKey, { parentSpan: explicitCbSpan })

    try {
      const query = `SELECT * FROM \`${BUCKET_NAME}\` LIMIT 1`
      await cluster.query(query, { parentSpan: explicitCbSpan })
    } catch (e) {}

    await collection.remove(testKey, { parentSpan: explicitCbSpan })

    console.log('   ✓ Explicit workload complete')
  } finally {
    explicitCbSpan.end()
  }
}

async function main() {
  printBanner()
  let tProvider = null
  let mProvider = null

  // Shared resource for both metrics and traces
  const customResource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: SERVICE_NAME,
  })
  const resource = defaultResource().merge(customResource)

  try {
    console.log('Setting up OpenTelemetry...')

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

    // Pass cbTracer to demonstrate the explicit context pattern
    await performOperationsWithParent(collection, cluster, cbTracer)

    console.log('\nClosing cluster connection...')
    await cluster.close()

    // Wait for the periodic metric reader to catch the final data
    await new Promise((resolve) => setTimeout(resolve, 2000))
  } catch (e) {
    console.error(`\nERROR:`, e)
  } finally {
    console.log('\nFlushing telemetry data...')

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
